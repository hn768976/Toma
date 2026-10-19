/**
 * Hand-drawn shape generators. Every generator takes a seeded rng and a
 * half-size S (px) and returns a Drawing centred on (0,0): a list of pen
 * strokes in the order a hand would draw them. Nothing is geometrically
 * perfect: circles overshoot or gap, lines bow and wobble, arrowheads are
 * uneven.
 */
import {
  type Drawing,
  type Polyline,
  type Pt,
  type StrokeDef,
  add,
  handEllipse,
  handLine,
  joinContinuous,
  lerp,
  mul,
  polar,
  quad,
  resample,
  roughStrokes,
  rot,
  spline,
  sub,
  tremor,
} from "./geometry";
import { type Rng, hash, intRange, range, signed } from "./random";

export type Gen = (rng: Rng, S: number) => Drawing;

const st = (pts: Polyline, weight?: number): StrokeDef => ({ pts, weight });
const P = (S: number) => (x: number, y: number): Pt => [x * S, y * S];

/** Jitter control points by a fraction of S, then spline + tremor. */
export const sketch = (rng: Rng, ctrl: Pt[], S: number, jit = 0.025, trem = 0.006): Polyline =>
  tremor(rng, spline(ctrl.map((p) => add(p, [signed(rng, jit * S), signed(rng, jit * S)])), 14), trem * S);

/** A closed-ish outline drawn as one continuous line of hand edges. */
export const outline = (rng: Rng, pts: Pt[], closed = true, overshoot = 0.06): Polyline => {
  const seq = closed ? [...pts, pts[0]] : pts;
  const out: Polyline = [];
  for (let i = 0; i < seq.length - 1; i++) {
    let b = seq[i + 1];
    if (closed && i === seq.length - 2) b = lerp(seq[i], b, 1 + signed(rng, overshoot));
    const seg = handLine(rng, seq[i], b, { bow: signed(rng, 0.025) });
    out.push(...(i === 0 ? seg : seg.slice(1)));
  }
  return out;
};

const endAngle = (pts: Polyline) => {
  const a = pts[Math.max(0, pts.length - 6)];
  const b = pts[pts.length - 1];
  return Math.atan2(b[1] - a[1], b[0] - a[0]);
};
const startAngle = (pts: Polyline) => {
  const a = pts[Math.min(pts.length - 1, 5)];
  const b = pts[0];
  return Math.atan2(b[1] - a[1], b[0] - a[0]);
};

/** Uneven arrowhead at `tip` pointing along `ang`. */
export const arrowHead = (rng: Rng, tip: Pt, ang: number, h: number, mode: "v" | "two" = rng() < 0.5 ? "v" : "two"): StrokeDef[] => {
  const back = ang + Math.PI;
  const s1 = range(rng, 0.34, 0.72);
  const s2 = range(rng, 0.3, 0.66);
  const w1 = add(tip, polar(h * range(rng, 0.75, 1.25), back + s1));
  const w2 = add(tip, polar(h * range(rng, 0.6, 1.05), back - s2));
  const t2 = add(tip, polar(signed(rng, 0.07) * h, ang + Math.PI / 2));
  if (mode === "v") {
    const a = handLine(rng, w1, t2, { bow: signed(rng, 0.06) });
    const b = handLine(rng, t2, w2, { bow: signed(rng, 0.06) });
    return [st([...a, ...b.slice(1)])];
  }
  return [st(handLine(rng, w1, tip, { bow: signed(rng, 0.06) })), st(handLine(rng, t2, w2, { bow: signed(rng, 0.06) }))];
};

/** A shaft polyline + head at its end (and optionally its start). */
const arrowOn = (rng: Rng, shaft: Polyline, h: number, both = false, mode?: "v" | "two"): Drawing => {
  const d: Drawing = [st(shaft)];
  d.push(...arrowHead(rng, shaft[shaft.length - 1], endAngle(shaft), h, mode));
  if (both) d.push(...arrowHead(rng, shaft[0], startAngle(shaft), h * range(rng, 0.85, 1.05), mode));
  return d;
};

// ---------------------------------------------------------------------------
// Arrows
// ---------------------------------------------------------------------------

export const straightArrow = (angle = 0, both = false): Gen => (rng, S) => {
  const a = rot([-S, signed(rng, 0.05 * S)], angle);
  const b = rot([S * 0.95, signed(rng, 0.05 * S)], angle);
  return arrowOn(rng, handLine(rng, a, b, { bow: signed(rng, 0.04) }), S * 0.3, both);
};

export const curvedArrow = (bend = 0.6, angle = 0, both = false): Gen => (rng, S) => {
  const p = P(S);
  const ctrl: Pt[] = [p(-1, 0.35), p(-0.45, -bend * 0.75), p(0.35, -bend * 0.8), p(0.95, 0.15)].map((q) => rot(q, angle));
  return arrowOn(rng, sketch(rng, ctrl, S, 0.03), S * 0.28, both);
};

export const loopArrow = (flip = 1): Gen => (rng, S) => {
  const p = P(S);
  const ctrl = [p(-1, 0.45), p(-0.5, 0.38), p(0.02, 0.05), p(0.2, -0.4), p(-0.05, -0.72), p(-0.32, -0.45), p(-0.12, -0.02), p(0.4, 0.22), p(0.98, 0.12)].map(
    (q): Pt => [q[0] * flip, q[1]],
  );
  return arrowOn(rng, sketch(rng, ctrl, S, 0.025), S * 0.26);
};

export const uTurnArrow: Gen = (rng, S) => {
  const p = P(S);
  const shaft = sketch(rng, [p(-0.75, 0.9), p(-0.75, -0.1), p(-0.55, -0.7), p(0, -0.9), p(0.55, -0.7), p(0.72, -0.15), p(0.72, 0.6)], S, 0.02);
  return arrowOn(rng, shaft, S * 0.3);
};

export const zigzagArrow: Gen = (rng, S) => {
  const p = P(S);
  const pts = [p(-1, -0.5), p(-0.35, -0.05), p(-0.45, 0.25), p(0.25, 0.1), p(0.15, 0.45), p(0.95, 0.55)].map((q) => add(q, [signed(rng, 0.04 * S), signed(rng, 0.04 * S)]));
  return arrowOn(rng, outline(rng, pts, false), S * 0.28, false, "two");
};

export const wavyArrow: Gen = (rng, S) => {
  const pts: Polyline = [];
  const ph = range(rng, 0, 1);
  for (let i = 0; i <= 80; i++) {
    const t = i / 80;
    pts.push([(-1 + 1.9 * t) * S, Math.sin((t * 2.5 + ph) * Math.PI * 2) * S * 0.16 * (1 - 0.3 * t)]);
  }
  return arrowOn(rng, tremor(rng, pts, S * 0.006), S * 0.27);
};

export const spiralArrow: Gen = (rng, S) => {
  const pts: Polyline = [];
  const turns = range(rng, 1.6, 2.0);
  for (let i = 0; i <= 140; i++) {
    const t = i / 140;
    const a = t * turns * Math.PI * 2 + Math.PI;
    const r = S * (0.08 + 0.48 * t);
    pts.push([r * Math.cos(a) - S * 0.25, r * Math.sin(a) * 0.9]);
  }
  const last = pts[pts.length - 1];
  const exit = sketch(rng, [last, add(last, [S * 0.5, -S * 0.2]), [S * 0.95, -S * 0.55]], S, 0.01);
  return arrowOn(rng, tremor(rng, [...pts, ...exit.slice(1)], S * 0.006), S * 0.26);
};

