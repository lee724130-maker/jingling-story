/* 服务端权威结算验证脚本（临时）
 * 覆盖：正常胜利/捕获结算、篡改校验和、伪造高等级、重复结算、存档 version 递增 */
const http = require('http');

const HOST = 'localhost', PORT = 3000;
function post(path, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const headers = { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) };
    if (token) headers.Authorization = 'Bearer ' + token;
    const req = http.request({ host: HOST, port: PORT, path, method: 'POST', headers }, res => {
      let buf = ''; res.on('data', c => buf += c); res.on('end', () => { try { resolve(JSON.parse(buf)); } catch { resolve(buf); } });
    });
    req.on('error', reject); req.write(data); req.end();
  });
}
function get(path, token) {
  return new Promise((resolve, reject) => {
    const headers = { Authorization: 'Bearer ' + token };
    const req = http.request({ host: HOST, port: PORT, path, method: 'GET', headers }, res => {
      let buf = ''; res.on('data', c => buf += c); res.on('end', () => { try { resolve(JSON.parse(buf)); } catch { resolve(buf); } });
    });
    req.on('error', reject); req.end();
  });
}
function checksum(payload) {
  let h = 5381;
  for (let i = 0; i < payload.length; i++) h = ((h << 5) + h + payload.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}

(async () => {
  const results = [];
  const check = (name, cond, detail) => { results.push({ name, pass: !!cond, detail }); console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name + (detail ? ' | ' + detail : '')); };

  const uname = '结算验证_' + Date.now();
  const login = await post('/api/auth/login', { username: uname });
  const token = login.data.token;
  check('登录成功', login.code === 0, 'uid=' + login.data.uid);

  let sv = await get('/api/player/save', token);
  check('新账号未建存档 version=0', sv.data.version === 0);
  // 模拟前端 createNewSave 后提交初始存档（version 0）
  const initSave = {
    meta: { configVersion: 1, createdAt: Date.now(), playSeconds: 0 },
    profile: { name: '结算测试', gender: 'male', steps: 0, battles: 0, wins: 0 },
    resources: { coins: 100, gems: 0 },
    team: [{ id: 'm_test', species: 1, level: 5, exp: 0, iv: [8,8,8,8], skills: ['tackle','ember'], hp: 100, maxHp: 100, gender: 'male', nature: '勇敢' }],
    storage: [], bag: { ball: 5, herb: 3 },
    progress: { map: 'qingya', flags: [] },
    pokedex: { seen: [1], caught: [1] }, lastHeal: { x: 0, y: 0 }
  };
  const initRes = await post('/api/player/save', { version: 0, data: initSave }, token);
  check('初始存档提交成功', initRes.code === 0, 'version=' + (initRes.data && initRes.data.version));
  sv = await get('/api/player/save', token);
  const coins0 = sv.data.data.resources.coins;
  const team0 = sv.data.data.team.length;
  const caught0 = sv.data.data.pokedex.caught.length;

  // ---- 1. 正常胜利结算 ----
  const seed = 123456;
  const enemySpecies = 1, enemyLevel = 10, allyIndex = 0, rounds = 3, herbsUsed = 0;
  const battleId = 'b_test_win_1';
  const payload = [battleId, 'win', enemySpecies, enemyLevel, allyIndex, rounds, herbsUsed, seed].join('|');
  const winDto = { battleId, result: 'win', enemySpecies, enemyLevel, allyIndex, rounds, herbsUsed, seed, clientChecksum: checksum(payload) };
  const win = await post('/api/game/battle/settle', winDto, token);
  check('胜利结算成功', win.code === 0, 'code=' + win.code);
  const expCoins = 10 + Math.floor(((seed + 101) * 1664525 + 1013904223 >>> 0) / 4294967296 * 16); // 近似，仅日志
  check('服务端发放金币>0', win.data && win.data.coinsGained > 0, 'coinsGained=' + (win.data && win.data.coinsGained));
  check('结算返回 version=2（初始1→结算2）', win.data && win.data.version === 2, 'version=' + (win.data && win.data.version));
  const ally = win.data.data.team[0];
  check('经验已发放(ally.exp或等级提升)', ally.exp > 0 || ally.level > 5, 'lv=' + ally.level + ' exp=' + ally.exp);

  // 存档确实被写入
  sv = await get('/api/player/save', token);
  check('金币写入权威存档', sv.data.data.resources.coins === coins0 + win.data.coinsGained, 'coins=' + sv.data.data.resources.coins);
  check('version 已递增到 2', sv.data.version === 2, 'version=' + sv.data.version);

  // ---- 2. 重复结算（幂等）----
  const dup = await post('/api/game/battle/settle', winDto, token);
  check('重复结算被拒', dup.code === 3003, 'code=' + dup.code);

  // ---- 3. 篡改校验和 ----
  const badChecksum = { ...winDto, battleId: 'b_test_win_2', clientChecksum: 'deadbeef' };
  const bad = await post('/api/game/battle/settle', badChecksum, token);
  check('篡改校验和被拒', bad.code === 3002, 'code=' + bad.code + ' msg=' + bad.message);

  // ---- 4. 伪造高等级刷金币（校验和正确但等级非法）----
  const fakePayload = [ 'b_test_fake', 'win', 1, 999, 0, 1, 0, 111 ].join('|');
  const fake = await post('/api/game/battle/settle', { battleId: 'b_test_fake', result: 'win', enemySpecies: 1, enemyLevel: 999, allyIndex: 0, rounds: 1, herbsUsed: 0, seed: 111, clientChecksum: checksum(fakePayload) }, token);
  check('伪造等级999被拒', fake.code === 3001, 'code=' + fake.code + ' msg=' + fake.message);

  // ---- 5. 捕获结算：客户端谎报"成功"也由服务端按血量判定 ----
  const capSeed = 42;
  const capPayload = [ 'b_test_cap', 3, 5, 1, 1, 0, capSeed ].join('|'); // 满血 -> 捕获率低
  const capDto = { battleId: 'b_test_cap', enemySpecies: 3, enemyLevel: 5, enemyHp: 1, enemyMaxHp: 1, allyIndex: 0, seed: capSeed, clientChecksum: checksum(capPayload) };
  const cap = await post('/api/game/capture', capDto, token);
  check('捕获结算成功', cap.code === 0, 'code=' + cap.code);
  check('捕获结果由服务端判定(有caught字段)', typeof cap.data.caught === 'boolean', 'caught=' + (cap.data && cap.data.caught));
  check('捕获扣球由服务端执行', cap.data.data.bag.ball === 4, 'ball=' + (cap.data && cap.data.data.bag.ball));
  if (cap.data.caught) check('捕获精灵入队', cap.data.data.team.length === team0 + 1, 'team=' + cap.data.data.team.length);
  else check('未捕获则队伍不变', cap.data.data.team.length === team0, 'team=' + cap.data.data.team.length);

  // ---- 6. 捕获篡改校验和 ----
  const capBad = { ...capDto, battleId: 'b_test_cap2', clientChecksum: '00000000' };
  const capBadRes = await post('/api/game/capture', capBad, token);
  check('捕获篡改校验和被拒', capBadRes.code === 3002, 'code=' + capBadRes.code);

  const passed = results.filter(r => r.pass).length;
  console.log(`\n==== ${passed}/${results.length} PASS ====`);
  process.exit(passed === results.length ? 0 : 1);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
