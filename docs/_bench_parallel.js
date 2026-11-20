/* 并发加速基准测试：对比双站并行 vs 单站串行的耗时
 * 用 4 张相同的小图任务，分别测：
 *   A) 国际站单站串行 4 张
 *   B) 双站并行 4 张（generateBatch）
 * 输出耗时与加速比。注意生图本身有服务端排队波动，结果供参考。
 * 运行：node docs/_bench_parallel.js */
const { generateBatch } = require('./_agnes_dual');

const PARAMS = 'a tiny simpleblue diamond icon, flat white background, minimal';
const N = 4;
const mkTasks = (prefix) => Array.from({ length: N }, (_, i) => ({
  prompt: PARAMS + ' variant ' + i, file: '_bench_' + prefix + '_' + i + '.png', size: '1024x1024'
}));

(async () => {
  // A) 单站串行（国际站，用 generateBatch + lines:['intl'] 站内串行）
  console.log('=== A) 国际站单站串行 ' + N + ' 张 ===');
  const ta = Date.now();
  await generateBatch(mkTasks('serial'), { lines: ['intl'], fallback: false });
  const serialMs = Date.now() - ta;

  // B) 双站并行（国际站 2 张 + 国内站 2 张同时跑）
  console.log('\n=== B) 双站并行 ' + N + ' 张 ===');
  const tb = Date.now();
  await generateBatch(mkTasks('par'), { lines: ['intl', 'cn'], fallback: false });
  const parallelMs = Date.now() - tb;

  console.log('\n=== 结果 ===');
  console.log('单站串行: ' + (serialMs / 1000).toFixed(1) + 's');
  console.log('双站并行: ' + (parallelMs / 1000).toFixed(1) + 's');
  console.log('加速比: ' + (serialMs / parallelMs).toFixed(2) + 'x');
  process.exit(0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
