/* 静态数据一致性校验（无需浏览器/编译，纯读源文件正则断言）
 * 运行：node docs/_content_check.js
 * 校验：物种数/进化链闭合/技能引用/图集映射/副本配置/图鉴目标 */
const fs = require('fs');
const path = require('path');
const R = [];
function check(name, cond, extra) {
  R.push({ name, pass: !!cond });
  console.log((cond ? 'PASS ' : 'FAIL ') + name, extra !== undefined ? JSON.stringify(extra) : '');
}
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

const gd = read('shared/gamedata.ts');
const dg = read('shared/dungeons.ts');
const qs = read('shared/quests.ts');

// 1) 物种：18 只，id 连续
const speciesIds = [...gd.matchAll(/^\s*(\d+):\s*\{\s*id:\s*\d+/gm)].map(m => Number(m[1]));
check('物种定义 18 只', speciesIds.length === 18, { count: speciesIds.length });
check('物种 id 为 1-18 连续', speciesIds.every((v, i) => v === i + 1));

// 2) 技能引用：所有 species 的 skills 都在 SKILLS 中定义
const skillDefs = new Set([...gd.matchAll(/^\s*(\w+):\s*\{\s*name:/gm)].map(m => m[1]));
const skillRefs = [...gd.matchAll(/skills:\s*\[([^\]]+)\]/g)].flatMap(m =>
  [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]));
const missingSkills = [...new Set(skillRefs.filter(s => !skillDefs.has(s)))];
check('全部技能引用均已定义', missingSkills.length === 0, { missingSkills });

// 3) 进化链目标都存在
const evoTargets = [...gd.matchAll(/evolve:\s*\{\s*lv:\s*\d+,\s*to:\s*(\d+)\s*\}/g)].map(m => Number(m[1]));
const badEvo = evoTargets.filter(t => !speciesIds.includes(t));
check('进化链目标物种均存在', badEvo.length === 0, { evoTargets, badEvo });

// 4) 图集映射覆盖全部物种，且列/行在 3x2 范围内
const cells = [...gd.matchAll(/\b(\d+):\s*\[(\d+),\s*(\d+)(?:,\s*(\d+))?\]/g)].map(m => ({
  id: Number(m[1]), col: Number(m[2]), row: Number(m[3]), sheet: m[4] ? Number(m[4]) : 0
}));
const missingCells = speciesIds.filter(id => !cells.some(c => c.id === id));
check('图集映射覆盖全部物种', missingCells.length === 0, { missingCells });
const badCell = cells.filter(c => c.col > 2 || c.row > 1 || c.sheet > 1);
check('图集格子均在 3x2 且图集 0/1 内', badCell.length === 0, { badCell });
check('两张图集均有物种使用', [0, 1].every(s => cells.some(c => c.sheet === s)));
const sheet1Cells = cells.filter(c => c.sheet === 1);
const sheet1Keys = sheet1Cells.map(c => c.col + ',' + c.row);
check('第二世代 6 只各占独立格子', sheet1Cells.length === 6 && new Set(sheet1Keys).size === 6, { sheet1Keys });

// 5) 副本：5 个，id 唯一，概率和为 1，遭遇物种存在，解锁标记引用真实任务
const dungeonIds = [...dg.matchAll(/^\s{2}(\w+):\s*\{\s*id:\s*'\1'/gm)].map(m => m[1]);
check('副本数量 5 个', dungeonIds.length === 5, { dungeonIds, count: dungeonIds.length });
check('副本 id 唯一', new Set(dungeonIds).size === dungeonIds.length);
const encSpecies = [...dg.matchAll(/\{\s*species:\s*(\d+),\s*w:\s*\d+\s*\}/g)].map(m => Number(m[1]));
const badEnc = [...new Set(encSpecies.filter(s => !speciesIds.includes(s)))];
check('副本遭遇物种均存在', badEnc.length === 0, { badEnc });
const rates = [...dg.matchAll(/rates:\s*\{\s*monster:\s*([\d.]+),\s*item:\s*([\d.]+),\s*nothing:\s*([\d.]+)\s*\}/g)]
  .map(m => Number(m[1]) + Number(m[2]) + Number(m[3]));
check('全部副本概率和为 1', rates.length === 5 && rates.every(r => Math.abs(r - 1) < 1e-9), { rates });
// 解锁标记必须指向 quests.ts 中存在的任务 id
const questIds = [...qs.matchAll(/id:\s*'([^']+)',\s*stage:/g)].map(m => m[1]);
const unlockFlags = [...dg.matchAll(/unlockFlag:\s*'quest:([^:]+):claimed'/g)].map(m => m[1]);
const badFlags = unlockFlags.filter(f => !questIds.includes(f));
check('副本解锁标记均指向真实任务', badFlags.length === 0, { unlockFlags, badFlags, questIds });
check('cavern 解锁标记已修复为 veteran', /id: 'cavern'[\s\S]*?unlockFlag: 'quest:veteran:claimed'/.test(dg));

// 6) 图鉴任务目标已提升
check('图鉴大师目标提升到 12', /id: 'collector'[\s\S]*?goal: 12/.test(qs));

console.log('\n=== CONTENT CHECK ' + R.filter(x => x.pass).length + '/' + R.length + ' PASS ===');
process.exit(R.every(x => x.pass) ? 0 : 1);
