/* 生成 v3 半写实风格的女性角色概念图，用于与 hero_v3_realistic 男主配成一套。
 * 关键要求：全身入镜、正面站姿、A-pose、纯色背景、均匀布光、单一角色居中。
 * 用 Agnes Image 2.5 Flash（中国站），仅生图，不消耗 Tripo 积分。 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', 'server', '.env') });
const API_KEY = process.env.AGNES_API_KEY;
const OUT = path.join(__dirname, '..', 'web', 'public', 'art', 'concepts');
const OUT2 = path.join(__dirname, '..', '人物候选图');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(OUT2, { recursive: true });

const tasks = [
  {
    file: 'heroine_v3_matched.png',
    prompt: 'Full-body realistic game character concept, a young adult female adventurer in detailed brown leather armor with a dark green cloak, metal shoulder pauldrons, sturdy boots, long dark hair tied in a practical braid, calm determined expression. Semi-realistic AAA game character quality, intricate armor textures, fabric folds, realistic materials, even studio lighting. Standing upright facing camera directly, relaxed A-pose with arms slightly away from body, entire body from head to feet fully visible including boots, centered, plain light gray seamless background, soft even lighting, no cast shadow, no text, no watermark, single character only, very high detail, square composition'
  },
  {
    file: 'heroine_v3_ranger.png',
    prompt: 'Full-body realistic game character concept, a young adult female ranger in weathered leather armor with a dark green hooded cloak, leather bracers and thigh-high boots, shoulder-length auburn hair, confident warm expression, a small quiver on her back. Semi-realistic AAA game character quality, detailed leather and fabric textures, realistic materials, even studio lighting. Standing upright facing camera directly, relaxed A-pose with arms slightly away from body, entire body from head to feet fully visible including boots, centered, plain light gray seamless background, soft even lighting, no cast shadow, no text, no watermark, single character only, very high detail, square composition'
  }
];

function gen(task) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: 'agnes-image-2.5-flash', prompt: task.prompt, size: '1K', ratio: '1:1', extra_body: { response_format: 'url' } });
    const req = https.request({ hostname: 'api.agnes-ai.cn', path: '/v1/images/generations', method: 'POST',
      headers: { Authorization: 'Bearer ' + API_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 300000 }, res => {
      let buf = ''; res.on('data', d => buf += d);
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(task.file + ' HTTP ' + res.statusCode + ': ' + buf.slice(0, 300)));
        try {
          const j = JSON.parse(buf), url = j.data?.[0]?.url;
          if (!url) return reject(new Error(task.file + ' no url: ' + buf.slice(0, 300)));
          console.log('  生成成功:', task.file);
          https.get(url, r => {
            const c = []; r.on('data', d => c.push(d));
            r.on('end', () => {
              const data = Buffer.concat(c);
              fs.writeFileSync(path.join(OUT, task.file), data);
              fs.writeFileSync(path.join(OUT2, task.file), data);
              resolve();
            });
          }).on('error', reject);
        } catch (e) { reject(e); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.write(body); req.end();
  });
}

(async () => {
  if (!API_KEY) { console.error('未读到 AGNES_API_KEY'); process.exit(1); }
  console.log('Key 前缀:', API_KEY.slice(0, 6), '| 输出目录:', OUT, '&', OUT2);
  for (const t of tasks) {
    try { console.log('生成', t.file, '...'); await gen(t); }
    catch (e) { console.error('  失败', e.message); }
  }
  console.log('完成，共 2 张女性候选');
})();
