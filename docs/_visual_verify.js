/* 视觉验收截图：图鉴面板（新精灵真实素材）+ 副本选择页（新场景图） */
const { chromium } = require('../tools/playwright-core');
const path = require('path');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const OUT = path.join(__dirname, '..', 'web', 'public', 'art');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 950 } });
  await page.goto('http://localhost:5180/', { waitUntil: 'domcontentloaded' });
  await sleep(500);
  const user = '视觉验收' + Date.now();
  await page.fill('.login-input', user);
  await page.click('.bigbtn.primary'); await sleep(300);
  const enters = await page.$$('.bigbtn.primary');
  if (enters.length) await enters[enters.length - 1].click();
  await sleep(1200);
  for (let i = 0; i < 10; i++) { if (await page.$('.starter-box')) break; await page.keyboard.press('Enter'); await sleep(150); }
  await page.evaluate(() => { const c = document.querySelector('.starter-card'); if (c) c.click(); });
  await sleep(200);
  await page.evaluate(() => { const c = document.querySelector('.starter-confirm'); if (c) c.click(); });
  await sleep(700);
  for (let i = 0; i < 12; i++) { const d = await page.$('.dialog-box'); if (!d) break; await page.keyboard.press('Enter'); await sleep(120); }
  await sleep(300);

  // 注入新物种图鉴
  await page.evaluate(async () => {
    const token = localStorage.getItem('jingling_token');
    const getR = await fetch('/api/player/save', { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json());
    const save = JSON.parse(JSON.stringify(getR.data.data));
    for (const id of [13, 14, 15, 16, 17, 18]) {
      if (!save.pokedex.seen.includes(id)) save.pokedex.seen.push(id);
      if (!save.pokedex.caught.includes(id)) save.pokedex.caught.push(id);
    }
    await fetch('/api/player/save', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ version: getR.data.version, data: save })
    });
  });
  await page.reload({ waitUntil: 'domcontentloaded' }); await sleep(1600);

  // 打开图鉴（暂停菜单入口）
  await page.click('.menu-toggle'); await sleep(300);
  for (const it of await page.$$('.pause-entry')) {
    const t = await it.textContent();
    if (t && t.includes('图鉴')) { await it.click(); break; }
  }
  await sleep(500);
  const dexPanel = await page.$('.panel');
  if (dexPanel) {
    await page.evaluate(() => { const b = document.querySelector('.panel-body'); if (b) b.scrollTop = b.scrollHeight; });
    await sleep(300);
    await dexPanel.screenshot({ path: path.join(OUT, '_verify_dex.png') });
  }
  console.log('图鉴截图已保存');

  // 关闭面板 → 主面板 → 副本选择页
  await page.keyboard.press('Escape'); await sleep(300);
  const closeBtn = await page.$('.panel-head .iconbtn');
  if (closeBtn) await closeBtn.click();
  await sleep(300);
  const exploreNav = await page.$('.scene-spot.primary');
  if (exploreNav) await exploreNav.click();
  await sleep(500);
  const dsel = await page.$('.dungeon-select');
  if (dsel) {
    await page.evaluate(() => { const b = document.querySelector('.dungeon-select'); if (b) b.scrollTop = b.scrollHeight; });
    await sleep(300);
    await dsel.screenshot({ path: path.join(OUT, '_verify_dungeons.png') });
  }
  console.log('副本选择页截图已保存');

  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
