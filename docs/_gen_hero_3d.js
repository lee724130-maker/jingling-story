/* 生成用于「图生3D」的角色概念图
 * 关键要求（决定 3D 生成质量）：全身入镜、正面站姿、A字站姿手臂微张、
 * 纯色背景、均匀布光无强阴影、角色居中占主体、单一角色不重叠。
 * 用 Agnes Image 2.5 Flash（中国站），生成后供老板确认质感，确认后才消耗 Tripo 积分。 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', 'server', '.env') });
const API_KEY = process.env.AGNES_API_KEY;
const OUT = path.join(__dirname, '..', 'web', 'public', 'art', 'concepts');
fs.mkdirSync(OUT, { recursive: true });

/* 三套方案：风格化冒险家 / 精致二次元 / 半写实游戏角色，供对比挑选 */
const tasks = [
  {
    file: 'hero_v1_stylized.png',
    prompt: 'Full-body character concept sheet for 3D modeling, a single young male adventurer, 16 years old, wearing a teal hooded cloak, cream tunic, brown leather belt and boots, carrying a small satchel, friendly confident expression, short tousled brown hair. Stylized game art with detailed material textures (fabric weave, leather grain), soft cel-shading blended with subtle PBR lighting, similar to a modern stylized RPG character. Standing straight facing camera directly, relaxed A-pose with arms slightly away from body, complete head-to-toe visible including feet, perfectly centered, plain light gray seamless background, even soft lighting, no shadows on ground, no text, no watermark, single character only, high detail, 1:1 square composition'
  },
  {
    file: 'hero_v2_anime.png',
    prompt: 'Full-body 3D-rendered anime game character of a young male monster trainer, 15 years old, wearing a navy blue jacket with gold trim, white shirt, red shorts, sneakers, holding a small round creature ball, bright cheerful smile, messy dark hair. High quality anime-style 3D game model look (like a modern gacha game character), clean detailed textures, soft studio lighting, subsurface skin shading. Standing straight facing camera, A-pose arms slightly out, full body visible head to feet, centered, plain light gray background, even lighting, no ground shadow, no text, single character, high detail, square composition'
  },
  {
    file: 'hero_v3_realistic.png',
    prompt: 'Full-body realistic game character concept, a young adult male adventurer in detailed leather armor with a dark green cloak, metal shoulder pauldrons, sturdy boots, determined expression, short dark hair. Semi-realistic AAA game character quality, intricate armor textures, fabric folds, realistic materials, dramatic but even studio lighting. Standing upright facing camera directly, relaxed A-pose, entire body from head to feet fully visible, centered, plain light gray seamless background, soft even lighting, no cast shadow, no text, no watermark, single character only, very high detail, square composition'
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
            r.on('end', () => { fs.writeFileSync(path.join(OUT, task.file), Buffer.concat(c)); resolve(); });
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
  console.log('Key 前缀:', API_KEY.slice(0, 6), '| 输出目录:', OUT);
  for (const t of tasks) {
    try { console.log('生成', t.file, '...'); await gen(t); }
    catch (e) { console.error('  失败', e.message); }
  }
  console.log('完成，共 3 张候选');
})();
