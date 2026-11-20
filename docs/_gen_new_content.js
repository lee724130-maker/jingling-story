/* 正式生图脚本（双线并发版 · 推荐）：用 _agnes_dual 的 generateBatch 批量生成。
 * 多张图轮询分流到国际站/国内站，跨站并行、站内串行（防限流），单任务失败自动切备站。
 * 运行：node docs/_gen_new_content.js
 *   （可选）LINE=intl 或 LINE=cn 强制只用单站，默认双站并发
 * 凭证：server/.env 的 AGNES_* / AGNES_CN_*（gitignore 忽略） */
const { generateBatch, LINES } = require('./_agnes_dual');

const forced = process.env.LINE;
const lines = forced ? [forced] : ['intl', 'cn'].filter(id => LINES[id] && LINES[id].key);
console.log('生图线路:', lines.map(l => LINES[l].name).join(' + '), '（跨站并行）');

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

(async () => {
  const results = await generateBatch(tasks, { lines });
  const failed = results.filter(r => !r || !r.ok);
  if (failed.length) console.error('失败任务:', failed.map(f => f.file + ' (' + f.error + ')').join(', '));
  else console.log('全部完成。刷新浏览器加载新素材。');
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
