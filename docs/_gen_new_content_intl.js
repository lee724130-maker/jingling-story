/* Agnes 国际站（apihub.agnes-ai.com）生图脚本 · OpenAI 兼容格式
 * 生成 P0 内容扩充的三张真实素材，覆盖占位图：
 *   - spirits2.png      第二世代精灵群像（3列×2行，白底，6 只）
 *   - scene_glacier.png 霜寒冰原场景图
 *   - scene_volcano.png 熔火山地场景图
 * 运行：node docs/_gen_new_content_intl.js
 * 凭证：server/.env 的 AGNES_API_KEY（该文件已被 gitignore 忽略，切勿提交） */
const https = require('https');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', 'server', '.env') });
const KEY = process.env.AGNES_API_KEY;
const BASE = (process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com/v1').replace(/\/$/, '');
const OUT = path.join(__dirname, '..', 'web', 'public', 'art');
fs.mkdirSync(OUT, { recursive: true });

const tasks = [
  {
    file: 'spirits2.png', size: '1024x1024',
    prompt: 'A single grid image of SIX cute fantasy monster creatures arranged in a strict 3 columns by 2 rows layout, each creature fully inside its own equal cell, generous white gaps between cells, pure white background. Same chibi anime game art style as a monster-catching game: large sparkling eyes, soft cel shading, clean outlines, soft ground shadow. Top-left: small orange fox cub with a flame-tipped tail (fire type). Top-middle: small blue-white turtle with an ice crystal shell (ice/water type). Top-right: small dark-green fox-like creature with leafy ears hiding in shadow (wood type). Bottom-left: adult majestic orange lion with a flowing fiery mane (fire type). Bottom-middle: large blue-white turtle with enormous jagged ice spikes on its back (ice/water type). Bottom-right: ancient towering tree creature with mossy bark and leafy crown (wood type). All six are original designs, clearly separated, evenly sized, no text, no labels, no borders.'
  },
  {
    file: 'scene_glacier.png', size: '1536x864',
    prompt: 'Panoramic fantasy game environment, a frozen glacier valley between snow mountains, crystalline ice formations and a half-frozen clear stream, soft blue and cyan palette, falling snowflakes, pale winter sunlight, distant snow-capped peaks, cheerful anime game art style, soft cel shading, no characters, no buildings, wide landscape composition, high detail'
  },
  {
    file: 'scene_volcano.png', size: '1536x864',
    prompt: 'Panoramic fantasy game environment, a volcanic highland with flowing lava rivers and dark obsidian rocks, glowing orange cracks in the ground, sparks in the air, distant erupting volcano silhouette, warm red-orange palette, dramatic but cheerful anime game art style, soft cel shading, no characters, no buildings, wide landscape composition, high detail'
  }
];

function request(method, url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: u.hostname, path: u.pathname + u.search, method,
      headers: Object.assign({
        Authorization: 'Bearer ' + KEY,
        'Content-Type': 'application/json'
      }, data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      timeout: 300000
    }, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode + ': ' + buf.slice(0, 400)));
        try { resolve(JSON.parse(buf)); } catch (e) { reject(new Error('JSON parse: ' + buf.slice(0, 200))); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.get({ hostname: u.hostname, path: u.pathname + u.search, timeout: 180000 }, res => {
      if (res.statusCode !== 200) return reject(new Error('download HTTP ' + res.statusCode));
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => { fs.writeFileSync(dest, Buffer.concat(chunks)); resolve(); });
    });
    req.on('timeout', () => req.destroy(new Error('download timeout')));
    req.on('error', reject);
  });
}

(async () => {
  if (!KEY) { console.error('未读到 AGNES_API_KEY'); process.exit(1); }
  console.log('Key 前缀:', KEY.slice(0, 8), '| Base:', BASE);
  for (const task of tasks) {
    try {
      console.log('生成', task.file, '...');
      const r = await request('POST', BASE + '/images/generations', {
        model: 'agnes-image-2.5-flash', prompt: task.prompt, size: task.size
      });
      const url = r.data && r.data[0] && r.data[0].url;
      if (!url) throw new Error('no url: ' + JSON.stringify(r).slice(0, 300));
      const dest = path.join(OUT, task.file);
      await download(url, dest);
      const stat = fs.statSync(dest);
      console.log('  完成', task.file, (stat.size / 1024).toFixed(0) + 'KB');
    } catch (e) {
      console.error('  失败', task.file, e.message);
    }
  }
  console.log('全部完成。请刷新浏览器加载新素材。');
})();
