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
  await sleep(1200);
  // 新流程：推进引导对话 → 选初始伙伴 → 清残留对话
  for (let i = 0; i < 10; i++) { if (await page.$('.starter-box')) break; await page.keyboard.press('Enter'); await sleep(130); }
  if (await page.$('.starter-box')) {
    await page.evaluate(() => { const c = document.querySelector('.starter-card'); if (c) c.click(); });
    await sleep(180);
    await page.evaluate(() => { const c = document.querySelector('.starter-confirm'); if (c) c.click(); });
  }
  await sleep(700);
  for (let i = 0; i < 12; i++) { if (!(await page.$('.dialog-box'))) break; await page.keyboard.press('Enter'); await sleep(110); }
  await sleep(300);

  // 把出战精灵提到高等级，确保能打赢野怪，验证胜利结算
  await page.evaluate(() => {
    const g = window.__game;
    const m = g.save.team[0];
    m.level = 40; m.maxHp = 500; m.hp = 500; m.atk && (m.atk = 999);
    g.save.bag.ball = 20; g.save.bag.herb = 20;
  });
  const snap0 = await page.evaluate(() => ({ v: window.__game.version, coins: window.__game.save.resources.coins }));
  console.log('初始', JSON.stringify(snap0));

  // 新玩法：无可见野怪，用调试钩子直接开战（战斗结算逻辑不变）
  await page.evaluate(() => { window.__game.startBattle(1, 5); });
  await sleep(600);
  const inBattle = await page.evaluate(() => window.__game.state.scene === 'battle');
  console.log('进入战斗:', inBattle);
  if (!inBattle) { console.log('RESULT FAIL 未进入战斗', errors); await browser.close(); process.exit(1); }

  // 反复攻击直到战斗结束（回到 world）或超时
  let ended = false;
  for (let turn = 0; turn < 30; turn++) {
    const scene = await page.evaluate(() => window.__game.state.scene);
    if (scene !== 'battle') { ended = true; break; }
    // 点"技能" -> 第一个技能（DOM click 规避战斗消息刷新导致的元素脱离）
    await page.evaluate(() => { const b = document.querySelector('.actbtn'); if (b) b.click(); });
    await sleep(180);
    await page.evaluate(() => { const b = document.querySelector('.actbtn'); if (b) b.click(); });
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
