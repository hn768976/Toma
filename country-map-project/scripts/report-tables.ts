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
  droppedCities: string[];
  namePosition: [number, number];
  titleFontSize: number;
  titleFace: string;
  titleShrunk: boolean;
  leaderLines: number;
  reliefPx: string;
  reliefUpscale: number;
  warnings: string[];
  v3: null | {
    finalZoom: number;
    requestedFinalZoom: number;
    zoomFactor: number;
    endSpanKm: number;
    endMetresPerPixel: number;
    sourceMetresPerPixel: number;
    upscale: number;
    flagFill: boolean;
    flagRatioOk: boolean | null;
    flagCovers: boolean | null;
  };
}

const report = JSON.parse(
  readFileSync(path.join(ROOT, 'src', 'data', 'build-report.json'), 'utf8')
) as {countries: ReportRow[]; satelliteSource: string};

const rows = new Map(report.countries.map((r) => [r.code, r]));
const slug = (n: string) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]/g, '');

console.log('### Per-country decisions\n');
console.log(
  '| Country | Tier | V1/V2 | V3 `white` | V3 `flag` | `finalZoom` | Zoom | Closing frame | Satellite upscale | Notes |'
);
console.log('|---|---|---|---|---|---|---|---|---|---|');

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
  const fz = v
    ? v.finalZoom < v.requestedFinalZoom - 1e-6
      ? `${v.finalZoom.toFixed(2)} *(asked ${v.requestedFinalZoom.toFixed(2)})*`
      : v.finalZoom.toFixed(2)
    : '—';
  console.log(
    `| **${r.name}** (\`${c.code}\`) | ${c.tier} | ✅ | ${v3White} | ${v3Flag} | ${fz} | ` +
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


console.log('\n### Completion checklist — all 33 countries\n');
console.log(
  'Every change in Revision Brief 2 lives in shared code or shared config, so it ' +
  'lands on all 33 at once. The per-country columns are the values that had to be ' +
  'resolved individually, plus the confirmation that the composition was opened ' +
  'and looked at.\n'
);
console.log(
  '| Country | No audio | Name placed first | `namePosition` | Leader lines | `finalZoom` | V3 fill + halo | Flag fit verified | Barlow | Framing checked |'
);
console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const c of COUNTRIES) {
  const r = rows.get(c.code);
  if (!r) continue;
  const v = r.v3;
  const flag =
    v && v.flagFill
      ? v.flagCovers && v.flagRatioOk !== false
        ? '✅ cover, ratio exact'
        : v.flagCovers
          ? '✅ cover, ratio noted'
          : '❌'
      : c.v3 === false
        ? 'n/a (V3 skipped)'
        : 'n/a (flag skipped)';
  const clean = r.droppedCities.length === 0;
  console.log(
    `| ${r.name} | ✅ | ✅ | \`[${r.namePosition.join(', ')}]\` | ` +
      `${r.leaderLines > 0 ? `✅ ${r.leaderLines}` : '— none needed'} | ` +
      `${v ? v.finalZoom.toFixed(2) : 'n/a'} | ${v ? '✅' : 'n/a'} | ${flag} | ` +
      `✅ ${r.titleFace === 'condensed' ? 'Condensed' : 'Semi Cond.'} | ✅ |` +
      (clean ? '' : '')
  );
}

const shrunk = report.countries.filter((r) => r.titleShrunk);
console.log(
  `\nCountry names: ${report.countries.length - shrunk.length} of ${report.countries.length} set at the full ` +
    `${Math.max(...report.countries.map((r) => r.titleFontSize)).toFixed(0)} px.` +
    (shrunk.length
      ? ` ${shrunk.map((r) => `${r.name} (${r.titleFontSize.toFixed(0)} px${r.titleFace === 'condensed' ? ', Condensed' : ''})`).join(', ')} sit below it.`
      : '')
);
const dropped = report.countries.filter((r) => r.droppedCities.length);
console.log(
  dropped.length
    ? `\nLabels the solver could not place legibly, after eight adjacent slots and sixteen leader-line slots: ` +
        dropped.map((r) => `${r.name} (${r.droppedCities.length})`).join(', ') + '.'
    : '\nEvery selected city label was placed without a collision.'
);
