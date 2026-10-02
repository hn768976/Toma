// Fixed event schedules for look 2 (glitches) and look 3 (warning pop-ups).
// Built once at module load from seeded mulberry32. Every event starts in
// 0..599 and ends by frame 599; scenes look up (frame % 600).
// Plain TypeScript (no React) so scripts/check-schedules.mjs can import it.
import { LOOP } from "../lib/loop-constants";
import { mulberry32, range } from "../lib/random";

// ---------------------------------------------------------------------------
// Glitch schedule. Bursts with calm stretches between; each burst is a run
// of short events (1-3 frames). Every event starts in 0..599 and ends by 599.
// ---------------------------------------------------------------------------
type Band = { y0: number; y1: number; dx: number; hide: boolean };
type GlitchEvent = { start: number; len: number; bands: Band[]; split: number; splitY: number };

const buildSchedule = (): GlitchEvent[] => {
  const r = mulberry32(0x6117c4);
  const events: GlitchEvent[] = [];
  let t = 22;
  while (t < LOOP - 30) {
    const burstLen = Math.floor(range(r, 6, 16));
    let f = t;
    const end = Math.min(t + burstLen, LOOP - 1);
    while (f < end) {
      const len = Math.min(1 + Math.floor(r() * 3), end - f);
      // Horizontal strips across the word's height (0..1 of text box).
      const cuts = [0, 1];
      const n = 2 + Math.floor(r() * 5);
      for (let i = 0; i < n; i++) cuts.push(r());
      cuts.sort((a, b) => a - b);
      const bands: Band[] = [];
      for (let i = 0; i < cuts.length - 1; i++) {
        const shifted = r() < 0.45;
        bands.push({
          y0: cuts[i],
          y1: cuts[i + 1],
          dx: shifted ? (r() < 0.5 ? -1 : 1) * range(r, 0.015, 0.09) : 0,
          hide: r() < 0.08,
        });
      }
      events.push({ start: f, len, bands, split: r() < 0.7 ? range(r, 0.004, 0.014) : 0, splitY: range(r, -0.004, 0.004) });
      f += len + (r() < 0.4 ? 1 + Math.floor(r() * 2) : 0);
    }
    t = end + Math.floor(range(r, 38, 95));
  }
  for (const e of events) {
    if (e.start < 0 || e.start + e.len - 1 > LOOP - 1) throw new Error("glitch event crosses the loop");
  }
  return events;
};
export const GLITCH_SCHEDULE = buildSchedule();


// ---------------------------------------------------------------------------
// Warning pop-up schedule: lanes of back-to-back events. Every event starts
// in 0..599 and ends by frame 599 (the last one in a lane is shortened or
// dropped), so nothing crosses the loop point.
// ---------------------------------------------------------------------------
type Pop = { start: number; len: number; layer: number; x: number; y: number; size: number; framed: boolean };
const buildPops = (): Pop[] => {
  const r = mulberry32(0x1332);
  const pops: Pop[] = [];
  const LANES = 8;
  for (let lane = 0; lane < LANES; lane++) {
    let t = Math.floor((lane / LANES) * 80);
    while (t < LOOP - 1) {
      let len = Math.floor(range(r, 75, 150));
      if (t + len > LOOP) len = LOOP - t; // last frame of the event = 599
      if (len >= 40) {
        const layer = [1, 1, 2, 2, 2, 3][Math.floor(r() * 6)];
        pops.push({
          start: t,
          len,
          layer,
          x: range(r, -150, 1800),
          y: range(r, 60, 1020),
          size: layer === 3 ? range(r, 80, 110) : layer === 1 ? range(r, 42, 60) : range(r, 55, 85),
          framed: r() < 0.7,
        });
      }
      t += len + Math.floor(range(r, 3, 20));
    }
  }
  for (const q of pops) {
    if (q.start < 0 || q.start + q.len - 1 > LOOP - 1) throw new Error("pop-up crosses the loop");
  }
  return pops;
};
export const POPS = buildPops();