export const elbowArrow: Gen = (rng, S) => {
  const p = P(S);
  return arrowOn(rng, outline(rng, [p(-0.9, -0.7), p(-0.9, 0.45), p(0.9, 0.45)], false), S * 0.28);
};

export const blockArrow: Gen = (rng, S) => {
  const p = P(S);
  const pts = [p(-0.95, -0.22), p(0.25, -0.24), p(0.22, -0.55), p(0.95, 0.02), p(0.2, 0.56), p(0.24, 0.23), p(-0.93, 0.21)];
  return [st(outline(rng, pts, true, 0.08))];
};

export const dashedArrow: Gen = (rng, S) => {
  const p = P(S);
  const path = resample(sketch(rng, [p(-1, 0.4), p(-0.4, -0.45), p(0.4, -0.45), p(0.95, 0.25)], S, 0.02), 4);
  const d: Drawing = [];
  const n = path.length;
  const dash = Math.round(n / 9);
  for (let i = 0; i + dash < n - 2; i += Math.round(dash * 1.7)) d.push(st(path.slice(i, i + dash + intRange(rng, -2, 2))));
  d.push(...arrowHead(rng, path[n - 1], endAngle(path), S * 0.27, "v"));
  return d;
};

// ---------------------------------------------------------------------------
// Circles, ovals, frames
// ---------------------------------------------------------------------------

export const circle = (rxk = 1, ryk = 0.8, sweep?: number, tilt?: number): Gen => (rng, S) => [
  st(handEllipse(rng, [0, 0], S * rxk, S * ryk, { sweep, tilt })),
];

export const scribbleCircle = (loops = 2.2): Gen => (rng, S) => [
  st(handEllipse(rng, [0, 0], S * 0.95, S * 0.72, { sweep: Math.PI * 2 * loops, drift: range(rng, 0.1, 0.16) })),
];

export const roughRect = (w = 1.8, h = 1.2, extra: Record<string, unknown> = {}): Gen => (rng, S) =>
  roughStrokes(
    { kind: "rectangle", x: (-w / 2) * S, y: (-h / 2) * S, w: w * S, h: h * S },
    hash("rect", rng()),
    { roughness: 1.1, bowing: 1.5, join: 0.02 * S, ...extra },
  ).map((l) => st(l));

export const roughEllipse = (w = 1.9, h = 1.3, extra: Record<string, unknown> = {}): Gen => (rng, S) =>
  roughStrokes({ kind: "ellipse", x: 0, y: 0, w: w * S, h: h * S }, hash("ell", rng()), { roughness: 1.2, ...extra }).map((l) => st(l));

export const roundedFrame: Gen = (rng, S) => {
  const w = S * 0.95;
  const h = S * 0.62;
  const r = S * 0.2;
  const pts: Polyline = [];
  const corner = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i <= 8; i++) pts.push([cx + Math.cos(a0 + (i / 8) * Math.PI * 0.5) * r, cy + Math.sin(a0 + (i / 8) * Math.PI * 0.5) * r]);
  };
  corner(w - r, -h + r, -Math.PI / 2);
  corner(w - r, h - r, 0);
  corner(-w + r, h - r, Math.PI / 2);
  corner(-w + r, -h + r, Math.PI);
  pts.push(add(pts[0], [S * 0.08, signed(rng, S * 0.03)]));
  return [st(tremor(rng, resample(pts.map((q) => add(q, [signed(rng, S * 0.01), signed(rng, S * 0.01)])), 8), S * 0.012))];
};

export const cloudFrame: Gen = (rng, S) => {
  const pts: Polyline = [];
  const bumps = intRange(rng, 8, 10);
  for (let b = 0; b < bumps; b++) {
    const a0 = (b / bumps) * Math.PI * 2;
    const a1 = ((b + 1) / bumps) * Math.PI * 2;
    const p0: Pt = [Math.cos(a0) * S * 0.9, Math.sin(a0) * S * 0.6];
    const p1: Pt = [Math.cos(a1) * S * 0.9, Math.sin(a1) * S * 0.6];
    const mid = lerp(p0, p1, 0.5);
    const outward = mul([Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2) * 0.7], S * range(rng, 0.2, 0.3));
    const seg = quad(p0, add(mid, mul(outward, 1.6)), p1, 16);
    pts.push(...(b === 0 ? seg : seg.slice(1)));
  }
  pts.push(add(pts[1], [S * 0.03, S * 0.02]));
  return [st(tremor(rng, pts, S * 0.008))];
};

export const cornerFrame: Gen = (rng, S) => {
  const w = S * 0.95;
  const h = S * 0.65;
  const k = S * 0.32;
  const c = (x: number, y: number, dx: number, dy: number) =>
    st(outline(rng, [[x + dx * k * range(rng, 0.8, 1.1), y], [x, y], [x, y + dy * k * range(rng, 0.8, 1.1)]], false));
  return [c(-w, -h, 1, 1), c(w, -h, -1, 1), c(w, h, -1, -1), c(-w, h, 1, -1)];
};

export const spikyFrame: Gen = (rng, S) => {
  const n = intRange(rng, 14, 18);
  const pts: Pt[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2;
    const r = i % 2 ? range(rng, 0.68, 0.78) : range(rng, 0.92, 1.05);
    pts.push([Math.cos(a) * r * S, Math.sin(a) * r * S * 0.7]);
  }
  return [st(outline(rng, pts, true, 0.05))];
};

export const blobFrame: Gen = (rng, S) => {
  const ctrl: Pt[] = [];
  const n = 7;
  const a0 = range(rng, 0, 6);
  for (let i = 0; i <= n + 1; i++) {
    const a = a0 + (i / n) * Math.PI * 2;
    ctrl.push([Math.cos(a) * S * range(rng, 0.8, 1), Math.sin(a) * S * range(rng, 0.5, 0.68)]);
  }
  return [st(sketch(rng, ctrl, S, 0.01))];
};

export const doubleRect: Gen = (rng, S) => {
  const p = P(S);
  const a = outline(rng, [p(-0.95, -0.6), p(0.92, -0.62), p(0.95, 0.6), p(-0.93, 0.62)], true);
  const b = outline(rng, [p(-0.86, -0.5), p(0.84, -0.52), p(0.86, 0.5), p(-0.84, 0.52)], true);
  return [st(a), st(b)];
};

// ---------------------------------------------------------------------------
// Lines: underlines, strike-throughs, highlights, dividers
// ---------------------------------------------------------------------------

export const underline = (flick = false): Gen => (rng, S) => {
  const pts = tremor(rng, handLine(rng, [-S, S * 0.02], [S, -S * 0.04], { bow: range(rng, -0.05, 0.02) }), S * 0.006, 4);
  if (flick) pts.push(add(pts[pts.length - 1], [S * range(rng, 0.03, 0.08), -S * range(rng, 0.06, 0.13)]));
  return [st(pts)];
};

