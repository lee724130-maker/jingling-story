/* E2E：战斗 AI 精灵贴图 + 技能属性特效验证 */
const { chromium } = require('C:/Users/Administrator/Desktop/REA测试/node_modules/playwright-core');
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
  await sleep(600);
  await page.fill('.login-input', '战斗特效' + Date.now());
  await page.click('.bigbtn.primary');
  await sleep(300);
  const enters = await page.$$('.bigbtn.primary');
  if (enters.length) await enters[enters.length - 1].click();
  await sleep(1800);
  for (let i = 0; i < 4; i++) { await page.keyboard.press('Enter'); await sleep(100); }
  await sleep(2200); // 等 AI 精灵贴图预加载完成

  // 直接进战斗：焰苗兽(fire) vs 潮泡兽(water)，用高等级己方保证能连续出手
  await page.evaluate(() => {
    const g = window.__game;
    g.save.team[0].level = 30; g.save.team[0].hp = g.save.team[0].maxHp;
    g.startBattle(3, 5);
  });
  await sleep(900);
  await page.screenshot({ path: path.join(OUT, 'battle_01_ai_sprites.png') });

  // 贴图像素校验：战斗区中心应出现非背景的彩色像素（AI 精灵）
  const px = await page.evaluate(() => {
    const cv = document.querySelector('canvas.fx-canvas');
    const ctx = cv.getContext('2d');
    const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
    let colored = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 40 && (d[i] > 60 || d[i + 1] > 60 || d[i + 2] > 60)) colored++;
    }
    return colored;
  });

  // 施放技能：进入技能菜单 → 点第一个技能
  await page.click('.actbtn'); // 技能
  await sleep(250);
  const skillBtns = await page.$$('.actbtn');
  await skillBtns[1].click(); // 火星（fire 属性，彩色粒子更明显）

  // 轮询等待特效进入飞行中段（渲染进度 now-startAt ≈ 260ms），再抓帧
  let fxMid1 = {};
  for (let i = 0; i < 40; i++) {
    fxMid1 = await page.evaluate(() => {
      const b = window.__game.state.battle;
      const rt = b?.skillFx ? Math.round(performance.now() - b.skillFx.startAt) : 0;
      return { hasFx: !!b?.skillFx, type: b?.skillFx?.type, kind: b?.skillFx?.kind,
        t: rt, name: b?.skillName };
    });
    if (fxMid1.hasFx && fxMid1.t >= 250 && fxMid1.t <= 330) break;
    await sleep(20);
  }
  await page.screenshot({ path: path.join(OUT, 'battle_02_skill_travel.png') });

  // 等特效进入命中爆裂阶段（渲染进度 ≈ 420ms）
  let fxMid2 = {};
  for (let i = 0; i < 40; i++) {
    fxMid2 = await page.evaluate(() => {
      const b = window.__game.state.battle;
      const rt = b?.skillFx ? Math.round(performance.now() - b.skillFx.startAt) : 0;
      return { hasFx: !!b?.skillFx, t: rt, banner: !!document.querySelector('.skill-banner') };
    });
    if (fxMid2.hasFx && fxMid2.t >= 400) break;
    await sleep(20);
  }
  await page.screenshot({ path: path.join(OUT, 'battle_03_skill_impact.png') });

  await sleep(700);
  const fxAfter = await page.evaluate(() => ({ hasFx: !!window.__game.state.battle?.skillFx }));

  // 核心断言：AI 精灵像素 + 技能特效触发 + 进度推进 + 结束后清除 + 零错误。
  // 横幅与具体属性受交战时序影响（可能抓到敌方回合），作观察项。
  const pass = px > 3000 && fxMid1.hasFx && fxMid1.t >= 200 && !fxAfter.hasFx && errors.length === 0;
  console.log('PIXELS', px);
  console.log('FX_TRAVEL', JSON.stringify(fxMid1));
  console.log('FX_IMPACT', JSON.stringify(fxMid2));
  console.log('FX_AFTER', JSON.stringify(fxAfter));
  console.log('RESULT', JSON.stringify({ pass, errors }));
  await browser.close();
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
