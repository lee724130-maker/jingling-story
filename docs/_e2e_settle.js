/* E2E：验证前端战斗胜利后走服务端结算，version 递增且金币增加 */
const { chromium } = require('C:/Users/Administrator/Desktop/REA测试/node_modules/playwright-core');
const path = require('path');
const OUT = path.resolve(__dirname, '../.chrome-e2e');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errors.push('console: ' + m.text()); });

  await page.goto('http://localhost:5180/', { waitUntil: 'networkidle' });
  await sleep(500);
  // 登录
  await page.fill('.login-input', 'E2E结算' + Date.now());
  await page.click('.bigbtn.primary');
  await sleep(300);
  const enters = await page.$$('.bigbtn.primary');
  if (enters.length) await enters[enters.length - 1].click();
  await sleep(600);
  for (let i = 0; i < 4; i++) { await page.keyboard.press('Enter'); await sleep(100); }

  // 把出战精灵提到高等级，确保能打赢野怪，验证胜利结算
  await page.evaluate(() => {
    const g = window.__game;
    const m = g.save.team[0];
    m.level = 40; m.maxHp = 500; m.hp = 500; m.atk && (m.atk = 999);
    g.save.bag.ball = 20; g.save.bag.herb = 20;
  });
  const snap0 = await page.evaluate(() => ({ v: window.__game.version, coins: window.__game.save.resources.coins }));
  console.log('初始', JSON.stringify(snap0));

  // 追野怪
  const moveToward = async (tx, ty) => {
    const p = await page.evaluate(() => ({ x: window.__game.state.player.x, y: window.__game.state.player.y }));
    let key = null;
    if (Math.abs(tx - p.x) >= Math.abs(ty - p.y)) key = tx > p.x ? 'ArrowRight' : 'ArrowLeft';
    else key = ty > p.y ? 'ArrowDown' : 'ArrowUp';
    if (key) { await page.keyboard.down(key); await sleep(110); await page.keyboard.up(key); }
  };

  let inBattle = false;
  for (let step = 0; step < 260; step++) {
    const s = await page.evaluate(() => ({ scene: window.__game.state.scene, p: { x: window.__game.state.player.x, y: window.__game.state.player.y }, wilds: window.__game.state.wilds.map(w => ({ x: w.x, y: w.y })) }));
    if (s.scene === 'summon') { await sleep(120); continue; }
    if (s.scene === 'battle') { inBattle = true; break; }
    let best = null, bd = 1e9;
    for (const w of s.wilds) { const d = Math.hypot(w.x - s.p.x, w.y - s.p.y); if (d < bd) { bd = d; best = w; } }
    if (best) await moveToward(best.x, best.y);
    await sleep(30);
  }
  console.log('进入战斗:', inBattle);
  if (!inBattle) { console.log('RESULT FAIL 未进入战斗', errors); await browser.close(); process.exit(1); }

  // 反复攻击直到战斗结束（回到 world）或超时
  let ended = false;
  for (let turn = 0; turn < 30; turn++) {
    const scene = await page.evaluate(() => window.__game.state.scene);
    if (scene !== 'battle') { ended = true; break; }
    // 点"技能" -> 第一个技能
    const btns = await page.$$('.actbtn');
    if (btns.length) await btns[0].click();
    await sleep(150);
    const skills = await page.$$('.actbtn');
    if (skills.length) await skills[0].click();
    await sleep(1400);
  }
  console.log('战斗结束回到世界:', ended);
  await sleep(800);

  const snap1 = await page.evaluate(() => ({ v: window.__game.version, coins: window.__game.save.resources.coins, scene: window.__game.state.scene }));
  console.log('结算后', JSON.stringify(snap1));
  const versionUp = snap1.v > snap0.v;
  const coinsUp = snap1.coins > snap0.coins;
  const pass = ended && versionUp && errors.length === 0;
  console.log('RESULT', JSON.stringify({ pass, ended, versionUp, coinsUp, errors }));
  await browser.close();
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
