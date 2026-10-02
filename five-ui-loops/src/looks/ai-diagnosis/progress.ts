// Progress 0→1 between frames 30 and 390 with seeded pauses and bursts.
// Pure function of (seed, frame): no state carried between frames.
import { mulberry32 } from "../../lib/random";

export const FILL_START = 30;
export const FILL_END = 390;

type Seg = { f0: number; f1: number; p0: number; p1: number };
const cache = new Map<number, Seg[]>();

const build = (seed: number): Seg[] => {
  const rng = mulberry32(seed);
  const n = 10;
  const durs: number[] = [];
  const incs: number[] = [];
  for (let i = 0; i < n; i++) {
    durs.push(0.55 + rng() * 0.9);
    const pause = i > 0 && i < n - 1 && rng() < 0.3;
    const burst = !pause && rng() < 0.3;
    incs.push(pause ? 0.004 : burst ? 1.4 + rng() * 0.8 : 0.35 + rng() * 0.7);
  }
  const dSum = durs.reduce((a, b) => a + b, 0);
  const iSum = incs.reduce((a, b) => a + b, 0);
  const segs: Seg[] = [];
  let f = FILL_START;
  let p = 0;
  for (let i = 0; i < n; i++) {
    const f1 = i === n - 1 ? FILL_END : f + (durs[i] / dSum) * (FILL_END - FILL_START);
    const p1 = i === n - 1 ? 1 : p + incs[i] / iSum;
    segs.push({ f0: f, f1, p0: p, p1 });
    f = f1;
    p = p1;
  }
  return segs;
};

export const progressAt = (seed: number, frame: number) => {
  if (frame <= FILL_START) return 0;
  if (frame >= FILL_END) return 1;
  let segs = cache.get(seed);
  if (!segs) {
    segs = build(seed);
    cache.set(seed, segs);
  }
  for (const s of segs) {
    if (frame <= s.f1) {
      const t = (frame - s.f0) / (s.f1 - s.f0);
      const e = 0.5 - 0.5 * Math.cos(Math.PI * t); // ease in-out within each segment
      return s.p0 + (s.p1 - s.p0) * e;
    }
  }
  return 1;
};
