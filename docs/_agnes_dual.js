/* Agnes 双线生图客户端（国内站 + 国际站）
 * 两站均为 OpenAI 兼容格式，返回结构一致，仅域名/凭证不同。
 *
 * 能力：
 *   - generate()      单张生成，line: 'intl' | 'cn' | 'auto'（主站失败切备站）
 *   - generateTo()    单张生成并下载到 art 目录
 *   - generateBatch() 批量并发：轮询分流到两站，跨站并行、站内串行（防限流），
 *                     单任务失败自动切备站，实现批量提速 + 容灾 + 双份配额
 *
 * 用法：
 *   const { generate, generateBatch, generateTo } = require('./_agnes_dual');
 *   await generate('a cute fox', { line: 'auto' });
 *   await generateBatch([{ prompt:'...', file:'a.png' }, { prompt:'...', file:'b.png' }]);
 *
 * 凭证：server/.env 的 AGNES_* / AGNES_CN_*（该文件已 gitignore）
 * 注意：单张图是原子请求，不能拆两半提速；批量提速来自「多任务跨站并行」。 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', 'server', '.env') });

const LINES = {
  intl: {
    name: '国际站',
    key: process.env.AGNES_API_KEY,
    base: (process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com/v1').replace(/\/$/, ''),
    model: 'agnes-image-2.5-flash'
  },
  cn: {
    name: '国内站',
    key: process.env.AGNES_CN_API_KEY,
    base: (process.env.AGNES_CN_BASE_URL || 'https://api.agnes-ai.cn/v1').replace(/\/$/, ''),
    model: 'agnes-image-2.5-flash'
  }
};

function postJson(url, key, body, timeout = 300000) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
      headers: {
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }, timeout
    }, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode + ': ' + buf.slice(0, 300)));
        try { resolve(JSON.parse(buf)); } catch (e) { reject(new Error('JSON parse: ' + buf.slice(0, 200))); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

/** 向单站发一次生成请求，返回 url（不下载、不回退） */
async function callLine(id, prompt, opts = {}) {
  const line = LINES[id];
  if (!line || !line.key) throw new Error(id + ' 线未配置 key');
  const size = opts.size || '1024x1024';
  const model = opts.model || 'agnes-image-2.5-flash';
  const r = await postJson(line.base + '/images/generations', line.key, { model, prompt, size });
  const url = r.data && r.data[0] && r.data[0].url;
  if (!url) throw new Error('no url: ' + JSON.stringify(r).slice(0, 200));
  return url;
}

/** 生成一张图，返回 { url, line }。line: 'intl' | 'cn' | 'auto' */
async function generate(prompt, opts = {}) {
  const strategy = opts.line || 'auto';
  const order = strategy === 'auto' ? ['intl', 'cn'] : [strategy];
  let lastErr;
  for (const id of order) {
    try {
      const t0 = Date.now();
      const url = await callLine(id, prompt, opts);
      console.log(`  [${LINES[id].name}] 成功 (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
      return { url, line: id };
    } catch (e) {
      console.log(`  [${LINES[id].name}] 失败: ${e.message}`);
      lastErr = e;
    }
  }
  throw lastErr || new Error('无可用的生图线路');
}

/** 下载图片到本地路径 */
function download(url, dest) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.get({ hostname: u.hostname, path: u.pathname + u.search, timeout: 180000 }, res => {
      if (res.statusCode !== 200) return reject(new Error('download HTTP ' + res.statusCode));
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => { fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, Buffer.concat(chunks)); resolve(dest); });
    });
    req.on('timeout', () => req.destroy(new Error('download timeout')));
    req.on('error', reject);
  });
}

/** 生成并下载到项目 art 目录。line 可传 'intl'|'cn'|'auto'（默认 auto） */
async function generateTo(prompt, filename, opts = {}) {
  const { url, line } = await generate(prompt, opts);
  const dest = path.join(__dirname, '..', 'web', 'public', 'art', filename);
  await download(url, dest);
  return { line, dest, size: fs.statSync(dest).size };
}

/**
 * 批量并发生成并下载。多张图轮询分流到两站，跨站并行执行，站内串行（防单站限流）。
 * 单个任务失败时自动切到另一站重试一次。
 *
 * @param {Array<{prompt:string, file:string, size?:string}>} tasks 任务列表
 * @param {object} opts
 *   - lines: ['intl','cn'] 参与的站点（默认两站）
 *   - fallback: true 失败切备站（默认 true）
 * @returns {Array<{file, line, dest, size, ok, error?}>} 与 tasks 顺序一致的结果
 */
async function generateBatch(tasks, opts = {}) {
  const lines = (opts.lines || ['intl', 'cn']).filter(id => LINES[id] && LINES[id].key);
  if (!lines.length) throw new Error('未配置任何可用生图线路');
  const fallback = opts.fallback !== false && lines.length > 1;
  const t0 = Date.now();

  // 每个站点一个 worker：顺序消费分给自己的任务（站内串行，避免限流）
  const queues = lines.map(() => []);
  tasks.forEach((task, i) => queues[i % lines.length].push({ task, index: i }));
  const results = new Array(tasks.length);

  const workers = queues.map((queue, qi) => (async () => {
    const primaryId = lines[qi];
    for (const { task, index } of queue) {
      const candidates = fallback ? [primaryId, ...lines.filter(l => l !== primaryId)] : [primaryId];
      let lastErr;
      for (const id of candidates) {
        try {
          const url = await callLine(id, task.prompt, task);
          const dest = path.join(__dirname, '..', 'web', 'public', 'art', task.file);
          await download(url, dest);
          const size = fs.statSync(dest).size;
          console.log(`  [${LINES[id].name}] ${task.file} ✓ ${(size / 1024).toFixed(0)}KB`);
          results[index] = { file: task.file, line: id, dest, size, ok: true };
          lastErr = null;
          break;
        } catch (e) {
          console.log(`  [${LINES[id].name}] ${task.file} 失败: ${e.message}${fallback && id === primaryId ? ' → 切备站' : ''}`);
          lastErr = e;
        }
      }
      if (lastErr) results[index] = { file: task.file, line: null, dest: null, size: 0, ok: false, error: lastErr.message };
    }
  })());

  await Promise.all(workers);
  console.log(`批量完成：${results.filter(r => r && r.ok).length}/${tasks.length} 成功，总耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return results;
}

module.exports = { generate, generateTo, generateBatch, download, LINES };

// 直接运行时做双线连通性自检（各生成 1 张，验证两站都能用）
if (require.main === module) {
  (async () => {
    const probe = 'a single small blue crystal, simple icon, white background';
    for (const id of ['intl', 'cn']) {
      try {
        const t0 = Date.now();
        const r = await generate(probe, { line: id });
        console.log(`RESULT ${id}: OK 线路=${r.line} 耗时=${((Date.now() - t0) / 1000).toFixed(1)}s`);
      } catch (e) {
        console.log(`RESULT ${id}: FAIL ${e.message}`);
      }
    }
  })();
}
