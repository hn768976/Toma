import { metrics, CFG } from './metrics.mjs';
const pairs = process.argv.slice(2);
const rows = [];
for (let i = 0; i < pairs.length; i += 3) {
  const [key, ref, mine] = [pairs[i], pairs[i+1], pairs[i+2]];
  const a = metrics(ref, CFG[key]);
  const b = metrics(mine, CFG[key]);
  rows.push([key, a, b]);
}
const keys = ['podiumW','podiumCx','topY','botY','horizonY','wallTop','wallMid','wallLow','floor','podTop','podLeft','podRight','wallRange'];
for (const [k, a, b] of rows) {
  console.log(`\n=== ${k} ===`);
  console.log('metric'.padEnd(10) + 'reference'.padStart(11) + 'render'.padStart(11) + '   delta');
  for (const m of keys) {
    const av = parseFloat(a[m]), bv = parseFloat(b[m]);
    const d = bv - av;
    const flag = Math.abs(d) > (m.endsWith('Y')||m.startsWith('podium') ? 1.5 : 4) ? '  <-- off' : '';
    console.log(m.padEnd(10) + String(a[m]).padStart(11) + String(b[m]).padStart(11) + '  ' + (d>=0?'+':'') + d.toFixed(1) + flag);
  }
}