export const doubleUnderline: Gen = (rng, S) => [
  st(handLine(rng, [-S, 0], [S, -S * 0.02])),
  st(handLine(rng, [-S * 0.85, S * 0.12], [S * 0.8, S * 0.1])),
];

export const wavyLine = (amp = 0.06, waves = 5): Gen => (rng, S) => {
  const pts: Polyline = [];
  const ph = range(rng, 0, Math.PI * 2);
  for (let i = 0; i <= 120; i++) {
    const t = i / 120;
    pts.push([(-1 + 2 * t) * S, Math.sin(t * waves * Math.PI * 2 + ph) * amp * S * (1 + 0.2 * Math.sin(t * 7))]);
  }
  return [st(tremor(rng, pts, S * 0.003))];
};

export const zigzagLine = (amp = 0.06, n = 12): Gen => (rng, S) => {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) pts.push([(-1 + (2 * i) / n) * S + signed(rng, S * 0.01), (i % 2 ? amp : -amp) * S * range(rng, 0.8, 1.15)]);
  return [st(outline(rng, pts, false))];
};

export const loopyLine = (loops = 6): Gen => (rng, S) => {
  const pts: Polyline = [];
  for (let i = 0; i <= 260; i++) {
    const t = i / 260;
    const a = t * loops * Math.PI * 2;
    pts.push([(-1 + 2 * t) * S - Math.sin(a) * S * 0.07, -Math.cos(a) * S * 0.07 + S * 0.03]);
  }
  return [st(tremor(rng, pts, S * 0.003))];
};

export const swoosh: Gen = (rng, S) => [st(sketch(rng, [[-S, S * 0.06], [-S * 0.2, S * 0.1], [S * 0.5, -S * 0.02], [S, -S * 0.16]], S, 0.01), 1.8)];

export const strike = (n = 1): Gen => (rng, S) =>
  Array.from({ length: n }, (_, i) => st(handLine(rng, [-S, S * (0.02 - i * 0.1)], [S, S * (-0.03 - i * 0.1)], { bow: signed(rng, 0.015) })));

export const scribbleOut = (h = 0.18, passes = 9): Gen => (rng, S) => {
  const pts: Pt[] = [];
  for (let i = 0; i <= passes; i++) {
    const x = (-1 + (2 * i) / passes) * S * 0.95 + signed(rng, S * 0.02);
    pts.push([x, (i % 2 ? h : -h) * S * range(rng, 0.8, 1.1)]);
  }
  return [st(sketch(rng, pts, S, 0.004, 0.002))];
};

/** Fat translucent highlighter swipe (alpha is applied by the renderer). */
export const highlighter = (n = 1): Gen => (rng, S) =>
  Array.from({ length: n }, (_, i) => ({
    pts: handLine(rng, [-S, S * (i * 0.17 - (n - 1) * 0.08)], [S, S * (i * 0.17 - (n - 1) * 0.08 - 0.02)], { bow: signed(rng, 0.01) }),
    weight: 7,
    alpha: 0.32,
  }));

export const dashedLine = (n = 9): Gen => (rng, S) => {
  const d: Drawing = [];
  const step = (2 * S) / n;
  for (let i = 0; i < n; i++) {
    const x0 = -S + i * step + signed(rng, step * 0.06);
    const y = signed(rng, S * 0.01);
    d.push(st(handLine(rng, [x0, y], [x0 + step * range(rng, 0.5, 0.65), y + signed(rng, S * 0.01)])));
  }
  return d;
};

export const arrowUnderline: Gen = (rng, S) => arrowOn(rng, handLine(rng, [-S, S * 0.03], [S * 0.92, -S * 0.02]), S * 0.14, false, "v");

export const dotLine: Gen = (rng, S) => {
  const d: Drawing = [st(handLine(rng, [-S * 0.82, 0], [S * 0.82, signed(rng, S * 0.01)]))];
  d.push(dot(rng, [-S * 0.95, 0], S * 0.025), dot(rng, [S * 0.95, 0], S * 0.025));
  return d;
};

/** A small ink dot: a tiny tight loop drawn heavy. */
export const dot = (rng: Rng, c: Pt, r: number): StrokeDef => ({
  pts: handEllipse(rng, c, r, r * range(rng, 0.8, 1), { sweep: Math.PI * 2.6, drift: 0.2 }),
  weight: 1.5,
});

export const vineDivider: Gen = (rng, S) => {
  const stem = wavyLine(0.05, 2)(rng, S)[0].pts;
  const d: Drawing = [st(stem)];
  for (let i = 1; i < 8; i++) {
    const k = Math.round((i / 8) * (stem.length - 1));
    const b = stem[k];
    const side = i % 2 ? -1 : 1;
    const tip = add(b, [S * 0.1, side * S * 0.1]);
    const leaf = [...quad(b, add(lerp(b, tip, 0.5), [-S * 0.03, side * -S * 0.04]), tip, 10), ...quad(tip, add(lerp(b, tip, 0.5), [S * 0.04, side * S * 0.03]), b, 10).slice(1)];
    d.push(st(leaf, 0.8));
  }
  return d;
};

export const flourishDivider: Gen = (rng, S) => {
  const half = (sx: number): Polyline =>
    sketch(rng, [[0, 0], [sx * S * 0.25, -S * 0.08], [sx * S * 0.4, S * 0.02], [sx * S * 0.32, S * 0.08], [sx * S * 0.26, 0], [sx * S * 0.5, -S * 0.04], [sx * S * 0.95, 0]].map((q): Pt => [q[0], q[1]]), S, 0.006);
  return [st(half(-1)), st(half(1)), dot(rng, [0, -S * 0.1], S * 0.025)];
};

export const scallopLine: Gen = (rng, S) => {
  const pts: Polyline = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a: Pt = [(-1 + (2 * i) / n) * S, 0];
    const b: Pt = [(-1 + (2 * (i + 1)) / n) * S, 0];
    const seg = quad(a, add(lerp(a, b, 0.5), [0, S * range(rng, 0.13, 0.17)]), b, 12);
    pts.push(...(i ? seg.slice(1) : seg));
  }
  return [st(tremor(rng, pts, S * 0.003))];
};

export const starDivider: Gen = (rng, S) => [
  st(handLine(rng, [-S, 0], [-S * 0.14, 0])),
  ...star5(rng, S * 0.1),
  st(handLine(rng, [S * 0.14, 0], [S, 0])),
];

export const arrowsDivider: Gen = (rng, S) => arrowOn(rng, handLine(rng, [-S, 0], [S, signed(rng, S * 0.01)]), S * 0.08, true, "v");

export const dotsRow: Gen = (rng, S) => Array.from({ length: 11 }, (_, i) => dot(rng, [(-1 + i * 0.2) * S, signed(rng, S * 0.01)], S * 0.018));

// ---------------------------------------------------------------------------
// Stars, sparkles, emphasis
// ---------------------------------------------------------------------------

