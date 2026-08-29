/**
 * Prints the generated tear and corruption timelines for both versions, so the
 * clustering can be inspected without rendering. Run with:
 *   node_modules/.bin/esbuild scripts/check-timelines.ts --bundle --platform=node \
 *     --format=cjs --outfile=/tmp/check.cjs && node /tmp/check.cjs
 */
import {buildCorruptionTimeline, buildTearTimeline} from '../src/lib/glitch';
import {VARIANTS} from '../src/variants';

for (const name of ['denied', 'granted'] as const) {
  const cfg = VARIANTS[name];
  const tears = buildTearTimeline(cfg);
  const gaps: number[] = [];
  for (let i = 1; i < tears.length; i++) gaps.push(tears[i].start - tears[i - 1].end);
  const active = new Array(300).fill(0);
  for (const e of tears) for (let f = e.start; f < e.end; f++) active[f] = 1;
  const tearFrames = active.reduce((a: number, b: number) => a + b, 0);
  console.log(`\n== ${name} ==`);
  console.log('events:', tears.length, 'frames with tearing:', tearFrames, `(${Math.round((tearFrames / 300) * 100)}%)`);
  console.log('first:', tears[0]?.start, 'last end:', tears[tears.length - 1]?.end);
  console.log('gaps between events:', gaps.join(' '));
  console.log('instability samples:', [0, 30, 45, 90, 150, 200, 240, 260, 280, 299].map((f) => `${f}:${cfg.instability(f).toFixed(2)}`).join(' '));
  console.log('pulse samples:', [270, 280, 287, 295, 299].map((f) => `${f}:${cfg.pulse(f).toFixed(2)}`).join(' '));
  const cor = buildCorruptionTimeline(cfg);
  console.log('corruption events:', cor.map((c) => `s${c.start}d${c.duration}r${c.row}l${c.lines}`).join(' '));
}
