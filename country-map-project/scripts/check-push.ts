/**
 * Numeric companion to the visual framing check.
 *
 *   npx tsx scripts/check-push.ts
 *
 * The push-in ends at 1.18 with a slight lateral drift, so a country that sits
 * comfortably in the opening frame can still be clipped at the closing one.
 * This reports where every subject's bounding box lands at the final push, as a
 * fraction of the frame, and flags anything that runs off the edge — the failure
 * that would otherwise only show up in an unattended 4K batch.
 */

import {readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {COMP_HEIGHT, COMP_WIDTH, PUSH} from '../src/layout';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGIONS = path.join(ROOT, 'src', 'data', 'regions');

/** Same transform the composition applies: scale about the centre, then drift. */
const atFinalPush = (v: number, centre: number, drift: number) =>
  centre + (v - centre) * PUSH.to + drift;

const rows: {code: string; l: number; r: number; t: number; b: number; bad: boolean}[] = [];

for (const file of readdirSync(REGIONS).filter((f) => f.endsWith('.json')).sort()) {
  const region = JSON.parse(readFileSync(path.join(REGIONS, file), 'utf8'));
  // Measured against the framed body: a distant territory falling outside the
  // closing frame is the house rule working, not a framing fault.
  const bb = region.fitBBox ?? region.subjectBBox;
  const dx = PUSH.driftX * COMP_WIDTH;
  const dy = PUSH.driftY * COMP_HEIGHT;
  const l = atFinalPush(bb.x, COMP_WIDTH / 2, dx) / COMP_WIDTH;
  const r = atFinalPush(bb.x + bb.w, COMP_WIDTH / 2, dx) / COMP_WIDTH;
  const t = atFinalPush(bb.y, COMP_HEIGHT / 2, dy) / COMP_HEIGHT;
  const b = atFinalPush(bb.y + bb.h, COMP_HEIGHT / 2, dy) / COMP_HEIGHT;
  rows.push({code: region.code, l, r, t, b, bad: l < 0.01 || r > 0.99 || t < 0.01 || b > 0.99});
}

const pct = (v: number) => `${(v * 100).toFixed(1).padStart(6)}%`;
console.log('Subject bounding box at the closing framing (scale 1.18 + drift):\n');
console.log(`${'code'.padEnd(5)} ${'left'.padStart(7)} ${'right'.padStart(7)} ${'top'.padStart(7)} ${'bottom'.padStart(7)}`);
for (const r of rows) {
  console.log(
    `${r.code.padEnd(5)} ${pct(r.l)} ${pct(r.r)} ${pct(r.t)} ${pct(r.b)}` + (r.bad ? '   ⚠ clipped' : '')
  );
}
const bad = rows.filter((r) => r.bad);
console.log(
  bad.length
    ? `\n${bad.length} country(s) run off the closing frame: ${bad.map((r) => r.code).join(', ')}`
    : '\nEvery subject stays inside the closing frame.'
);
process.exitCode = bad.length ? 1 : 0;
