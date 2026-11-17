/* E2E：点击移动 + 3D 人物模型 + 小跑 + 点击 NPC 交互
 * 验证：hero.glb 加载 / setMoveTarget 寻路 / walking 状态 / 小跑更快 / Shift / NPC 点击回调 / 真实鼠标点地面 / 零错误 */
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
  const modelReqs = [];
  page.on('pageerror', e => errors.push('PAGE: ' + String(e)));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errors.push('CONSOLE: ' + m.text()); });
  page.on('response', r => { if (r.url().includes('/models/characters/')) modelReqs.push({ url: r.url().split('/').pop(), status: r.status() }); });

  await page.goto('http://localhost:5180/', { waitUntil: 'domcontentloaded' });
  await sleep(500);
  const user = '交互验证' + Date.now();
  await page.fill('.login-input', user);
  await page.click('.bigbtn.primary');
  await sleep(300);
  const enters = await page.$$('.bigbtn.primary');
  if (enters.length) await enters[enters.length - 1].click();
  await sleep(1800);
  for (let i = 0; i < 5; i++) { await page.keyboard.press('Enter'); await sleep(90); }
  await sleep(500);

  // 1) 3D 人物模型加载成功（hero.glb 200）
  const heroOk = modelReqs.some(r => r.url === 'hero.glb' && r.status === 200);
  check('3D 人物模型 hero.glb 加载', heroOk, modelReqs);

  // 2) 引擎 API 寻路：设置目标后玩家坐标改变，walking 曾为 true
  const walkRes = await page.evaluate(async () => {
    const g = window.__game;
    const p0 = { x: g.state.player.x, y: g.state.player.y };
    g.setMoveTarget(p0.x + 60, p0.y); // 向右 60px
    await new Promise(r => setTimeout(r, 700));
    const p1 = { x: g.state.player.x, y: g.state.player.y };
    return { p0, p1, moved: Math.hypot(p1.x - p0.x, p1.y - p0.y) };
  });
  check('点击寻路玩家发生位移', walkRes.moved > 8, walkRes);

  // 3) 小跑比走路快（相同时间、相同距离目标）
  const speedRes = await page.evaluate(async () => {
    const g = window.__game;
    const reset = () => {
      g.clearMoveTarget();
      const st = g.findStart();
      g.state.player.x = st.x * 32 + 16; g.state.player.y = st.y * 32 + 12;
    };
    // headless 下大模型帧率不稳，用「位移/帧数」归一化比较每帧速度，消除帧率波动。
    // 目标设 100px（不撞墙），窗口 600ms。
    reset(); let p0 = { x: g.state.player.x, y: g.state.player.y };
    let f0 = g.getFrame();
    g.setMoveTarget(p0.x + 100, p0.y, false);
    await new Promise(r => setTimeout(r, 600));
    const walkD = Math.abs(g.state.player.x - p0.x), walkF = g.getFrame() - f0;
    // 小跑
    reset(); p0 = { x: g.state.player.x, y: g.state.player.y };
    f0 = g.getFrame();
    g.setMoveTarget(p0.x + 100, p0.y, true);
    await new Promise(r => setTimeout(r, 600));
    const runD = Math.abs(g.state.player.x - p0.x), runF = g.getFrame() - f0;
    g.clearMoveTarget();
    const walkSpeed = walkD / Math.max(1, walkF), runSpeed = runD / Math.max(1, runF);
    return { walkD, runD, walkF, runF, walkSpeed, runSpeed };
  });
  check('小跑速度 > 走路速度(每帧归一化)', speedRes.runSpeed > speedRes.walkSpeed * 1.2, speedRes);

  // 4) Shift 键设置小跑状态
  const shiftRes = await page.evaluate(() => {
    const g = window.__game;
    g.setMoveTarget(g.state.player.x + 40, g.state.player.y, false);
    return { before: g.running };
  });
  await page.keyboard.down('Shift');
  await sleep(120);
  const shiftOn = await page.evaluate(() => window.__game.running);
  await page.keyboard.up('Shift');
  await sleep(120);
  await page.evaluate(() => window.__game.clearMoveTarget());
  check('Shift 键切换小跑状态', shiftOn === true, { shiftRes, shiftOn });

  // 5) 点击 NPC 触发交互回调（直接调引擎 onNpcInteract 验证 UI 链路）
  await page.evaluate(() => {
    const g = window.__game;
    const npc = g.map.npcs.find(n => n.role === 'shop');
    g.onNpcInteract(npc);
  });
  await sleep(400);
  const npcUi = await page.evaluate(() => !!document.querySelector('.shop-list'));
  check('点击 NPC 触发商店交互', npcUi);
  await page.evaluate(() => document.querySelector('.iconbtn')?.click());
  await sleep(200);

  // 6) 真实鼠标点击 3D Canvas 触发寻路（点击画面上部地面）
  const canvasClick = await page.evaluate(async () => {
    const g = window.__game;
    const before = { x: g.state.player.x, y: g.state.player.y };
    return { before };
  });
  const box = await page.locator('canvas').first().boundingBox();
  if (box) {
    // 点击画面中央偏下（地面区域，避开 NPC/出口）
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.62);
    await sleep(700);
  }
  const afterClick = await page.evaluate(() => ({ x: window.__game.state.player.x, y: window.__game.state.player.y }));
  check('真实鼠标点地面触发寻路', Math.hypot(afterClick.x - canvasClick.before.x, afterClick.y - canvasClick.before.y) > 3,
    { before: canvasClick.before, after: afterClick });

  await page.screenshot({ path: path.join(OUT, 'interact_01_village.png') });

  check('零页面错误', errors.length === 0, errors);
  const pass = R.every(r => r.pass);
  console.log('RESULT', JSON.stringify({ pass, total: R.length, passed: R.filter(r => r.pass).length, errors }));
  await browser.close();
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