/** One-stroke pentagram via Rough.js (single stroke, joined). */
export const star5 = (rng: Rng, S: number): Drawing => {
  const a0 = -Math.PI / 2 + signed(rng, 0.12);
  const pts: Pt[] = [];
  for (let i = 0; i <= 5; i++) {
    const a = a0 + i * ((Math.PI * 4) / 5) + signed(rng, 0.09);
    pts.push([Math.cos(a) * S * range(rng, 0.82, 1.1), Math.sin(a) * S * range(rng, 0.82, 1.1)]);
  }
  // The last edge stops short or runs past the start.
  pts[5] = add(lerp(pts[4], pts[5], rng() < 0.5 ? range(rng, 0.82, 0.92) : range(rng, 1.06, 1.14)), [signed(rng, S * 0.06), signed(rng, S * 0.06)]);
  return roughStrokes({ kind: "linearPath", pts }, hash("star5", rng()), { roughness: 0.7, bowing: 0.8, disableMultiStroke: true, join: S * 0.15 }).map((l) => st(l));
};

export const star5Gen: Gen = (rng, S) => star5(rng, S);

const starPoints = (rng: Rng, S: number, n = 5, inner = 0.45): Pt[] => {
  const pts: Pt[] = [];
  const a0 = -Math.PI / 2 + signed(rng, 0.1);
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? inner * range(rng, 0.9, 1.1) : range(rng, 0.92, 1.05);
    const a = a0 + (i / (n * 2)) * Math.PI * 2;
    pts.push([Math.cos(a) * r * S, Math.sin(a) * r * S]);
  }
  return pts;
};

export const starOutline = (n = 5, inner = 0.45): Gen => (rng, S) => [st(outline(rng, starPoints(rng, S, n, inner), true, 0.05))];

export const roughStar = (fill = false): Gen => (rng, S) =>
  roughStrokes({ kind: "polygon", pts: starPoints(rng, S) }, hash("rstar", rng()), {
    roughness: 0.9,
    fillStyle: "hachure",
    fill: fill ? "x" : undefined,
    hachureGap: S * 0.09,
    hachureAngle: -40,
    disableMultiStroke: !fill ? false : true,
  }).map((l) => st(l, fill ? 0.75 : 1));

/** Four-point sparkle with concave sides. */
export const sparkle = (rng: Rng, c: Pt, S: number, k = 0.18): StrokeDef => {
  const pts: Polyline = [];
  const tips: Pt[] = [0, 1, 2, 3].map((i) => add(c, polar(S * (i % 2 ? 0.75 : 1) * range(rng, 0.9, 1.08), -Math.PI / 2 + (i * Math.PI) / 2)));
  for (let i = 0; i < 4; i++) {
    const seg = quad(tips[i], add(c, mul(sub(lerp(tips[i], tips[(i + 1) % 4], 0.5), c), k)), tips[(i + 1) % 4], 12);
    pts.push(...(i ? seg.slice(1) : seg));
  }
  pts.push(add(tips[0], [signed(rng, S * 0.06), S * 0.05]));
  return st(tremor(rng, pts, S * 0.006));
};

export const sparkleGen: Gen = (rng, S) => [sparkle(rng, [0, 0], S)];
export const sparkleCluster: Gen = (rng, S) => [sparkle(rng, [-S * 0.2, S * 0.1], S * 0.7), sparkle(rng, [S * 0.6, -S * 0.5], S * 0.35), sparkle(rng, [S * 0.55, S * 0.6], S * 0.25)];

export const burst = (n = 9, r0 = 0.45, r1 = 1, gapAngle = 0): Gen => (rng, S) => {
  const d: Drawing = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + gapAngle + (i / n) * Math.PI * 2 * (gapAngle ? 0.7 : 1) + signed(rng, 0.28);
    const a0 = r0 * range(rng, 0.8, 1.25);
    const a1 = r1 * range(rng, 0.55, 1.1);
    d.push(st(handLine(rng, polar(a0 * S, a), polar(a1 * S, a + signed(rng, 0.04)))));
  }
  return d;
};

export const asterisk: Gen = (rng, S) =>
  [0, 1, 2].map((i) => {
    const a = (i * Math.PI) / 3 + Math.PI / 2 + signed(rng, 0.1);
    return st(handLine(rng, polar(S * range(rng, 0.85, 1), a), polar(S * range(rng, 0.85, 1), a + Math.PI)));
  });

export const twinkle: Gen = (rng, S) => [
  st(handLine(rng, [0, -S], [signed(rng, S * 0.04), S])),
  st(handLine(rng, [-S * 0.8, signed(rng, S * 0.04)], [S * 0.8, 0])),
  dot(rng, [S * 0.62, -S * 0.62], S * 0.06),
];

export const hexStar: Gen = (rng, S) => {
  const tri = (a0: number) => [0, 1, 2].map((i): Pt => polar(S * range(rng, 0.92, 1.04), a0 + (i * Math.PI * 2) / 3));
  return [st(outline(rng, tri(-Math.PI / 2), true)), st(outline(rng, tri(Math.PI / 2), true))];
};

export const shootingStar: Gen = (rng, S) => {
  const c: Pt = [S * 0.45, -S * 0.35];
  return [
    ...starOutline(5, 0.45)(rng, S * 0.4).map((s) => ({ ...s, pts: s.pts.map((p) => add(p, c)) })),
    st(handLine(rng, [S * 0.05, -S * 0.12], [-S * 0.95, S * 0.45])),
    st(handLine(rng, [S * 0.15, S * 0.05], [-S * 0.7, S * 0.62])),
    st(handLine(rng, [S * 0.28, S * 0.2], [-S * 0.35, S * 0.75])),
  ];
};

export const tinyStars: Gen = (rng, S) => [
  ...starOutline()(rng, S * 0.45).map((s) => ({ ...s, pts: s.pts.map((p) => add(p, [-S * 0.4, S * 0.3])) })),
  ...starOutline()(rng, S * 0.3).map((s) => ({ ...s, pts: s.pts.map((p) => add(p, [S * 0.45, -S * 0.1])) })),
  ...starOutline()(rng, S * 0.22).map((s) => ({ ...s, pts: s.pts.map((p) => add(p, [-S * 0.1, -S * 0.65])) })),
];

export const sparkle8: Gen = (rng, S) => [sparkle(rng, [0, 0], S, 0.16), st(handLine(rng, [-S * 0.42, -S * 0.42], [S * 0.42, S * 0.42]), 0.7), st(handLine(rng, [S * 0.42, -S * 0.42], [-S * 0.42, S * 0.42]), 0.7)];

export const sunDot: Gen = (rng, S) => [
  st(handEllipse(rng, [0, 0], S * 0.3, S * 0.3)),
  ...burst(10, 0.48, 0.92)(rng, S),
];

export const starMotion: Gen = (rng, S) => [
  ...starOutline()(rng, S * 0.55).map((s) => ({ ...s, pts: s.pts.map((p) => add(p, [S * 0.3, 0])) })),
  st(handLine(rng, [-S * 0.4, -S * 0.25], [-S, -S * 0.25])),
  st(handLine(rng, [-S * 0.38, S * 0.05], [-S * 0.85, S * 0.05])),
  st(handLine(rng, [-S * 0.4, S * 0.33], [-S * 0.95, S * 0.33])),
];

export const motionLines: Gen = (rng, S) =>
  [-0.4, -0.05, 0.3, 0.6].map((y, i) => st(handLine(rng, [-S * range(rng, 0.6, 1), y * S], [S * (i % 2 ? 0.7 : 1), y * S + signed(rng, S * 0.02)])));

