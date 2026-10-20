// The pen: timing (hand easing, pen lifts), pressure and draw-on for
// perfect-freehand strokes, plus the boil. Everything is a pure function of
// the frame number.
import { getStroke } from 'perfect-freehand';
import { Easing } from 'remotion';
import { clamp01, cumulative, dist, pointAtLength, Pt, smoothstep } from './geom';
import { boilStep, irange, onTwos, range, rngFor, signed } from './random';

/** Hand draw-on: slow start, fast middle, slight slow-down at the end (end speed is not zero). */
export const handEase = Easing.bezier(0.55, 0, 0.62, 0.9);

export type Blend = 'normal' | 'multiply';
export type ExitMode = 'reverse' | 'retract' | 'none';

export interface StrokeStyle {
  color: string;
  size: number;
  thinning?: number; // default 0.6
  taper?: boolean; // tapered start/end, default true
  blend?: Blend; // default multiply (overlapping ink darkens)
  streak?: boolean; // dry-marker streak texture inside the stroke
  edge?: string; // highlighter: darker pooled edges in this colour
  boil?: number; // boil amplitude in px (default 2.4)
  speed?: number; // duration multiplier (<1 = faster)
  ease?: (t: number) => number; // draw-on easing (default: handEase)
}

export interface Stroke extends StrokeStyle {
  id: string;
  pts: Pt[];
  start: number; // frame the pen touches down
  dur: number; // frames to draw it
  exitStart: number; // frame the exit begins (Infinity = never)
  exitDur: number;
  exitMode: ExitMode;
  /** optional custom visible window (overrides start/dur/exit), for strokes that share one pen movement */
  windowFn?: (frame: number) => [number, number] | null;
}

/** Duration in frames: longer strokes take longer, but not proportionally (sqrt). */
export const strokeFrames = (len: number, speed = 1) => Math.max(3, Math.round((4 + 6.2 * Math.sqrt(len / 1000)) * speed));

export interface SeqItem extends StrokeStyle {
  pts: Pt[];
  /** extra pause before this stroke (frames) on top of the pen lift */
  gap?: number;
  /** start together with the previous stroke instead of after it */
  together?: boolean;
}

/**
 * Lay strokes one after another, with a seeded 2-5 frame pen lift between
 * each. Returns the strokes (no exit yet) and the frame the last one ends.
 */
export const sequence = (compId: string, key: string, items: SeqItem[], startFrame: number) => {
  const r = rngFor(compId, key, 'lifts');
  let t = startFrame;
  let prevStart = startFrame;
  const strokes: Stroke[] = items.map((it, i) => {
    const dur = strokeFrames(dist2(it.pts), it.speed);
    let s: number;
    if (i === 0) s = t + (it.gap ?? 0);
    else if (it.together) s = prevStart + (it.gap ?? 0);
    else s = t + irange(r, 2, 5) + (it.gap ?? 0);
    prevStart = s;
    t = Math.max(t, s + dur);
    return { ...it, id: `${compId}/${key}/${i}`, start: s, dur, exitStart: Infinity, exitDur: 12, exitMode: 'reverse' as ExitMode };
  });
  return { strokes, end: t };
};

const dist2 = (pts: Pt[]) => {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += dist(pts[i - 1], pts[i]);
  return l;
};

/** Set an exit on a group of strokes. */
export const withExit = (strokes: Stroke[], exitStart: number, exitDur = 12, exitMode: ExitMode = 'reverse') =>
  strokes.map((s) => ({ ...s, exitStart, exitDur, exitMode }));

// ---------------------------------------------------------------------------
// Prepared stroke: time-uniform samples, so draw-on is a prefix and spacing
// follows pen speed (fast = sparse = thinner).
// ---------------------------------------------------------------------------

interface Prepared {
  pts: Pt[]; // time-uniform samples
  u: number[]; // arc fraction of each sample
  pressure: number[];
  len: number;
}

const cache = new Map<string, Prepared>();

export const prepare = (s: Stroke): Prepared => {
  const hit = cache.get(s.id);
  if (hit && hit.pts.length && hit.len === dist2(s.pts)) return hit;
  const cum = cumulative(s.pts);
  const L = cum[cum.length - 1] || 1;
  const M = Math.max(6, Math.min(9000, Math.ceil(L / 4)));
  const r = rngFor(s.id, 'pressure');
  const ph1 = range(r, 0, 6.28);
  const ph2 = range(r, 0, 6.28);
  const f1 = range(r, 1.5, 3.5);
  const f2 = range(r, 4, 9);
  const ease = s.ease ?? handEase;
  const speedAt = (t: number) => (ease(Math.min(1, t + 0.002)) - ease(Math.max(0, t - 0.002))) / 0.004;
  const vmax = s.ease ? 1.6 : 1.9;
  const pts: Pt[] = [];
  const u: number[] = [];
  const pressure: number[] = [];
  for (let j = 0; j <= M; j++) {
    const t = j / M;
    const a = ease(t);
    pts.push(pointAtLength(s.pts, cum, a * L));
    u.push(a);
    const v = clamp01(speedAt(t) / vmax);
    // faster -> lighter pressure -> thinner; plus a small wandering hand pressure
    const p = 0.92 - 0.55 * v + 0.05 * Math.sin(f1 * 6.28 * a + ph1) + 0.03 * Math.sin(f2 * 6.28 * a + ph2);
    pressure.push(clamp01(p));
  }
  const prep = { pts, u, pressure, len: L };
  cache.set(s.id, prep);
  return prep;
};

