import { getStroke } from "perfect-freehand";
import { Easing } from "remotion";
import { type Drawing, type Polyline, type Pt, type StrokeDef, cumulative, pointAt } from "./geometry";
import { type Rng, hash, intRange, mulberry32 } from "./random";

/**
 * Hand rhythm for one stroke: slow start, fast middle, a slight slow-down
 * at the end (the start is slower than the end, as a pen gets going).
 */
export const handEase = Easing.bezier(0.55, 0.04, 0.32, 0.94);

/** A stroke placed on the timeline (frames). */
export type TimedStroke = StrokeDef & {
  id: string;
  start: number;
  dur: number;
};

/**
 * Natural duration of a stroke in frames. Long strokes take longer but not
 * proportionally: a hand speeds up on long lines (duration ~ length^0.55).
 */
export const naturalFrames = (length: number, speed = 1) => Math.max(3, (0.55 * Math.pow(Math.max(length, 1), 0.55)) / speed);

/**
 * Lay a drawing's strokes out one after another, with a seeded 2-5 frame
 * pen lift between them. If `total` is given the stroke durations are
 * scaled so the whole drawing (lifts included) takes that many frames.
 */
export const schedule = (
  drawing: Drawing,
  id: string,
  start: number,
  opts: { total?: number; speed?: number; lift?: [number, number]; rng?: Rng; minDur?: number } = {},
): TimedStroke[] => {
  const rng = opts.rng ?? mulberry32(hash("lift", id));
  const [lo, hi] = opts.lift ?? [2, 5];
  const lifts = drawing.map((_, i) => (i === 0 ? 0 : intRange(rng, lo, hi)));
  const natural = drawing.map((s) => {
    const cum = cumulative(s.pts);
    return naturalFrames(cum[cum.length - 1] ?? 0, opts.speed);
  });
  let scale = 1;
  if (opts.total) {
    const liftSum = lifts.reduce((a, b) => a + b, 0);
    const drawSum = natural.reduce((a, b) => a + b, 0);
    scale = Math.max(0.01, (opts.total - liftSum) / drawSum);
  }
  let t = start;
  return drawing.map((s, i) => {
    t += lifts[i];
    const dur = Math.max(opts.minDur ?? 2, natural[i] * scale);
    const out: TimedStroke = { ...s, id: `${id}:${i}`, start: t, dur };
    t += dur;
    return out;
  });
};

export const endOf = (strokes: TimedStroke[]) => strokes.reduce((m, s) => Math.max(m, s.start + s.dur), 0);

// ---------------------------------------------------------------------------
// Time samples: positions at even *time* steps, so slow parts are dense
// (high pressure, thick) and fast parts sparse (low pressure, thin).
// ---------------------------------------------------------------------------

type Sample = { u: number; p: Pt; pressure: number };
type Prepared = { samples: Sample[]; length: number };

const prepCache = new Map<string, Prepared>();

const prepare = (s: TimedStroke, ease: (t: number) => number, pressureFn?: PressureFn): Prepared => {
  const key = s.id;
  const hit = prepCache.get(key);
  if (hit && hit.samples.length > 0) return hit;
  const cum = cumulative(s.pts);
  const L = cum[cum.length - 1];
  const M = Math.min(600, Math.max(14, Math.ceil(L / 7)));
  const rng = mulberry32(hash("pressure", s.id));
  const du = 1 / (4 * M);
  const speeds: number[] = [];
  for (let i = 0; i <= M; i++) {
    const u = i / M;
    speeds.push((ease(Math.min(1, u + du)) - ease(Math.max(0, u - du))) / (Math.min(1, u + du) - Math.max(0, u - du)));
  }
  const vmax = Math.max(...speeds, 1e-6);
  const noisePh = rng() * Math.PI * 2;
  const samples: Sample[] = [];
  for (let i = 0; i <= M; i++) {
    const u = i / M;
    const p = pointAt(s.pts, cum, ease(u) * L);
    // Faster = lighter pressure = thinner line, plus a slow hand tremor.
    // Faster = lighter pressure = thinner; ink pools where the pen lands.
    let pressure = 0.98 - 0.78 * (speeds[i] / vmax) + 0.08 * Math.sin(u * 9 + noisePh) + 0.2 * Math.exp(-u * 30);
    if (pressureFn) pressure = pressureFn(pressure, s.pts, cum, ease(u) * L, i, samples);
    samples.push({ u, p, pressure: Math.min(1, Math.max(0.1, pressure)) });
  }
  const out = { samples, length: L };
  prepCache.set(key, out);
  return out;
};

/** Optional per-sample pressure override (e.g. broad-nib angle). */
export type PressureFn = (speedPressure: number, pts: Polyline, cum: Float64Array, s: number, i: number, prev: Sample[]) => number;

// ---------------------------------------------------------------------------
// Boil: after a stroke is finished it is redrawn with a tiny seeded offset
// that changes every boil step (every 3 frames).
// ---------------------------------------------------------------------------