export const exclamationFan: Gen = (rng, S) =>
  [-0.55, 0, 0.55].map((a, i) => {
    const ang = -Math.PI / 2 + a;
    return st(handLine(rng, polar(S * 0.15, ang), polar(S * (i === 1 ? 1 : 0.8), ang)));
  });

export const surpriseMarks: Gen = (rng, S) => [
  ...exclamationFan(rng, S * 0.7).map((s) => ({ ...s, pts: s.pts.map((p) => add(p, [-S * 0.5, S * 0.2])) })),
  ...exclamationFan(rng, S * 0.7).map((s) => ({ ...s, pts: s.pts.map((p) => add(rot(p, 0.6), [S * 0.45, S * 0.3])) })),
];

export const vibration: Gen = (rng, S) => {
  const arc = (cx: number, r: number, dir: number) => {
    const pts: Polyline = [];
    for (let i = 0; i <= 20; i++) {
      const a = (-0.7 + 1.4 * (i / 20)) * (dir > 0 ? 1 : 1) + (dir > 0 ? 0 : Math.PI);
      pts.push([cx + Math.cos(a) * r, Math.sin(a) * r * 1.1]);
    }
    return st(tremor(rng, pts, S * 0.005));
  };
  return [arc(S * 0.15, S * 0.45, 1), arc(S * 0.15, S * 0.75, 1), arc(-S * 0.15, S * 0.45, -1), arc(-S * 0.15, S * 0.75, -1)];
};

export const dizzySpiral: Gen = (rng, S) => {
  const pts: Polyline = [];
  for (let i = 0; i <= 160; i++) {
    const t = i / 160;
    const a = t * Math.PI * 2 * 3.2;
    pts.push([Math.cos(a) * S * (0.05 + 0.9 * t), Math.sin(a) * S * (0.05 + 0.9 * t) * 0.85]);
  }
  return [st(tremor(rng, pts, S * 0.006))];
};

export const exclamation = (n = 1): Gen => (rng, S) => {
  const d: Drawing = [];
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * S * 0.55;
    d.push(st(handLine(rng, [x + signed(rng, S * 0.04), -S], [x, S * 0.45]), 1.4));
    d.push(dot(rng, [x, S * 0.8], S * 0.07));
  }
  return d;
};

export const cornerLines: Gen = (rng, S) => [
  st(handLine(rng, [-S * 0.1, -S * 0.3], [-S * 0.3, -S * 0.95])),
  st(handLine(rng, [S * 0.05, -S * 0.15], [S * 0.6, -S * 0.7])),
  st(handLine(rng, [S * 0.2, S * 0.05], [S * 0.95, -S * 0.05])),
];

export const sweatDrops: Gen = (rng, S) => {
  const drop = (c: Pt, s: number) => {
    const pts = [...quad(add(c, [0, -s]), add(c, [s * 0.9, s * 0.3]), add(c, [0, s * 0.7]), 14), ...quad(add(c, [0, s * 0.7]), add(c, [-s * 0.9, s * 0.3]), add(c, [s * 0.05, -s * 0.95]), 14).slice(1)];
    return st(tremor(rng, pts, s * 0.02));
  };
  return [drop([-S * 0.3, -S * 0.1], S * 0.5), drop([S * 0.45, S * 0.3], S * 0.35)];
};

export const swooshLines: Gen = (rng, S) =>
  [0, 1, 2].map((i) => st(sketch(rng, [[-S, S * (0.5 - i * 0.12)], [-S * 0.2, S * (0.35 - i * 0.2)], [S * 0.7, -S * (0.2 + i * 0.15)]], S, 0.01)));

export const popBurst: Gen = (rng, S) => [st(outline(rng, starPoints(rng, S, 11, 0.62), true, 0.04))];

export const radiatingArcs: Gen = (rng, S) =>
  [0, 1, 2].map((i) => {
    const r = S * (0.35 + i * 0.3);
    const pts: Polyline = [];
    for (let k = 0; k <= 16; k++) {
      const a = -Math.PI * 0.85 + (k / 16) * Math.PI * 0.55;
      pts.push([Math.cos(a) * r + S * 0.3, Math.sin(a) * r + S * 0.6]);
    }
    return st(tremor(rng, pts, S * 0.005));
  });

// ---------------------------------------------------------------------------
// Checks and crosses
// ---------------------------------------------------------------------------

export const check = (k = 0, curl = 0.0): Gen => (rng, S) => {
  const p = P(S);
  const ctrl = [p(-0.75 - curl, -0.05 - curl * 0.5), p(-0.42, 0.25 + k * 0.05), p(-0.18, 0.55), p(0.2, -0.05), p(0.85 - k * 0.1, -0.8)];
  if (curl) ctrl.unshift(p(-0.72, -0.25));
  return [st(sketch(rng, ctrl, S, 0.025, 0.004))];
};

export const tick: Gen = (rng, S) => [st(outline(rng, [[-S * 0.55, S * 0.05], [-S * 0.2, S * 0.45], [S * 0.6, -S * 0.6]], false))];

export const cross = (k = 1): Gen => (rng, S) => [
  st(handLine(rng, [-S * 0.7 * k, -S * 0.7], [S * 0.68, S * 0.72 * k], { bow: signed(rng, 0.05) })),
  st(handLine(rng, [S * 0.72, -S * 0.66 * k], [-S * 0.65 * k, S * 0.7], { bow: signed(rng, 0.05) })),
];

export const crossLoop: Gen = (rng, S) => {
  const p = P(S);
  return [st(sketch(rng, [p(-0.7, -0.7), p(0.65, 0.7), p(0.8, 0.5), p(0.55, -0.3), p(0.68, -0.72), p(-0.6, 0.7)], S, 0.02))];
};

export const box = (inner: "check" | "cross" | "none"): Gen => (rng, S) => {
  const d: Drawing = roughRect(1.25, 1.25, { roughness: 0.9, disableMultiStroke: true, join: S * 0.12 })(rng, S * 0.8);
  if (inner === "check") d.push(...check(0)(rng, S * 0.95).map((s) => ({ ...s, pts: s.pts.map((q) => add(q, [S * 0.15, -S * 0.12])) })));
  if (inner === "cross") d.push(...cross()(rng, S * 0.62));
  return d;
};

export const ringed = (inner: "check" | "cross"): Gen => (rng, S) => [
  st(handEllipse(rng, [0, 0], S * 0.95, S * 0.9)),
  ...(inner === "check" ? check(0)(rng, S * 0.6) : cross()(rng, S * 0.45)),
];

export const doubleCheck: Gen = (rng, S) => [
  ...check(0)(rng, S * 0.7).map((s) => ({ ...s, pts: s.pts.map((q) => add(q, [-S * 0.3, S * 0.05])) })),
  ...check(0)(rng, S * 0.7).map((s) => ({ ...s, pts: s.pts.map((q) => add(q, [S * 0.3, S * 0.05])) })),
];

// ---------------------------------------------------------------------------
// Brackets and braces
// ---------------------------------------------------------------------------

