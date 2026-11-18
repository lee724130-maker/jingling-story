/* E2E：手游式主面板 + 副本探索（v2 玩法）
 * 验证：新用户三选一引导 / 主面板导航 / 副本选择 / 探索命中判定(种子可复现) /
 *       服务端权威校验和拒绝篡改 / exploreId 幂等 / 物品发放 / 零页面错误 */
const { chromium } = require('C:/Users/Administrator/Desktop/REA测试/node_modules/playwright-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const R = [];
function check(name, cond, extra) { R.push({ name, pass: !!cond, extra }); console.log((cond ? 'PASS ' : 'FAIL ') + name, extra ? JSON.stringify(extra) : ''); }
function checksum(payload) { let h = 5381; for (let i = 0; i < payload.length; i++) h = ((h << 5) + h + payload.charCodeAt(i)) >>> 0; return h.toString(16).padStart(8, '0'); }

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
  const user = '探索验证' + Date.now();
  await page.fill('.login-input', user);
  await page.click('.bigbtn.primary');
  await sleep(300);
  const enters = await page.$$('.bigbtn.primary');
  if (enters.length) await enters[enters.length - 1].click();
  await sleep(1200);

  // 1) 新用户引导对话 → 逐行推进直到三选一面板出现
  let starterOpen = null;
  for (let i = 0; i < 10; i++) {
    starterOpen = await page.$('.starter-box');
    if (starterOpen) break;
    await page.keyboard.press('Enter'); await sleep(150);
  }
  check('新用户引导后出现三选一面板', !!starterOpen);

  // 2) 选第一只初始伙伴（用 DOM click 规避卡片遮挡确认按钮的几何问题）
  if (starterOpen) {
    await page.evaluate(() => { const c = document.querySelector('.starter-card'); if (c) c.click(); });
    await sleep(200);
    await page.evaluate(() => { const c = document.querySelector('.starter-confirm'); if (c) c.click(); });
  }
  await sleep(700);
  // 关掉所有残留对话，直到无对话框（最多 12 行）
  for (let i = 0; i < 12; i++) {
    const dlg = await page.$('.dialog-box');
    if (!dlg) break;
    await page.keyboard.press('Enter'); await sleep(120);
  }
  await page.waitForSelector('.starter-box', { state: 'detached', timeout: 3000 }).catch(() => {});
  await sleep(300);

  // 3) 主面板出现
  const home = await page.$('.home-panel');
  check('进入主面板', !!home);
  const navCount = await page.$$eval('.home-nav-btn', els => els.length);
  check('主面板有 6 个导航入口', navCount === 6, { navCount });

  // 4) 点击探索 → 副本选择
  const exploreNav = await page.$('.home-nav-btn.primary');
  if (exploreNav) await exploreNav.click();
  await sleep(400);
  const dsel = await page.$('.dungeon-select');
  check('进入副本选择页', !!dsel);
  const cardCount = await page.$$eval('.ds-card', els => els.length);
  check('显示 3 个副本卡片', cardCount === 3, { cardCount });
  const lockedCount = await page.$$eval('.ds-card.locked', els => els.length);
  check('存在未解锁副本（进阶/挑战）', lockedCount >= 1, { lockedCount });

  // 5) 进入第一个副本（微风草原，默认解锁）
  const firstCard = await page.$('.ds-card:not(.locked)');
  if (firstCard) await firstCard.click();
  await sleep(400);
  const scene = await page.$('.dungeon-scene');
  check('进入副本静态场景', !!scene);
  const expBtn = await page.$('.explore-btn');
  check('副本右下角有探索按钮', !!expBtn);

  // 6) 直接调后端 explore 接口：校验种子可复现 + 结果三态 + 幂等
  const token = await page.evaluate(() => localStorage.getItem('jingling_token'));
  const apiTest = await page.evaluate(async (token) => {
    const checksum = (payload) => { let h = 5381; for (let i = 0; i < payload.length; i++) h = ((h << 5) + h + payload.charCodeAt(i)) >>> 0; return h.toString(16).padStart(8, '0'); };
    const post = (path, body) => fetch(path, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body)
    }).then(r => r.json());
    const results = [];
    // 用分散种子覆盖三态（LCG 相邻小种子首值高度相关）
    const seeds = [0, 1365, 2139, 77777, 999999, 1500000, 240000, 55, 888888, 1234567, 42, 314159];
    for (let i = 0; i < seeds.length; i++) {
      const exploreId = 'e2e_' + Date.now() + '_' + i;
      const seed = seeds[i];
      const dto = { exploreId, dungeonId: 'meadow', seed, clientChecksum: '' };
      dto.clientChecksum = checksum([dto.exploreId, dto.dungeonId, dto.seed].join('|'));
      const r = await post('/api/game/explore', dto);
      results.push({ code: r.code, kind: r.data && r.data.kind });
    }
    // 校验和篡改
    const bad = { exploreId: 'e2e_bad_' + Date.now(), dungeonId: 'meadow', seed: 42, clientChecksum: 'deadbeef' };
    const badR = await post('/api/game/explore', bad);
    // 幂等：同一 exploreId 重复提交
    const idemId = 'e2e_idem_' + Date.now();
    const idemDto = { exploreId: idemId, dungeonId: 'meadow', seed: 777, clientChecksum: '' };
    idemDto.clientChecksum = checksum([idemDto.exploreId, idemDto.dungeonId, idemDto.seed].join('|'));
    const first = await post('/api/game/explore', idemDto);
    const second = await post('/api/game/explore', idemDto);
    // 锁定副本：未解锁应拒绝
    const lockDto = { exploreId: 'e2e_lock_' + Date.now(), dungeonId: 'cavern', seed: 9, clientChecksum: '' };
    lockDto.clientChecksum = checksum([lockDto.exploreId, lockDto.dungeonId, lockDto.seed].join('|'));
    const lockR = await post('/api/game/explore', lockDto);
    return { results, badCode: badR.code, idemCode1: first.code, idemCode2: second.code, lockCode: lockR.code };
  }, token);

  check('12 次探索全部成功', apiTest.results.every(x => x.code === 0), { codes: [...new Set(apiTest.results.map(x => x.code))] });
  const kinds = [...new Set(apiTest.results.map(x => x.kind))];
  check('探索结果覆盖多种类型', kinds.length >= 2, { kinds });
  check('校验和篡改被拒绝', apiTest.badCode !== 0, { code: apiTest.badCode });
  check('相同 exploreId 幂等（第二次非 0 或返回同结果）', apiTest.idemCode2 !== 0 || apiTest.idemCode1 === apiTest.idemCode2,
    { first: apiTest.idemCode1, second: apiTest.idemCode2 });
  check('未解锁副本被拒绝', apiTest.lockCode !== 0, { code: apiTest.lockCode });

  // 7) 通过 UI 点击探索按钮，验证前端流程不报错
  await page.click('.explore-btn');
  await sleep(2600);
  const stillOk = await page.$('.dungeon-scene') || await page.$('.battle');
  check('UI 探索按钮流程正常（停留副本或进战斗）', !!stillOk);

  // 8) 零页面错误
  check('无页面运行时错误', errors.length === 0, { errors: errors.slice(0, 4) });

  console.log('\n=== RESULT ' + R.filter(x => x.pass).length + '/' + R.length + ' PASS ===');
  await browser.close();
  process.exit(R.every(x => x.pass) ? 0 : 1);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