const boilOffset = (seedKey: string, step: number, amp: number) => {
  const r = mulberry32(hash("boil", seedKey, step));
  const f1 = 0.8 + r() * 1.6;
  const f2 = 2 + r() * 3;
  const ph = [r(), r(), r(), r()].map((v) => v * Math.PI * 2);
  const tx = (r() * 2 - 1) * amp * 0.5;
  const ty = (r() * 2 - 1) * amp * 0.5;
  return (u: number): Pt => [
    tx + amp * (0.7 * Math.sin(u * Math.PI * 2 * f1 + ph[0]) + 0.3 * Math.sin(u * Math.PI * 2 * f2 + ph[1])),
    ty + amp * (0.7 * Math.sin(u * Math.PI * 2 * f1 + ph[2]) + 0.3 * Math.sin(u * Math.PI * 2 * f2 + ph[3])),
  ];
};

export type PenStyle = {
  /** perfect-freehand size (diameter) in px. */
  size: number;
  thinning?: number;
  smoothing?: number;
  streamline?: number;
  /** Taper lengths in px (start, end). */
  taper?: [number, number];
  /** Per-stroke size variation (share of size, default 0.24). */
  sizeJitter?: number;
  /** Boil amplitude in px (0 = none). */
  boil?: number;
  ease?: (t: number) => number;
  pressure?: PressureFn;
};

export type StrokeState = {
  /** Frame used for draw-on progress (may be quantized to twos). */
  frame: number;
  /** Boil step (floor(frame / 3)). */
  step: number;
  /** Seed prefix for the boil (composition id). */
  seedKey: string;
  /** Optionally erase the stroke from its tail: visible from this progress on. */
  from?: number;
};

/** Visible progress (0..1) of a timed stroke at a frame. */
export const progressAt = (s: TimedStroke, frame: number) => Math.min(1, Math.max(0, (frame - s.start) / s.dur));

/**
 * The filled outline (SVG path data) of a stroke at a frame, or null if
 * nothing of it is visible yet.
 */
export const strokePath = (s: TimedStroke, state: StrokeState, style: PenStyle): string | null => {
  const p = progressAt(s, state.frame);
  const from = state.from ?? 0;
  if (p <= 0 || from >= 1 || p <= from) return null;
  const ease = style.ease ?? handEase;
  const { samples, length } = prepare(s, ease, style.pressure);
  const pts: number[][] = [];
  const lerpSample = (u: number) => {
    const k = Math.min(samples.length - 2, Math.floor(u * (samples.length - 1)));
    const a = samples[k];
    const b = samples[k + 1];
    const t = (u - a.u) / (b.u - a.u || 1);
    return [a.p[0] + (b.p[0] - a.p[0]) * t, a.p[1] + (b.p[1] - a.p[1]) * t, a.pressure + (b.pressure - a.pressure) * t, u];
  };
  if (from > 0) pts.push(lerpSample(from));
  for (const smp of samples) {
    if (smp.u <= from) continue;
    if (smp.u > p) break;
    pts.push([smp.p[0], smp.p[1], smp.pressure, smp.u]);
  }
  if (p < 1) pts.push(lerpSample(p));
  if (pts.length < 2) pts.push([...pts[0]]);

  const done = p >= 1;
  if (done && style.boil) {
    const off = boilOffset(`${state.seedKey}:${s.id}`, state.step, style.boil);
    for (const q of pts) {
      const o = off(q[3]);
      q[0] += o[0];
      q[1] += o[1];
    }
  }
  // Each stroke gets its own pen size (±12%) and exit: some flick off long, some stop blunt.
  const vr = mulberry32(hash("stroke-var", s.id));
  const jit = style.sizeJitter ?? 0.24;
  const size = style.size * (s.weight ?? 1) * (1 - jit / 2 + jit * vr());
  const [t0, t1] = style.taper ?? [size * (0.6 + vr() * 1.2), size * (1.5 + vr() * 5)];
  const outline = getStroke(
    pts.map((q) => [q[0], q[1], q[2]]),
    {
      size,
      thinning: style.thinning ?? 0.6,
      smoothing: style.smoothing ?? 0.6,
      streamline: style.streamline ?? 0.2,
      simulatePressure: false,
      start: { taper: from > 0 ? 0 : Math.min(t0, length * 0.3), cap: true },
      end: { taper: Math.min(t1, length * 0.35), cap: true },
      last: done,
    },
  );
  return outlineToPath(outline);
};

/** perfect-freehand outline -> smooth closed SVG path (quadratic midpoints). */
export const outlineToPath = (stroke: number[][]): string | null => {
  const n = stroke.length;
  if (n < 3) return null;
  const f = (v: number) => v.toFixed(2);
  // Too few points for the smoothed form ("T" needs a point): a plain polygon.
  if (n < 4) return `M${stroke.map((p) => `${f(p[0])},${f(p[1])}`).join(" L")} Z`;
  const avg = (a: number, b: number) => (a + b) / 2;
  let d = `M${f(stroke[0][0])},${f(stroke[0][1])} Q${f(stroke[1][0])},${f(stroke[1][1])} ${f(avg(stroke[1][0], stroke[2][0]))},${f(avg(stroke[1][1], stroke[2][1]))} T`;
  for (let i = 2; i < n - 1; i++) {
    d += `${f(avg(stroke[i][0], stroke[i + 1][0]))},${f(avg(stroke[i][1], stroke[i + 1][1]))} `;
  }
  return `${d}Z`;
};
