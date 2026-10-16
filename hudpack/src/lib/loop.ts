import { Rng } from "./random";

/** Loop length shared by every looping composition (20 s at 30 fps). */
export const LOOP = 600;

/** Value table for a ticking readout: one entry per step of `period` frames. */
export const tickTable = <T,>(period: number, make: (i: number) => T): T[] => {
  if (LOOP % period !== 0) throw new Error(`period ${period} does not divide ${LOOP}`);
  return Array.from({ length: LOOP / period }, (_, i) => make(i));
};

/**
 * Current entry of a ticking table. `offset` (whole frames) staggers readouts
 * that share a period so they don't all change on the same frame; the result
 * still repeats exactly every LOOP frames.
 */
export const tick = <T,>(table: T[], period: number, f: number, offset = 0) =>
  table[Math.floor((f + offset) / period) % table.length];

/** A stable per-item frame offset in [0, period), from an index. */
export const stagger = (i: number, period: number) => (i * 7919 + 13) % period;

/** Periodic noise: n seeded samples, read with wrap-around and linear interpolation. */
export class LoopNoise {
  readonly v: Float32Array;
  constructor(rng: Rng, readonly n: number, smooth = 0) {
    const raw = new Float32Array(n);
    for (let i = 0; i < n; i++) raw[i] = rng() * 2 - 1;
    this.v = raw;
    for (let pass = 0; pass < smooth; pass++) {
      const nv = new Float32Array(n);
      for (let i = 0; i < n; i++) nv[i] = (this.v[(i - 1 + n) % n] + 2 * this.v[i] + this.v[(i + 1) % n]) / 4;
      this.v = nv;
    }
  }
  at(x: number) {
    const n = this.n;
    const xf = ((x % n) + n) % n;
    const i0 = Math.floor(xf);
    const t = xf - i0;
    return this.v[i0] * (1 - t) + this.v[(i0 + 1) % n] * t;
  }
}

/** Number of characters of a block revealed by a typing animation. */
export const typedChars = (total: number, f: number, period: number, startFrac: number, endFrac: number) => {
  const p = (f % period) / period;
  if (p < startFrac) return 0;
  if (p >= endFrac) return total;
  return Math.floor(((p - startFrac) / (endFrac - startFrac)) * total);
};

/** Nonsense "words" for tiny filler text (never real prose or code). */
export const fillerLine = (rng: Rng, chars: number, upper = false) => {
  const syl = ["ka", "tor", "vel", "un", "mi", "dra", "sen", "qo", "lex", "ri", "pha", "zu", "net", "ob", "cy", "ran", "tel", "os", "ix", "mar"];
  let s = "";
  while (s.length < chars) {
    let w = "";
    const n = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) w += syl[Math.floor(rng() * syl.length)];
    s += (s ? " " : "") + w;
  }
  s = s.slice(0, chars);
  return upper ? s.toUpperCase() : s;
};

export const fmt = (v: number, decimals: number) => v.toFixed(decimals);
