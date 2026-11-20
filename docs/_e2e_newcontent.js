/* 新内容专项 E2E：验证第二世代精灵图集裁切 + 图鉴显示 + 图鉴目标提升
 * 用新账号登录 → 直接提交含新物种图鉴的存档 → 打开图鉴面板断言新精灵头像来源为 spirits2.png */
const { chromium } = require('../tools/playwright-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = [];
function check(name, cond, extra) { R.push({ name, pass: !!cond }); console.log((cond ? 'PASS ' : 'FAIL ') + name, extra ? JSON.stringify(extra) : ''); }

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 950 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGE: ' + String(e)));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errors.push('CONSOLE: ' + m.text()); });

  await page.goto('http://localhost:5180/', { waitUntil: 'domcontentloaded' });
  await sleep(500);
  const user = '新内容验证' + Date.now();
  await page.fill('.login-input', user);
  await page.click('.bigbtn.primary'); await sleep(300);
  const enters = await page.$$('.bigbtn.primary');
  if (enters.length) await enters[enters.length - 1].click();
  await sleep(1200);
  // 过引导 + 选宠
  for (let i = 0; i < 10; i++) { if (await page.$('.starter-box')) break; await page.keyboard.press('Enter'); await sleep(150); }
  await page.evaluate(() => { const c = document.querySelector('.starter-card'); if (c) c.click(); });
  await sleep(200);
  await page.evaluate(() => { const c = document.querySelector('.starter-confirm'); if (c) c.click(); });
  await sleep(700);
  for (let i = 0; i < 12; i++) { const d = await page.$('.dialog-box'); if (!d) break; await page.keyboard.press('Enter'); await sleep(120); }
  await sleep(300);

  // 读当前存档 → 注入新物种到图鉴（seen+caught）→ 提交
  const injected = await page.evaluate(async () => {
    const token = localStorage.getItem('jingling_token');
    const getR = await fetch('/api/player/save', { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json());
    const save = JSON.parse(JSON.stringify(getR.data.data));
    const version = getR.data.version;
    for (const id of [13, 14, 15, 16, 17, 18]) {
      if (!save.pokedex.seen.includes(id)) save.pokedex.seen.push(id);
      if (!save.pokedex.caught.includes(id)) save.pokedex.caught.push(id);
    }
    const submit = await fetch('/api/player/save', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ version, data: save })
    }).then(r => r.json());
    return { ok: submit.code === 0 && !!submit.data, version: submit.data && submit.data.version };
  });
  check('注入新物种图鉴存档成功', injected.ok, injected);
  await sleep(500);

  // 刷新让前端重载权威存档
  await page.reload({ waitUntil: 'domcontentloaded' }); await sleep(1600);
  // 打开图鉴面板（主面板 dex 热点）
  const dexSpot = await page.$('.scene-spot[data-key="dex"], .scene-spot[title^="图鉴"]');
  if (dexSpot) await dexSpot.click();
  else {
    // 兜底：从暂停菜单进
    await page.click('.menu-toggle'); await sleep(300);
    const items = await page.$$('.pause-entry');
    for (const it of items) { const t = await it.textContent(); if (t && t.includes('图鉴')) { await it.click(); break; } }
  }
  await sleep(500);

  const dex = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.dex-card')];
    const rows = cards.map(c => {
      const art = c.querySelector('.spirit-art');
      const st = art ? getComputedStyle(art) : null;
      return {
        name: c.querySelector('.dn')?.textContent,
        bg: st ? st.backgroundImage : null,
        pos: st ? st.backgroundPosition : null,
        locked: c.classList.contains('locked')
      };
    });
    return { total: cards.length, rows };
  });
  check('图鉴总数 18', dex.total === 18, { total: dex.total });
  const newNames = ['焰尾兽', '烈焰狮', '冰晶兽', '冰川兽', '影叶兽', '古树兽'];
  const nameCells = dex.rows.filter(r => newNames.includes(r.name));
  check('6 只新精灵在图鉴中显示名称', nameCells.length === 6, { names: nameCells.map(r => r.name) });
  check('新精灵头像来自 spirits2.png 图集', nameCells.length === 6 && nameCells.every(r => r.bg && r.bg.includes('spirits2.png')),
    { bgs: nameCells.map(r => r.bg) });
  const positions = nameCells.map(r => r.pos);
  check('6 只新精灵各裁自不同格子（6 个不同位置）', new Set(positions).size === 6, { positions });
  check('无页面运行时错误', errors.length === 0, { errors: errors.slice(0, 3) });

  console.log('\n=== NEW CONTENT E2E ' + R.filter(x => x.pass).length + '/' + R.length + ' PASS ===');
  await browser.close();
  process.exit(R.every(x => x.pass) ? 0 : 1);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
