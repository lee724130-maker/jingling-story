/* E2E：第三人称 3D 场景验证 */
const { chromium } = require('../tools/playwright-core');
const path = require('path');
const OUT = path.resolve(__dirname, '../.chrome-e2e');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGE: ' + String(e)));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errors.push('CONSOLE: ' + m.text()); });

  await page.goto('http://localhost:5180/', { waitUntil: 'networkidle' });
  await sleep(800);
  await page.screenshot({ path: path.join(OUT, '3d_01_title.png') });

  // 登录
  await page.fill('.login-input', '3D测试' + Date.now());
  await page.click('.bigbtn.primary');
  await sleep(300);
  const enters = await page.$$('.bigbtn.primary');
  if (enters.length) await enters[enters.length - 1].click();
  await sleep(1500);
  for (let i = 0; i < 4; i++) { await page.keyboard.press('Enter'); await sleep(100); }
  await sleep(600);
  await page.screenshot({ path: path.join(OUT, '3d_02_world.png') });

  // 检查 3D canvas 数量与 WebGL 上下文
  const canvasInfo = await page.evaluate(() => {
    const cs = Array.from(document.querySelectorAll('canvas'));
    return cs.map(c => ({ w: c.width, h: c.height, cls: c.className || c.id || '',
      webgl: !!(c.getContext('webgl2') || c.getContext('webgl')) }));
  });
  console.log('CANVASES', JSON.stringify(canvasInfo));

  const p0 = await page.evaluate(() => ({ x: window.__game?.state.player.x, y: window.__game?.state.player.y }));
  // WASD 移动
  await page.keyboard.down('ArrowRight'); await sleep(600); await page.keyboard.up('ArrowRight');
  const p1 = await page.evaluate(() => ({ x: window.__game?.state.player.x, y: window.__game?.state.player.y }));
  console.log('MOVE', JSON.stringify({ p0, p1, moved: p1.x !== p0.x }));
  await page.screenshot({ path: path.join(OUT, '3d_03_moved.png') });

  const wilds = await page.evaluate(() => window.__game?.state.wilds.length || 0);
  console.log('WILDS', wilds);

  // 走近野怪触发战斗
  const moveToward = async (tx, ty) => {
    const p = await page.evaluate(() => ({ x: window.__game.state.player.x, y: window.__game.state.player.y }));
    let key = null;
    if (Math.abs(tx - p.x) >= Math.abs(ty - p.y)) key = tx > p.x ? 'ArrowRight' : 'ArrowLeft';
    else key = ty > p.y ? 'ArrowDown' : 'ArrowUp';
    if (key) { await page.keyboard.down(key); await sleep(110); await page.keyboard.up(key); }
  };
  let inBattle = false, summonSeen = false;
  for (let step = 0; step < 260; step++) {
    const s = await page.evaluate(() => ({ scene: window.__game.state.scene, p: { x: window.__game.state.player.x, y: window.__game.state.player.y }, wilds: window.__game.state.wilds.map(w => ({ x: w.x, y: w.y })) }));
    if (s.scene === 'summon') { if (!summonSeen) { summonSeen = true; await page.screenshot({ path: path.join(OUT, '3d_04_summon.png') }); } await sleep(120); continue; }
    if (s.scene === 'battle') { inBattle = true; break; }
    let best = null, bd = 1e9;
    for (const w of s.wilds) { const d = Math.hypot(w.x - s.p.x, w.y - s.p.y); if (d < bd) { bd = d; best = w; } }
    if (best) await moveToward(best.x, best.y);
    await sleep(30);
  }
  console.log('BATTLE', JSON.stringify({ inBattle, summonSeen }));
  if (inBattle) await page.screenshot({ path: path.join(OUT, '3d_05_battle.png') });

  const has3d = canvasInfo.some(c => c.webgl);
  // 核心断言：3D 渲染 / 移动 / 野怪存在 / 零错误。战斗触发受野怪随机游荡影响，作观察项。
  const pass = has3d && p1.x !== p0.x && wilds > 0 && errors.length === 0;
  console.log('RESULT', JSON.stringify({ pass, has3d, moved: p1.x !== p0.x, wilds, inBattle, summonSeen, errors }));
  await browser.close();
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