export const squareBracket = (dir: 1 | -1 = 1): Gen => (rng, S) => {
  const x = -dir * S * 0.25;
  return [st(outline(rng, [[x + dir * S * 0.35, -S], [x, -S * 0.98], [x + signed(rng, S * 0.03), S], [x + dir * S * 0.33, S * 1.01]], false))];
};

export const curlyBrace = (dir: 1 | -1 = 1, horizontal = false): Gen => (rng, S) => {
  const ctrl: Pt[] = [
    [S * 0.25, -S],
    [-S * 0.05, -S * 0.88],
    [0, -S * 0.25],
    [-S * 0.28, 0],
    [0, S * 0.25],
    [-S * 0.03, S * 0.88],
    [S * 0.26, S],
  ].map((q): Pt => [q[0] * dir, q[1]]);
  let pts = sketch(rng, ctrl, S, 0.04);
  if (horizontal) pts = pts.map((q) => [q[1], -q[0] * 1.2]);
  return [st(pts)];
};

export const roundBracket = (dir: 1 | -1 = 1): Gen => (rng, S) => [st(sketch(rng, [[S * 0.2 * dir, -S], [-S * 0.2 * dir, -S * 0.3], [-S * 0.2 * dir, S * 0.35], [S * 0.22 * dir, S]], S, 0.01))];

export const angleBrackets: Gen = (rng, S) => [
  st(outline(rng, [[-S * 0.25, -S * 0.7], [-S * 0.85, 0], [-S * 0.22, S * 0.7]], false)),
  st(outline(rng, [[S * 0.25, -S * 0.7], [S * 0.85, 0], [S * 0.22, S * 0.7]], false)),
];

export const corner = (q: 0 | 1 | 2 | 3): Gen => (rng, S) => {
  const sx = q === 1 || q === 2 ? -1 : 1;
  const sy = q >= 2 ? -1 : 1;
  return [st(outline(rng, [[sx * S * 0.9, -sy * S * 0.6], [-sx * S * 0.6, -sy * S * 0.6], [-sx * S * 0.6, sy * S * 0.9]], false))];
};

export const bracketPair: Gen = (rng, S) => [
  ...squareBracket(1)(rng, S * 0.8).map((s) => ({ ...s, pts: s.pts.map((q) => add(q, [-S * 0.7, 0])) })),
  ...squareBracket(-1)(rng, S * 0.8).map((s) => ({ ...s, pts: s.pts.map((q) => add(q, [S * 0.7, 0])) })),
];

export const doubleBracket: Gen = (rng, S) => [
  ...squareBracket(1)(rng, S).map((s) => ({ ...s, pts: s.pts.map((q) => add(q, [-S * 0.12, 0])) })),
  ...squareBracket(1)(rng, S * 0.85).map((s) => ({ ...s, pts: s.pts.map((q) => add(q, [S * 0.15, 0])) })),
];

// ---------------------------------------------------------------------------
// Hearts
// ---------------------------------------------------------------------------

/** Hand heart, drawn from the top dip round and back, not quite closing. */
export const heartLine = (rng: Rng, S: number, sweep = 1.04, c: Pt = [0, 0]): Polyline => {
  const pts: Polyline = [];
  const lop = signed(rng, 0.08);
  const n = Math.round(120 * sweep);
  for (let i = 0; i <= n; i++) {
    const t = (i / 120) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    const k = 1 + 0.04 * (i / n) + (x > 0 ? lop : -lop);
    pts.push([c[0] + (x / 17) * S * k, c[1] + ((y + 2) / 17) * S * k]);
  }
  return tremor(rng, pts, S * 0.008);
};

export const heart = (sweep = 1.04): Gen => (rng, S) => [st(heartLine(rng, S, sweep))];

export const heartScribble: Gen = (rng, S) => {
  const d: Drawing = [st(heartLine(rng, S))];
  const pts: Pt[] = [];
  for (let i = 0; i <= 9; i++) {
    const y = (-0.45 + i * 0.12) * S;
    const w = Math.max(0.05, 0.75 - Math.abs(y / S - 0.0) * 0.6 - (y > 0 ? (y / S) * 0.55 : 0)) * S;
    pts.push([i % 2 ? w : -w, y]);
  }
  d.push(st(sketch(rng, pts, S, 0.01, 0.002), 0.7));
  return d;
};

export const heartHatch: Gen = (rng, S) => {
  const pts = resample(heartLine(rng, S, 1), S * 0.12);
  return roughStrokes({ kind: "polygon", pts }, hash("hh", rng()), {
    roughness: 0.8,
    fill: "x",
    fillStyle: "hachure",
    hachureGap: S * 0.1,
    hachureAngle: 50,
    disableMultiStroke: true,
    disableMultiStrokeFill: true,
    join: S * 0.05,
  }).map((l, i) => st(l, i === 0 ? 1 : 0.7));
};

export const heartArrow: Gen = (rng, S) => {
  const d: Drawing = [st(heartLine(rng, S * 0.8))];
  d.push(st(handLine(rng, [-S * 1.05, S * 0.55], [-S * 0.6, S * 0.3])));
  d.push(...arrowOn(rng, handLine(rng, [S * 0.55, -S * 0.15], [S * 1.05, -S * 0.42]), S * 0.2, false, "v"));
  return d;
};

export const brokenHeart: Gen = (rng, S) => [st(heartLine(rng, S)), st(outline(rng, [[0, -S * 0.62], [-S * 0.12, -S * 0.3], [S * 0.1, -S * 0.05], [-S * 0.1, S * 0.25], [0, S * 0.7]], false), 0.8)];

export const heartsCluster: Gen = (rng, S) => [
  st(heartLine(rng, S * 0.55, 1.04, [-S * 0.35, S * 0.25])),
  st(heartLine(rng, S * 0.38, 1.04, [S * 0.5, -S * 0.25])),
  st(heartLine(rng, S * 0.25, 1.04, [S * 0.4, S * 0.6])),
];

export const roughHeart: Gen = (rng, S) =>
  roughStrokes({ kind: "polygon", pts: resample(heartLine(rng, S, 1), S * 0.1) }, hash("rh", rng()), { roughness: 0.9, join: S * 0.08 }).map((l) => st(l));

export const beatingHeart: Gen = (rng, S) => [
  st(heartLine(rng, S * 0.7)),
  ...burst(7, 0.85, 1.12, 0.0)(rng, S).filter((_, i) => i !== 3 && i !== 4),
];

export const loopHeart: Gen = (rng, S) => [st(heartLine(rng, S, 2.05))];

export const heartSparkle: Gen = (rng, S) => [st(heartLine(rng, S * 0.85, 1.04, [-S * 0.1, S * 0.1])), sparkle(rng, [S * 0.75, -S * 0.7], S * 0.3)];

// ---------------------------------------------------------------------------
// Bubbles
// ---------------------------------------------------------------------------

