import { Rng } from "./rand";

/**
 * Chart data + Canvas 2D drawing helpers. Series are periodic (the last
 * sample flows into the first), so a strip of one period can scroll forever
 * and loop exactly.
 */

export interface Candle {
  o: number;
  c: number;
  h: number;
  l: number;
}

/** Periodic random walk: integer-harmonic sines + circularly smoothed noise. */
export const periodicSeries = (r: Rng, n: number, opts: { harmonics?: number; noise?: number; trend?: number } = {}) => {
  const H = opts.harmonics ?? 4;
  const amps: [number, number, number][] = [];
  for (let k = 1; k <= H; k++) amps.push([k, (r() * 1.0) / k, r() * Math.PI * 2]);
  const raw = Array.from({ length: n }, () => r() - 0.5);
  const sm = raw.map((_, i) => {
    let s = 0;
    for (let j = -3; j <= 3; j++) s += raw[(i + j + n) % n];
    return s / 7;
  });
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    let v = 0;
    for (const [k, a, ph] of amps) v += a * Math.sin((i / n) * Math.PI * 2 * k + ph);
    v += sm[i] * (opts.noise ?? 1.2);
    out.push(v);
  }
  return out;
};

/** Candles following a series (periodic: candle i opens at close of i-1, wrapping). */
export const candlesFrom = (r: Rng, s: number[], vol = 0.25): Candle[] =>
  s.map((c, i) => {
    const o = s[(i - 1 + s.length) % s.length];
    const span = Math.abs(c - o);
    return {
      o,
      c,
      h: Math.max(o, c) + r() * (vol + span * 0.4),
      l: Math.min(o, c) - r() * (vol + span * 0.4),
    };
  });

export const range = (xs: number[]) => {
  let lo = Infinity;
  let hi = -Infinity;
  for (const x of xs) {
    lo = Math.min(lo, x);
    hi = Math.max(hi, x);
  }
  return [lo, hi] as const;
};

export interface CandleStyle {
  up: string;
  down: string;
  wick?: number; // px
  body?: number; // fraction of slot
  glow?: number; // shadowBlur px
}

/** Draw candles across [x0, x0 + w] (one slot each), mapping [lo, hi] → [y0 + h, y0]. */
export const drawCandles = (
  ctx: CanvasRenderingContext2D,
  cs: Candle[],
  x0: number,
  y0: number,
  w: number,
  h: number,
  st: CandleStyle,
) => {
  const all = cs.flatMap((c) => [c.h, c.l]);
  const [lo, hi] = range(all);
  const Y = (v: number) => y0 + h - ((v - lo) / (hi - lo)) * h;
  const slot = w / cs.length;
  ctx.save();
  ctx.shadowBlur = st.glow ?? 0;
  cs.forEach((c, i) => {
    const up = c.c >= c.o;
    const col = up ? st.up : st.down;
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.shadowColor = col;
    const cx = x0 + (i + 0.5) * slot;
    ctx.lineWidth = st.wick ?? 1;
    ctx.beginPath();
    ctx.moveTo(cx, Y(c.h));
    ctx.lineTo(cx, Y(c.l));
    ctx.stroke();
    const bw = slot * (st.body ?? 0.6);
    const top = Y(Math.max(c.o, c.c));
    const bh = Math.max(1.5, Math.abs(Y(c.o) - Y(c.c)));
    ctx.fillRect(cx - bw / 2, top, bw, bh);
  });
  ctx.restore();
  return { Y, lo, hi };
};

export const drawLine = (
  ctx: CanvasRenderingContext2D,
  s: number[],
  x0: number,
  y0: number,
  w: number,
  h: number,
  opts: { color: string; width: number; dots?: number; dotEvery?: number; glow?: number; closed?: boolean },
) => {
  const [lo, hi] = range(s);
  const X = (i: number) => x0 + (i / (opts.closed ? s.length : s.length - 1)) * w;
  const Y = (v: number) => y0 + h - ((v - lo) / (hi - lo || 1)) * h;
  ctx.save();
  ctx.strokeStyle = opts.color;
  ctx.fillStyle = opts.color;
  ctx.lineWidth = opts.width;
  ctx.shadowColor = opts.color;
  ctx.shadowBlur = opts.glow ?? 0;
  ctx.lineJoin = "round";
  ctx.beginPath();
  const n = opts.closed ? s.length + 1 : s.length;
  for (let i = 0; i < n; i++) {
    const v = s[i % s.length];
    if (i === 0) ctx.moveTo(X(i), Y(v));
    else ctx.lineTo(X(i), Y(v));
  }
  ctx.stroke();
  if (opts.dots) {
    const every = opts.dotEvery ?? 1;
    for (let i = 0; i < n; i += every) {
      ctx.beginPath();
      ctx.arc(X(i), Y(s[i % s.length]), opts.dots, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
};

/** Invented number like "755.20" in [lo, hi). */
export const fakeNumber = (r: Rng, lo = 10, hi = 999, decimals = 2) => (lo + r() * (hi - lo)).toFixed(decimals);
