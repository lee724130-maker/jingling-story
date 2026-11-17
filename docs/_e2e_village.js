/* E2E：新手村系统 - 无野怪 / 三选一主宠 / 商店购买 / 场景切换（出口往返）/ 防作弊 */
const { chromium } = require('C:/Users/Administrator/Desktop/REA测试/node_modules/playwright-core');
const path = require('path');
const OUT = path.resolve(__dirname, '../.chrome-e2e');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = [];
function check(name, cond, extra) { R.push({ name, pass: !!cond, extra }); console.log((cond ? 'PASS ' : 'FAIL ') + name, extra ? JSON.stringify(extra) : ''); }

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 950 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGE: ' + String(e)));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errors.push('CONSOLE: ' + m.text()); });

  await page.goto('http://localhost:5180/', { waitUntil: 'domcontentloaded' });
  await sleep(500);
  const user = '村庄验证' + Date.now();
  await page.fill('.login-input', user);
  await page.click('.bigbtn.primary');
  await sleep(300);
  const enters = await page.$$('.bigbtn.primary');
  if (enters.length) await enters[enters.length - 1].click();
  await sleep(1600);
  for (let i = 0; i < 5; i++) { await page.keyboard.press('Enter'); await sleep(90); }
  await sleep(400);
  // 新账号本地存档首次需落库，否则后端选宠/购买会报"存档不存在"
  await page.evaluate(() => window.__game.onSaveDirty());
  await sleep(1200);

  // 1) 新账号：空队伍、在青芽村、无野怪
  const s0 = await page.evaluate(() => {
    const g = window.__game;
    return { map: g.save.progress.map, team: g.save.team.length, wilds: g.state.wilds.length,
      needStarter: g.save.progress.flags.includes('story:need_starter'), coins: g.save.resources.coins };
  });
  check('新账号在青芽村', s0.map === 'qingya', s0);
  check('新账号队伍为空', s0.team === 0);
  check('新手村无野怪', s0.wilds === 0);
  check('标记待选主宠', s0.needStarter === true);
  await page.screenshot({ path: path.join(OUT, 'village_01_start.png') });

  // 2) 村长对话触发三选一：直接调引擎 NPC 交互回调（等价于走到村长旁按空格）
  await page.evaluate(() => {
    const g = window.__game;
    const npc = g.map.npcs.find(n => n.role === 'elder');
    g.onNpcInteract(npc);
  });
  await sleep(300);
  // 推进对话到结束，触发选宠面板
  for (let i = 0; i < 5; i++) { await page.keyboard.press('Enter'); await sleep(100); }
  await sleep(400);
  const starterShown = await page.evaluate(() => !!document.querySelector('.starter-grid'));
  check('村长对话后弹出三选一', starterShown);
  await page.screenshot({ path: path.join(OUT, 'village_02_starter.png') });

  // 选第二只（潮泡兽 species=3）
  const cards = await page.$$('.starter-card');
  await cards[1].click();
  await sleep(150);
  const confirm = await page.$('.starter-confirm');
  await confirm.click();
  await sleep(800);
  for (let i = 0; i < 4; i++) { await page.keyboard.press('Enter'); await sleep(80); }
  const s1 = await page.evaluate(() => {
    const g = window.__game;
    return { team: g.save.team.length, species: g.save.team[0]?.species,
      chosen: g.save.progress.flags.includes('story:starter_chosen'),
      needStarter: g.save.progress.flags.includes('story:need_starter'), version: g.version };
  });
  check('选宠后队伍有1只', s1.team === 1, s1);
  check('选宠物种正确(潮泡兽=3)', s1.species === 3);
  check('主线标记已选', s1.chosen === true && s1.needStarter === false);

  // 防重复选宠：直接调 API 再选一次应失败 3003
  const dupStarter = await page.evaluate(async () => {
    const token = localStorage.getItem('jingling_token');
    const r = await fetch('/api/game/starter/choose', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ species: 1, gender: 'male' }) });
    return r.json();
  });
  check('防重复选宠(3003)', dupStarter.code === 3003, dupStarter);

  // 3) 商店购买：打开商店，买灵兽球×5（单价20=100，但初始只有100金币，刚选宠没花钱）
  await page.evaluate(() => {
    const g = window.__game;
    const npc = g.map.npcs.find(n => n.role === 'shop');
    g.onNpcInteract(npc);
  });
  await sleep(300);
  const shopShown = await page.evaluate(() => !!document.querySelector('.shop-list'));
  check('商店面板打开', shopShown);
  await page.screenshot({ path: path.join(OUT, 'village_03_shop.png') });
  // 通过 UI 点击购买活力草×1（单价15），走 handleBuy 正常同步存档
  const buyBtns = await page.$$('.shop-buy');
  await buyBtns[1].click(); // 第二个商品=活力草
  await sleep(700);
  const afterBuy = await page.evaluate(() => {
    const g = window.__game;
    return { coins: g.save.resources.coins, herb: g.save.bag.herb };
  });
  check('商店购买成功扣款', afterBuy.coins === 85, afterBuy);
  check('活力草增加', afterBuy.herb === 4, afterBuy);

  // 金币不足测试
  const poor = await page.evaluate(async () => {
    const token = localStorage.getItem('jingling_token');
    const r = await fetch('/api/game/shop/buy', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ item: 'ball', count: 10 }) });
    return r.json();
  });
  check('金币不足拒绝(3001)', poor.code === 3001, poor);
  await page.evaluate(() => document.querySelector('.iconbtn')?.click()); // 关商店
  await sleep(200);

  // 4) 场景切换：用引擎 switchMap 切到草原
  await page.evaluate(() => window.__game.switchMap('grassland'));
  await sleep(700);
  const s2 = await page.evaluate(() => {
    const g = window.__game;
    return { map: g.save.progress.map, wilds: g.state.wilds.length };
  });
  check('切换到大草原', s2.map === 'grassland', s2);
  check('大草原出现野怪', s2.wilds === 6);
  await page.screenshot({ path: path.join(OUT, 'village_04_grassland.png') });

  // 5) 返回新手村：野怪清空
  await page.evaluate(() => window.__game.switchMap('qingya'));
  await sleep(700);
  const s3 = await page.evaluate(() => {
    const g = window.__game;
    return { map: g.save.progress.map, wilds: g.state.wilds.length };
  });
  check('返回青芽村', s3.map === 'qingya', s3);
  check('回村后野怪清空', s3.wilds === 0);
  await page.screenshot({ path: path.join(OUT, 'village_05_back.png') });

  // 6) 刷新持久化：存档 map / 队伍 / 主线标记保持
  await sleep(900); // 等防抖提交
  await page.reload({ waitUntil: 'domcontentloaded' });
  await sleep(2000);
  const s4 = await page.evaluate(() => {
    const g = window.__game;
    if (!g) return { noGame: true };
    return { map: g.save.progress.map, team: g.save.team.length,
      chosen: g.save.progress.flags.includes('story:starter_chosen'), coins: g.save.resources.coins };
  });
  check('刷新后状态持久化', s4.map === 'qingya' && s4.team === 1 && s4.chosen && s4.coins === 85, s4);

  check('零页面错误', errors.length === 0, errors);
  const pass = R.every(r => r.pass);
  console.log('RESULT', JSON.stringify({ pass, total: R.length, passed: R.filter(r => r.pass).length, errors }));
  await browser.close();
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
