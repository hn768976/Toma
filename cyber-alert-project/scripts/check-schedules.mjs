// Checks the look 2 / look 3 schedules: no event crosses frame 599, glitch
// duty cycle, warnings visible per frame, and lists clean / well-populated
// frames for stills.
// Run: node --experimental-strip-types --no-warnings --import ./scripts/register-hooks.mjs scripts/check-schedules.mjs
import { GLITCH_SCHEDULE, POPS } from "../src/looks/schedules.ts";

const LOOP = 600;
let bad = 0;
for (const e of GLITCH_SCHEDULE) if (e.start < 0 || e.start + e.len - 1 > LOOP - 1) bad++;
for (const q of POPS) if (q.start < 0 || q.start + q.len - 1 > LOOP - 1) bad++;

const glitchAt = (f) => GLITCH_SCHEDULE.some((e) => f >= e.start && f < e.start + e.len);
const glitchFrames = Array.from({ length: LOOP }, (_, f) => glitchAt(f)).filter(Boolean).length;
const bursts = GLITCH_SCHEDULE.reduce((n, e, i, a) => (i === 0 || e.start - (a[i - 1].start + a[i - 1].len) > 10 ? n + 1 : n), 0);

// Pop state matches hud-parts.popState: fully visible = past pop-in (9f) and before fade (last 10f)
const vis = (f) => POPS.filter((q) => f >= q.start && f < q.start + q.len).length;
const full = (f) => POPS.filter((q) => f >= q.start + 9 && f < q.start + q.len - 10).length;
const midFade = (f) => vis(f) - full(f);
let minVis = Infinity;
for (let f = 0; f < LOOP; f++) minVis = Math.min(minVis, vis(f));

console.log(`events crossing frame 599: ${bad}`);
console.log(`glitch: ${GLITCH_SCHEDULE.length} events in ${bursts} bursts, ${glitchFrames}/600 frames glitching (${((glitchFrames / 6)).toFixed(1)}%)`);
console.log(`glitch at frames 0,150,300,450,599: ${[0, 150, 300, 450, 599].map((f) => (glitchAt(f) ? "GLITCH" : "clean")).join(", ")}`);
console.log(`pop-ups: ${POPS.length} events, min visible at any frame ${minVis}`);
console.log(`pop-ups visible at 0,150,300,450,599: ${[0, 150, 300, 450, 599].map(vis).join(", ")}`);
const good = [];
for (let f = 0; f < LOOP; f++) if (midFade(f) === 0 && full(f) >= 5) good.push(f);
console.log(`look 3 frames with >=5 warnings fully visible and none mid-pop/fade: ${good.length} frames, e.g. ${good.filter((_, i) => i % Math.max(1, Math.floor(good.length / 12)) === 0).join(" ")}`);
const clean = [];
for (let f = 0; f < LOOP; f++) if (!glitchAt(f) && !glitchAt(f - 1) && !glitchAt(f + 1)) clean.push(f);
console.log(`look 2 clean frames (no glitch within +-1): ${clean.length}`);
process.exit(bad ? 1 : 0);
