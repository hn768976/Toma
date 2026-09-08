/**
 * Prints the README's per-country tables from the build report, so the numbers
 * in the documentation are the measured ones rather than remembered ones.
 *
 *   npx tsx scripts/report-tables.ts
 */

import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {COUNTRIES} from '../src/countries';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

interface ReportRow {
  code: string;
  name: string;
  projection: string;
  cities: number;
  reliefPx: string;
  reliefUpscale: number;
  v3: null | {
    zoomFactor: number;
    endSpanKm: number;
    endMetresPerPixel: number;
    sourceMetresPerPixel: number;
    upscale: number;
    flagFill: boolean;
    flagRatioOk: boolean | null;
  };
  warnings: string[];
}

const report = JSON.parse(
  readFileSync(path.join(ROOT, 'src', 'data', 'build-report.json'), 'utf8')
) as {countries: ReportRow[]; satelliteSource: string};

const rows = new Map(report.countries.map((r) => [r.code, r]));
const slug = (n: string) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]/g, '');

console.log('### Per-country decisions\n');
console.log(
  '| Country | Tier | V1/V2 | V3 `white` | V3 `flag` | Zoom | Closing frame | Satellite upscale | Notes |'
);
console.log('|---|---|---|---|---|---|---|---|---|');

for (const c of COUNTRIES) {
  const r = rows.get(c.code);
  if (!r) continue;
  const v = r.v3;
  const v3White = v ? '✅' : '— skipped';
  const v3Flag = !v
    ? '—'
    : c.v3 && c.v3.flagFill === false
      ? '— skipped'
      : v.flagFill
        ? '✅'
        : '— no flag';
  const notes: string[] = [];
  if (c.notes) notes.push(c.notes);
  if (c.v3 && c.v3.note) notes.push(c.v3.note);
  if (c.v3 && c.v3.flagFillSkipReason) notes.push(`Flag fill skipped: ${c.v3.flagFillSkipReason}`);
  if (v && v.flagRatioOk === false) notes.push('Flag ratio differs slightly from the official spec — see Flags.');
  console.log(
    `| **${r.name}** (\`${c.code}\`) | ${c.tier} | ✅ | ${v3White} | ${v3Flag} | ` +
      (v ? `${v.zoomFactor.toFixed(1)}×` : '—') + ' | ' +
      (v ? `${v.endSpanKm.toLocaleString('en-GB')} km` : '—') + ' | ' +
      (v ? `${v.upscale.toFixed(2)}×` : '—') + ' | ' +
      (notes.join(' ') || '') + ' |'
  );
}

console.log('\n### Composition ids\n');
console.log('| Country | V1 | V2 | V3 white | V3 flag |');
console.log('|---|---|---|---|---|');
for (const c of COUNTRIES) {
  const r = rows.get(c.code);
  if (!r) continue;
  const s = slug(r.name);
  const v = r.v3;
  console.log(
    `| ${r.name} | \`V1-${s}MapLight\` | \`V2-${s}MapDark\` | ` +
      (v ? `\`V3-${s}SatelliteZoomWhite\`` : '—') + ' | ' +
      (v && v.flagFill ? `\`V3-${s}SatelliteZoomFlag\`` : '—') + ' |'
  );
}

console.log('\n### Relief resolution\n');
console.log('| Country | Warped relief | Upscale from the 1:10m grid | Cities |');
console.log('|---|---|---|---|');
for (const c of COUNTRIES) {
  const r = rows.get(c.code);
  if (!r) continue;
  console.log(
    `| ${r.name} | ${r.reliefPx} | ${r.reliefUpscale.toFixed(2)}× | ${r.cities} |`
  );
}

const totals = {
  countries: report.countries.length,
  v1v2: report.countries.length * 2,
  v3white: report.countries.filter((r) => r.v3).length,
  v3flag: report.countries.filter((r) => r.v3?.flagFill).length,
};
console.log(
  `\nTotals: ${totals.countries} countries, ` +
    `${totals.v1v2 + totals.v3white + totals.v3flag} compositions ` +
    `(${totals.v1v2} V1/V2, ${totals.v3white} V3 white, ${totals.v3flag} V3 flag).`
);
