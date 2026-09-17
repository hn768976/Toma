/**
 * Opens every composition's configuration and checks the things that fail
 * silently in an unattended batch: that each flag's texture exists, that its
 * proportion matches the official specification, and that the generated
 * composition list really is 30 countries x 2 versions.
 */
import {readFileSync, existsSync, statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(readFileSync(join(root, 'src/data/countries.json'), 'utf8'));
const VERSIONS = ['FlagPole', 'FlagCloseup'];

let bad = 0;
const rows = [];

for (const c of data.countries) {
  const officialAspect = c.ratio[1] / c.ratio[0];
  const dims = [];

  // Both texture tiers must exist and both must match the official ratio.
  for (const name of [`${c.code}.png`, `${c.code}@8k.png`]) {
    const png = join(root, 'public/flags', name);
    if (!existsSync(png)) {
      console.error(`MISSING texture ${name} for ${c.name}`);
      bad++;
      continue;
    }
    // PNG header: width and height are big-endian uint32 at bytes 16 and 20.
    const buf = readFileSync(png);
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    const drift = Math.abs(w / h - officialAspect) / officialAspect;
    if (drift > 0.002) {
      console.error(`RATIO MISMATCH ${name}: ${w}x${h}, official ${c.ratio.join(':')}`);
      bad++;
    }
    dims.push(`${w}x${h} ${(statSync(png).size / 1024).toFixed(0)}KiB`);
  }

  rows.push(
    `${c.name.padEnd(22)} ${c.ratio[0]}:${c.ratio[1]}`.padEnd(30) +
      dims.join('  |  ').padEnd(40) +
      VERSIONS.map((v) => `${c.slug}-${v}`).join('  '),
  );
}

console.log(rows.join('\n'));
const total = data.countries.length * VERSIONS.length;
console.log(`\n${data.countries.length} countries x ${VERSIONS.length} versions = ${total} compositions`);
if (total !== 60) {
  console.error(`Expected 60 compositions, got ${total}`);
  bad++;
}
if (bad > 0) {
  console.error(`\n${bad} problem(s) found.`);
  process.exit(1);
}
console.log('All compositions verified.');
