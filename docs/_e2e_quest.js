/* E2E：任务系统 - 面板渲染 / 进度推导 / 权威领奖 / 防重复领取 / 零错误 */
const { chromium } = require('C:/Users/Administrator/Desktop/REA测试/node_modules/playwright-core');
const path = require('path');
const OUT = path.resolve(__dirname, '../.chrome-e2e');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 950 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGE: ' + String(e)));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errors.push('CONSOLE: ' + m.text()); });

  await page.goto('http://localhost:5180/', { waitUntil: 'networkidle' });
  await sleep(500);
  const user = '任务验证' + Date.now();
  await page.fill('.login-input', user);
  await page.click('.bigbtn.primary');
  await sleep(300);
  const enters = await page.$$('.bigbtn.primary');
  if (enters.length) await enters[enters.length - 1].click();
  await sleep(1500);
  for (let i = 0; i < 4; i++) { await page.keyboard.press('Enter'); await sleep(80); }
  await sleep(300);

  // 读取初始存档状态
  const before = await page.evaluate(() => {
    const g = window.__game;
    return { coins: g.save.resources.coins, ball: g.save.bag.ball, herb: g.save.bag.herb,
      version: g.version, steps: g.save.profile.steps };
  });
  console.log('BEFORE', JSON.stringify(before));

  // 人为把进度推到完成"启程的第一步"(30步) 和 "初次对战"(1胜)，模拟真实游玩
  await page.evaluate(() => {
    const g = window.__game;
    g.save.profile.steps = 35;
    g.save.profile.wins = 1;
    g.save.profile.battles = 1;
    g.onSaveDirty(); // 触发防抖提交，让存档落库（新用户首次登录本地存档尚未提交）
  });
  await sleep(1200); // 等存档提交完成
  const saved = await page.evaluate(() => window.__game.version);
  console.log('SAVED_VERSION', saved);

  // 打开任务面板（右上角"任务"按钮）
  await page.click('.hud-quest');
  await sleep(400);
  const panelInfo = await page.evaluate(() => ({
    cards: document.querySelectorAll('.quest-card').length,
    ready: document.querySelectorAll('.quest-card.ready').length,
    claimBtns: document.querySelectorAll('.quest-claim').length,
    title: document.querySelector('.panel-head h2')?.textContent || ''
  }));
  await page.screenshot({ path: path.join(OUT, 'quest_01_panel.png') });
  console.log('PANEL', JSON.stringify(panelInfo));

  // 领取"启程的第一步"（第一个可领取按钮）
  const claimBtns = await page.$$('.quest-claim');
  await claimBtns[0].click();
  await sleep(700);
  const afterClaim = await page.evaluate(() => {
    const g = window.__game;
    return { coins: g.save.resources.coins, ball: g.save.bag.ball, herb: g.save.bag.herb,
      version: g.version, claimed: g.save.progress.flags.filter(f => f.startsWith('quest:')) };
  });
  console.log('AFTER_CLAIM', JSON.stringify(afterClaim));

  // 重复领取测试：直接调 API 再领同一个任务，应返回错误码 3003
  const dupCheck = await page.evaluate(async () => {
    const token = localStorage.getItem('jingling_token');
    const r = await fetch('/api/game/quest/claim', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ questId: 'first_steps' })
    });
    return r.json();
  });
  console.log('DUPLICATE', JSON.stringify(dupCheck));

  // 未完成任务领取测试：collector (8种) 应被拒 3001
  const incompleteCheck = await page.evaluate(async () => {
    const token = localStorage.getItem('jingling_token');
    const r = await fetch('/api/game/quest/claim', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ questId: 'collector' })
    });
    return r.json();
  });
  console.log('INCOMPLETE', JSON.stringify(incompleteCheck));

  await page.screenshot({ path: path.join(OUT, 'quest_02_after_claim.png') });

  // 刷新页面后从服务端读回，确认领取状态持久化
  await page.reload({ waitUntil: 'networkidle' });
  await sleep(1800);
  const afterReload = await page.evaluate(() => {
    const g = window.__game;
    if (!g) return { coins: -1, version: -1, claimed: [], noGame: true };
    return { coins: g.save.resources.coins, version: g.version,
      claimed: g.save.progress.flags.filter(f => f.startsWith('quest:')) };
  });
  console.log('AFTER_RELOAD', JSON.stringify(afterReload));

  const pass =
    panelInfo.cards >= 7 && panelInfo.ready >= 2 &&
    afterClaim.coins > before.coins && afterClaim.version > before.version &&
    afterClaim.claimed.length >= 1 &&
    dupCheck.code === 3003 && incompleteCheck.code === 3001 &&
    afterReload.claimed.length >= 1 && afterReload.coins === afterClaim.coins &&
    errors.length === 0;
  console.log('RESULT', JSON.stringify({ pass, errors }));
  await browser.close();
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
