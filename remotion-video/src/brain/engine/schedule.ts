import { mulberry32, range } from "./random";

// Periodic event schedules (signals, arcs, sparkles). Built once at module
// level from a seed; an event is active at frame f when (f - start) mod period
// < duration, so a schedule over a 600-frame period loops exactly.

export type Ev = { start: number; dur: number; id: number; r: number; r2: number };

export const makeSchedule = (opts: {
  seed: number;
  period: number;
  gap: [number, number];
  dur: [number, number];
  /** chooses the id (e.g. which fibre/arc) given the start frame and rng */
  pick: (start: number, rng: () => number) => number;
  concurrent?: number; // number of independent lanes
}) => {
  const rng = mulberry32(opts.seed);
  const out: Ev[] = [];
  const lanes = opts.concurrent ?? 1;
  for (let l = 0; l < lanes; l++) {
    let t = range(rng, 0, opts.gap[1]);
    while (t < opts.period) {
      const start = Math.floor(t);
      const dur = Math.round(range(rng, opts.dur[0], opts.dur[1]));
      out.push({ start, dur, id: opts.pick(start, rng), r: rng(), r2: rng() });
      t += dur + range(rng, opts.gap[0], opts.gap[1]);
    }
  }
  return out;
};

/** Active events at frame f with local progress 0..1 (period-wrapped). */
export const activeAt = (events: Ev[], f: number, period: number) => {
  const res: { ev: Ev; age: number; p: number }[] = [];
  for (const ev of events) {
    const age = (((f - ev.start) % period) + period) % period;
    if (age < ev.dur) res.push({ ev, age, p: age / ev.dur });
  }
  return res;
};

/** Integer hash -> [0,1) (for per-frame flicker that is a pure function of frame). */
export const hash01 = (a: number, b = 0) => {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