export const speechBubble = (tailSide: 1 | -1 = -1, rx = 1, ry = 0.68): Gen => (rng, S) => {
  const a0 = Math.PI / 2 + tailSide * -0.45;
  const sweep = Math.PI * 2 - 0.35;
  const pts: Polyline = [];
  for (let i = 0; i <= 90; i++) {
    const a = a0 + (i / 90) * sweep * tailSide;
    const k = 1 + 0.03 * Math.sin(a * 3) + 0.02 * (i / 90);
    pts.push([Math.cos(a) * S * rx * k, Math.sin(a) * S * ry * k]);
  }
  const end = pts[pts.length - 1];
  const tip: Pt = [tailSide * S * rx * 0.62 + signed(rng, S * 0.05), S * ry * 1.42];
  const out = [...pts, ...handLine(rng, end, tip).slice(1), ...handLine(rng, tip, add(pts[0], [tailSide * S * range(rng, 0.06, 0.12), S * range(rng, -0.02, 0.05)])).slice(1)];
  return [st(tremor(rng, out, S * 0.006))];
};

export const rectBubble: Gen = (rng, S) => {
  const p = P(S);
  return [st(outline(rng, [p(-0.4, 0.5), p(-0.95, 0.5), p(-0.95, -0.6), p(0.95, -0.62), p(0.94, 0.5), p(-0.15, 0.52), p(-0.45, 0.95)], true, 0.03))];
};

export const thoughtBubble: Gen = (rng, S) => [
  ...cloudFrame(rng, S * 0.95).map((s) => ({ ...s, pts: s.pts.map((q) => add(q, [S * 0.05, -S * 0.12])) })),
  st(handEllipse(rng, [-S * 0.55, S * 0.7], S * 0.11, S * 0.09)),
  st(handEllipse(rng, [-S * 0.8, S * 0.9], S * 0.06, S * 0.05)),
];

export const shoutBubble: Gen = (rng, S) => {
  const pts = starPoints(rng, S, 12, 0.72).map((q): Pt => [q[0], q[1] * 0.72]);
  // Stretch one lower spike into a tail.
  pts[14] = [pts[14][0] * 1.25, pts[14][1] * 1.7];
  return [st(outline(rng, pts, true, 0.03))];
};

export const whisperBubble: Gen = (rng, S) => {
  const base = resample(speechBubble(1)(rng, S)[0].pts, 4);
  const d: Drawing = [];
  for (let i = 0; i + 8 < base.length; i += 15) d.push(st(base.slice(i, i + 9)));
  return d;
};

export const roughBubble: Gen = (rng, S) =>
  roughStrokes(
    { kind: "polygon", pts: [[-S * 0.95, -S * 0.6], [S * 0.95, -S * 0.6], [S * 0.95, S * 0.45], [S * 0.1, S * 0.45], [-S * 0.3, S * 0.9], [-S * 0.25, S * 0.45], [-S * 0.95, S * 0.45]] },
    hash("rb", rng()),
    { roughness: 1.0 },
  ).map((l) => st(l));

export const typingBubble: Gen = (rng, S) => [...speechBubble(-1, 0.9, 0.55)(rng, S), dot(rng, [-S * 0.4, 0], S * 0.06), dot(rng, [0, 0], S * 0.06), dot(rng, [S * 0.4, 0], S * 0.06)];

export const doubleBubble: Gen = (rng, S) => [
  ...speechBubble(-1, 0.6, 0.42)(rng, S).map((s) => ({ ...s, pts: s.pts.map((q) => add(q, [-S * 0.38, -S * 0.35])) })),
  ...speechBubble(1, 0.55, 0.38)(rng, S).map((s) => ({ ...s, pts: s.pts.map((q) => add(q, [S * 0.42, S * 0.2])) })),
];

// ---------------------------------------------------------------------------
// Banners and ribbons
// ---------------------------------------------------------------------------

export const notchBanner: Gen = (rng, S) => {
  const p = P(S);
  return [st(outline(rng, [p(-1, -0.28), p(1, -0.3), p(0.85, 0), p(1, 0.29), p(-1, 0.3), p(-0.85, 0)], true, 0.03))];
};

export const ribbonBanner: Gen = (rng, S) => {
  const p = P(S);
  return [
    st(outline(rng, [p(-0.7, -0.32), p(0.7, -0.33), p(0.71, 0.18), p(-0.7, 0.19)], true, 0.03)),
    st(outline(rng, [p(0.7, -0.12), p(1.0, -0.12), p(0.88, 0.1), p(1.0, 0.36), p(0.55, 0.36), p(0.7, 0.18)], false)),
    st(outline(rng, [p(-0.7, -0.12), p(-1.0, -0.12), p(-0.88, 0.1), p(-1.0, 0.36), p(-0.55, 0.36), p(-0.7, 0.18)], false)),
  ];
};

export const archBanner: Gen = (rng, S) => {
  const top: Polyline = [];
  const bot: Polyline = [];
  for (let i = 0; i <= 40; i++) {
    const t = -1 + (2 * i) / 40;
    top.push([t * S * 0.9, S * (-0.35 + 0.28 * t * t)]);
    bot.push([t * S * 0.9, S * (0.05 + 0.28 * t * t)]);
  }
  const notch = (x: number, y0: number, y1: number, dir: number): Polyline => [[x, y0], [x + dir * S * 0.12, (y0 + y1) / 2], [x, y1]];
  const pts: Polyline = [...top, ...notch(top[40][0], top[40][1], bot[40][1], 1).slice(1), ...bot.slice().reverse().slice(1), ...notch(bot[0][0], bot[0][1], top[0][1], -1).slice(1)];
  return [st(tremor(rng, pts, S * 0.006))];
};

export const wavyRibbon: Gen = (rng, S) => {
  const edge = (y: number): Polyline => Array.from({ length: 50 }, (_, i): Pt => [(-0.9 + (1.8 * i) / 49) * S, (y + 0.12 * Math.sin((i / 49) * Math.PI * 2)) * S]);
  const a = edge(-0.2);
  const b = edge(0.15);
  const pts = [...a, [S * 1.0, S * -0.02] as Pt, ...b.slice().reverse(), [-S * 0.78, -S * 0.02] as Pt, a[0]];
  return [st(tremor(rng, pts, S * 0.006))];
};

export const scroll: Gen = (rng, S) => {
  const p = P(S);
  const d: Drawing = [st(outline(rng, [p(-0.75, -0.4), p(0.75, -0.42), p(0.76, 0.4), p(-0.74, 0.42)], true, 0.02))];
  const roll = (x: number, dir: number) => {
    const pts: Polyline = [];
    for (let i = 0; i <= 50; i++) {
      const t = i / 50;
      const a = -Math.PI / 2 + dir * t * Math.PI * 1.7;
      const r = S * (0.42 - 0.3 * t);
      pts.push([x + dir * Math.cos(a) * r * 0.45, -S * 0.0 + Math.sin(a) * r]);
    }
    return st(tremor(rng, pts, S * 0.004));
  };
  d.push(roll(S * 0.76, 1), roll(-S * 0.75, -1));
  return d;
};

export const pennant: Gen = (rng, S) => [
  st(handLine(rng, [-S * 0.7, S], [-S * 0.68, -S])),
  st(outline(rng, [[-S * 0.68, -S * 0.95], [S * 0.85, -S * 0.55], [-S * 0.68, -S * 0.15]], false)),
];

