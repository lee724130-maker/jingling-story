/* E2E：AI 写实训练师立绘落地（方案③）
 * 验证：高清立绘资源 200 / 标题选性别显示 / 对话头像 / 选宠界面立绘 / 训练师名片立绘+战绩 / 男女立绘切换 / 零错误 */
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
  const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
  const errors = [];
  const imgReqs = [];
  page.on('pageerror', e => errors.push('PAGE: ' + String(e)));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errors.push('CONSOLE: ' + m.text()); });
  page.on('response', r => { if (r.url().includes('_hd.png')) imgReqs.push({ url: r.url().split('/').pop(), status: r.status() }); });

  await page.goto('http://localhost:5180/', { waitUntil: 'domcontentloaded' });
  await sleep(600);

  // 1) 标题：输入名字 → 选性别阶段，应出现高清男主立绘
  await page.fill('.login-input', '立绘验证' + Date.now());
  await page.click('.bigbtn.primary');
  await sleep(400);
  const titlePortrait = await page.evaluate(() => {
    const img = document.querySelector('.trainer-preview img');
    return img ? { src: img.getAttribute('src'), w: img.naturalWidth, complete: img.complete } : null;
  });
  check('标题选性别显示高清男主立绘', titlePortrait && titlePortrait.src.includes('trainer_male_hd.png'), titlePortrait);

  // 2) 切到女主，立绘应切换
  const femaleBtns = await page.$$('.title-actions .bigbtn');
  for (const b of femaleBtns) { const t = await b.textContent(); if (t && t.includes('女生')) { await b.click(); break; } }
  await sleep(300);
  const femalePortrait = await page.evaluate(() => {
    const img = document.querySelector('.trainer-preview img');
    return img ? img.getAttribute('src') : null;
  });
  check('切换女生立绘为女主图', femalePortrait && femalePortrait.includes('trainer_female_hd.png'), { femalePortrait });

  // 3) 用女主进入游戏
  let enters = await page.$$('.bigbtn.primary');
  if (enters.length) await enters[enters.length - 1].click();
  await sleep(1600);

  // 4) 欢迎对话应有玩家立绘头像（女主）
  const dialogPortrait = await page.evaluate(() => {
    const img = document.querySelector('.dialog-portrait');
    return img ? { src: img.getAttribute('src'), w: img.naturalWidth } : null;
  });
  check('欢迎对话显示女主头像', dialogPortrait && dialogPortrait.src.includes('trainer_female_hd.png'), dialogPortrait);

  // 5) 与村长交互打开选宠界面（E2E 直接调引擎回调，无需真的走过去），选宠界面应有训练师立绘
  // 先走完欢迎对话（用点击推进，最可靠）
  for (let i = 0; i < 8; i++) { const d = await page.$('.dialog'); if (!d) break; await d.click(); await sleep(150); }
  await sleep(200);
  // 触发村长对话（needStarter 时对话结束会自动打开选宠）
  await page.evaluate(() => {
    const g = window.__game;
    g.onNpcInteract({ id: 'elder', name: '村长 木老', role: 'elder', x: 13, y: 5, lines: ['年轻的冒险家，选一只伙伴开始旅途吧。'] });
  });
  await sleep(250);
  for (let i = 0; i < 8; i++) {
    const d = await page.$('.dialog');
    if (!d) break;
    await d.click();
    await sleep(150);
  }
  await sleep(500);
  const starterVisible = await page.$('.starter-box');
  const starterPortrait = await page.evaluate(() => {
    const img = document.querySelector('.starter-trainer');
    return img ? { src: img.getAttribute('src'), w: img.naturalWidth } : null;
  });
  check('选宠界面显示训练师立绘', !!starterVisible && starterPortrait && starterPortrait.w > 0, { starterVisible: !!starterVisible, starterPortrait });

  // 6) 训练师名片：用已有队伍的老账号 Lee 登录（跳过选宠），开菜单点名片
  const page2 = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
  page2.on('pageerror', e => errors.push('PAGE2: ' + String(e)));
  page2.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errors.push('CONSOLE2: ' + m.text()); });
  await page2.goto('http://localhost:5180/', { waitUntil: 'domcontentloaded' });
  await sleep(600);
  if (await page2.$('.login-input')) {
    await page2.fill('.login-input', 'Lee');
    await page2.click('.bigbtn.primary');
    await sleep(300);
    const es2 = await page2.$$('.bigbtn.primary');
    if (es2.length) await es2[es2.length - 1].click();
    await sleep(1600);
  }
  // 走完欢迎对话
  for (let i = 0; i < 8; i++) { const d = await page2.$('.dialog'); if (!d) break; await d.click(); await sleep(120); }
  await sleep(300);
  await page2.keyboard.press('Escape');
  await sleep(300);
  // 点训练师名片入口
  const items = await page2.$$('.menu-item');
  for (const it of items) { const t = await it.textContent(); if (t && t.includes('训练师名片')) { await it.click(); break; } }
  await sleep(400);
  const profileCard = await page2.evaluate(() => {
    const img = document.querySelector('.profile-portrait-wrap img');
    const stats = document.querySelectorAll('.profile-stats>div');
    return { img: img ? { src: img.getAttribute('src'), w: img.naturalWidth } : null, stats: stats.length, title: document.querySelector('.profile-info h3')?.textContent };
  });
  check('训练师名片显示立绘+6项战绩', profileCard.img && profileCard.img.w > 0 && profileCard.stats === 6, profileCard);
  await page2.screenshot({ path: path.join(OUT, 'portrait_profile.png') });
  await page2.close();
  await page.close();

  // 7) 立绘资源请求全部 200
  const allOk = imgReqs.length > 0 && imgReqs.every(r => r.status === 200);
  check('高清立绘资源全部 200', allOk, imgReqs);

  // 8) 零页面错误
  check('零页面错误', errors.length === 0, errors.slice(0, 5));

  await browser.close();
  const pass = R.filter(r => r.pass).length;
  console.log(`\n===== ${pass}/${R.length} PASS =====`);
  process.exit(pass === R.length ? 0 : 1);
})().catch(e => { console.error('E2E 崩溃:', e); process.exit(2); });