/** Visible window [from, to] (arc-time fractions 0..1) of a stroke at a frame. */
export const strokeWindow = (s: Stroke, frame: number): [number, number] | null => {
  if (s.windowFn) return s.windowFn(frame);
  const f = onTwos(frame);
  const local = (f - s.start) / s.dur;
  if (local <= 0) return null;
  let to = Math.min(1, local);
  let from = 0;
  if (f >= s.exitStart && s.exitMode !== 'none') {
    const e = Easing.in(Easing.quad)(clamp01((f - s.exitStart) / s.exitDur));
    if (s.exitMode === 'reverse') to = Math.min(to, 1 - e);
    else from = e;
  }
  if (to - from <= 0.0001) return null;
  return [from, to];
};

/** Boil offsets: re-generated every 3 frames with a tiny seeded offset. */
const boilFn = (id: string, frame: number, amp: number) => {
  const r = rngFor(id, 'boil', boilStep(frame));
  const w = [0, 1, 2].map((i) => ({ k: range(r, 0.6, 2.2) * (1 + i) * 6.28, px: range(r, 0, 6.28), py: range(r, 0, 6.28), a: 1 / (1 + i) }));
  const tx = signed(r, amp * 0.5);
  const ty = signed(r, amp * 0.5);
  return (u: number): Pt => {
    let x = tx;
    let y = ty;
    for (const k of w) {
      x += amp * 0.55 * k.a * Math.sin(k.k * u + k.px);
      y += amp * 0.55 * k.a * Math.sin(k.k * u + k.py);
    }
    return [x, y];
  };
};

export interface StrokeGeom {
  outline: string;
  streaks: string[];
  center: Pt[];
}

/** Outline path (and texture streaks) of a stroke at a frame, or null when invisible. */
export const strokeGeom = (s: Stroke, frame: number): StrokeGeom | null => {
  const win = strokeWindow(s, frame);
  if (!win) return null;
  const prep = prepare(s);
  const M = prep.pts.length - 1;
  const i0 = win[0] * M;
  const i1 = win[1] * M;
  const boil = boilFn(s.id, frame, s.boil ?? 2.4);
  const pts: number[][] = [];
  const push = (fi: number) => {
    const a = Math.floor(fi);
    const b = Math.min(M, a + 1);
    const t = fi - a;
    const p = prep.pts[a];
    const q = prep.pts[b];
    const u = prep.u[a] + (prep.u[b] - prep.u[a]) * t;
    const o = boil(u);
    pts.push([p[0] + (q[0] - p[0]) * t + o[0], p[1] + (q[1] - p[1]) * t + o[1], prep.pressure[a] + (prep.pressure[b] - prep.pressure[a]) * t]);
  };
  push(i0);
  for (let i = Math.floor(i0) + 1; i < i1; i++) push(i);
  push(i1);
  if (pts.length < 2) return null;
  const visLen = prep.len * (prep.u[Math.min(M, Math.ceil(i1))] - prep.u[Math.floor(i0)]);
  const taper = s.taper !== false;
  const done = win[1] >= 1;
  const startTaper = taper ? Math.min(s.size * 3.2, visLen * 0.18) : 0;
  const endTaper = taper ? Math.min(s.size * 4.5, visLen * 0.22) * (done ? 1 : smoothstep(0.75, 1, win[1])) : 0;
  const outlinePts = getStroke(pts, {
    size: s.size,
    thinning: s.thinning ?? 0.6,
    smoothing: 0.55,
    streamline: 0.3,
    simulatePressure: false,
    start: { taper: startTaper, cap: true },
    end: { taper: endTaper, cap: true },
    last: done,
  });
  const outline = toSvgPath(outlinePts);
  const center = pts.map((p) => [p[0], p[1]] as Pt);
  const streaks: string[] = [];
  if (s.streak || s.edge) {
    const offs = s.edge ? [-0.4, 0.4] : [-0.2, 0.16];
    for (const k of offs) {
      const line: number[][] = [];
      for (let i = 0; i < pts.length; i += 2) {
        const a = pts[Math.max(0, i - 2)];
        const b = pts[Math.min(pts.length - 1, i + 2)];
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const nx = -(b[1] - a[1]) / l;
        const ny = (b[0] - a[0]) / l;
        const w = s.size * (0.5 - (s.thinning ?? 0.6) * (0.5 - pts[i][2])) * 2;
        line.push([pts[i][0] + nx * k * w, pts[i][1] + ny * k * w, 0.5]);
      }
      if (line.length > 2)
        streaks.push(toSvgPath(getStroke(line, { size: s.size * (s.edge ? 0.14 : 0.1), thinning: 0, smoothing: 0.5, streamline: 0.3, simulatePressure: false, last: done })));
    }
  }
  return { outline, streaks, center };
};

/** perfect-freehand outline -> SVG path (quadratic midpoints). */
export const toSvgPath = (pts: number[][]): string => {
  const n = pts.length;
  if (n < 4) return '';
  const avg = (a: number, b: number) => (a + b) / 2;
  let a = pts[0];
  let b = pts[1];
  const c = pts[2];
  let d = `M${a[0].toFixed(1)},${a[1].toFixed(1)} Q${b[0].toFixed(1)},${b[1].toFixed(1)} ${avg(b[0], c[0]).toFixed(1)},${avg(b[1], c[1]).toFixed(1)} T`;
  for (let i = 2; i < n - 1; i++) {
    a = pts[i];
    b = pts[i + 1];
    d += `${avg(a[0], b[0]).toFixed(1)},${avg(a[1], b[1]).toFixed(1)} `;
  }
  return d + 'Z';
};
