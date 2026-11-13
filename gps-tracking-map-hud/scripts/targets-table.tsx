import { SCHEDULE } from '../src/comps/TargetLocator';
console.log('| # | Appears at frame | Code | E (m) | N (m) |');
console.log('|---|---|---|---|---|');
SCHEDULE.forEach((p, i) => console.log(`| ${i + 1} | ${i * 60} | ${p.code} | ${p.e} | ${p.n} |`));
