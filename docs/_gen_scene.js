/* 生成 3D 场景素材：草原地面纹理 + 天空远景（中国站 Agnes） */
const https = require('https');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', 'server', '.env') });
const API_KEY = process.env.AGNES_API_KEY;
const OUT = path.join(__dirname, '..', 'web', 'public', 'art');
fs.mkdirSync(OUT, { recursive: true });

const tasks = [
  { file: 'scene_grass.png', size: '1K', ratio: '1:1',
    prompt: 'Top-down overhead view of a lush fantasy grassland terrain texture tile for a 3D game map, soft green grass with scattered small wildflowers, gentle patches of darker green, a few smooth dirt paths crossing, no characters, no objects, seamless-looking ground texture, bright cheerful anime game art style, soft cel shading, even lighting, high detail' },
  { file: 'scene_sky.png', size: '1K', ratio: '16:9',
    prompt: 'Panoramic fantasy game sky panorama, bright clear blue sky with fluffy white clouds, warm sunlight, distant rolling green hills and a few faraway trees along the horizon, peaceful anime game environment art style, soft cel shading, no characters, no buildings, wide landscape composition, high detail' }
];

function gen(task) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: 'agnes-image-2.5-flash', prompt: task.prompt, size: task.size, ratio: task.ratio, extra_body: { response_format: 'url' } });
    const req = https.request({ hostname: 'api.agnes-ai.cn', path: '/v1/images/generations', method: 'POST',
      headers: { Authorization: 'Bearer ' + API_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 300000 }, res => {
      let buf = ''; res.on('data', d => buf += d);
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(task.file + ' HTTP ' + res.statusCode + ': ' + buf.slice(0,300)));
        try {
          const j = JSON.parse(buf), url = j.data?.[0]?.url;
          if (!url) return reject(new Error(task.file + ' no url: ' + buf.slice(0,300)));
          console.log('  生成成功:', task.file);
          https.get(url, r => { const c = []; r.on('data', d => c.push(d)); r.on('end', () => { fs.writeFileSync(path.join(OUT, task.file), Buffer.concat(c)); resolve(); }); }).on('error', reject);
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
  console.log('Key 前缀:', API_KEY.slice(0,6), '| 输出目录:', OUT);
  for (const t of tasks) {
    try { console.log('生成', t.file, '...'); await gen(t); }
    catch (e) { console.error('  失败', e.message); }
  }
  console.log('完成');
})();