export const bunting: Gen = (rng, S) => {
  const string: Polyline = Array.from({ length: 60 }, (_, i): Pt => [(-1 + (2 * i) / 59) * S, (0.25 * Math.sin((i / 59) * Math.PI) - 0.35) * S]);
  const d: Drawing = [st(tremor(rng, string, S * 0.004))];
  for (let k = 0; k < 5; k++) {
    const i0 = 4 + k * 11;
    const a = string[i0];
    const b = string[i0 + 8];
    const tip = add(lerp(a, b, 0.5), [signed(rng, S * 0.03), S * 0.32]);
    d.push(st(outline(rng, [a, tip, b], false), 0.9));
  }
  return d;
};

export const tagLabel: Gen = (rng, S) => {
  const p = P(S);
  return [
    st(outline(rng, [p(-0.55, -0.42), p(0.85, -0.43), p(0.86, 0.42), p(-0.55, 0.43), p(-0.9, 0)], true, 0.03)),
    st(handEllipse(rng, [-S * 0.55, 0], S * 0.07, S * 0.07)),
    st(sketch(rng, [p(-0.62, 0), p(-0.85, -0.4), p(-1, -0.75)], S, 0.01), 0.8),
  ];
};

export const rosette: Gen = (rng, S) => {
  const pts: Pt[] = [];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    pts.push(polar(S * (i % 2 ? 0.5 : 0.58) * range(rng, 0.97, 1.03), a));
  }
  const d: Drawing = [st(outline(rng, pts.map((q) => add(q, [0, -S * 0.25])), true, 0.02))];
  d.push(st(handEllipse(rng, [0, -S * 0.25], S * 0.33, S * 0.33), 0.8));
  d.push(st(outline(rng, [[-S * 0.2, S * 0.2], [-S * 0.38, S * 0.95], [-S * 0.2, S * 0.8], [-S * 0.05, S * 0.98], [S * 0.05, S * 0.3]], false)));
  d.push(st(outline(rng, [[S * 0.2, S * 0.22], [S * 0.36, S * 0.95], [S * 0.5, S * 0.78], [S * 0.62, S * 0.9], [S * 0.38, S * 0.15]], false)));
  return d;
};

export const plaque: Gen = (rng, S) => {
  const p = P(S);
  return [st(outline(rng, [p(-0.85, -0.4), p(0.85, -0.42), p(1, -0.25), p(1, 0.25), p(0.85, 0.42), p(-0.85, 0.4), p(-1, 0.25), p(-1, -0.25)], true, 0.03))];
};

export const swallowFlag: Gen = (rng, S) => [
  st(handLine(rng, [-S * 0.75, S], [-S * 0.73, -S])),
  st(outline(rng, [[-S * 0.73, -S * 0.92], [S * 0.85, -S * 0.9], [S * 0.45, -S * 0.5], [S * 0.85, -S * 0.12], [-S * 0.73, -S * 0.14]], false)),
];

export const foldBanner: Gen = (rng, S) => {
  const p = P(S);
  const d = ribbonBanner(rng, S);
  d.push(
    ...roughStrokes({ kind: "polygon", pts: [p(0.7, 0.18), p(0.55, 0.36), p(0.7, 0.36)] }, hash("fold", rng()), {
      fill: "x",
      fillStyle: "hachure",
      hachureGap: S * 0.035,
      roughness: 0.6,
      disableMultiStroke: true,
    }).map((l) => st(l, 0.6)),
  );
  return d;
};

// ---------------------------------------------------------------------------
// Notebook bits
// ---------------------------------------------------------------------------

export const cube: Gen = (rng, S) => {
  const k = S * 0.55;
  const o: Pt = [S * 0.38, -S * 0.32];
  const f: Pt[] = ([[-k, -k * 0.6], [k * 0.8, -k * 0.6], [k * 0.8, k * 1.1], [-k, k * 1.1]] as Pt[]).map((q) => add(q, [-S * 0.15, S * 0.1]));
  const b = f.map((q) => add(q, o));
  return [
    st(outline(rng, f, true, 0.04)),
    st(outline(rng, [b[3], b[0], b[1], b[2]], false)),
    st(outline(rng, [f[2], b[2]], false)),
    st(handLine(rng, f[0], b[0])),
    st(handLine(rng, f[1], b[1])),
    st(handLine(rng, f[3], b[3])),
  ];
};

export const spiral: Gen = (rng, S) => {
  const pts: Polyline = [];
  const turns = range(rng, 3, 3.6);
  for (let i = 0; i <= 200; i++) {
    const t = i / 200;
    const a = t * turns * Math.PI * 2;
    // Coils open unevenly and the centre drifts, as a hand spirals out.
    const r = S * (0.04 + 0.92 * Math.pow(t, 0.85)) * (1 + 0.08 * Math.sin(a * 0.7 + turns));
    pts.push([Math.cos(a) * r + S * 0.08 * t, Math.sin(a) * r * 0.92 - S * 0.05 * t]);
  }
  return [st(tremor(rng, pts, S * 0.01))];
};

export const lightbulb: Gen = (rng, S) => {
  const p = P(S);
  const bulb = sketch(rng, [p(-0.22, 0.35), p(-0.28, 0.1), p(-0.5, -0.2), p(-0.42, -0.62), p(0, -0.85), p(0.42, -0.62), p(0.5, -0.2), p(0.28, 0.1), p(0.22, 0.36)], S, 0.012);
  return [
    st(bulb),
    st(handLine(rng, p(-0.24, 0.48), p(0.24, 0.47))),
    st(handLine(rng, p(-0.22, 0.6), p(0.22, 0.59))),
    st(handLine(rng, p(-0.12, 0.72), p(0.12, 0.72))),
    st(sketch(rng, [p(-0.1, 0.3), p(-0.08, -0.15), p(0, -0.3), p(0.08, -0.15), p(0.1, 0.3)], S, 0.008), 0.7),
    ...[-2.6, -2.0, -1.57, -1.1, -0.5].map((a) => st(handLine(rng, add(p(0, -0.3), polar(S * 0.68, a)), add(p(0, -0.3), polar(S * 0.9, a))), 0.8)),
  ];
};

export const hatchedBox: Gen = (rng, S) =>
  roughStrokes({ kind: "rectangle", x: -S * 0.7, y: -S * 0.5, w: S * 1.4, h: S * 1.0 }, hash("hb", rng()), {
    roughness: 1.1,
    fill: "x",
    fillStyle: "hachure",
    hachureGap: S * 0.13,
    hachureAngle: -41,
    disableMultiStroke: true,
    disableMultiStrokeFill: true,
    join: S * 0.06,
  }).map((l, i) => st(l, i === 0 ? 1 : 0.75));

export const crossHatchBox: Gen = (rng, S) =>
  roughStrokes({ kind: "rectangle", x: -S * 0.6, y: -S * 0.6, w: S * 1.2, h: S * 1.2 }, hash("chb", rng()), {
    roughness: 1.1,
    fill: "x",
    fillStyle: "cross-hatch",
    hachureGap: S * 0.16,
    disableMultiStroke: true,
    disableMultiStrokeFill: true,
    join: S * 0.06,
  }).map((l, i) => st(l, i === 0 ? 1 : 0.7));

export const continuous = (d: Drawing, tol: number): Drawing => joinContinuous(d.map((s) => s.pts), tol).map((pts) => ({ pts }));
