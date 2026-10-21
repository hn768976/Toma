/**
 * Chalk diagrams. Outlines are hand-wobbled polylines (rendered later with
 * perfect-freehand); hatching comes from a seeded Rough.js generator.
 * Units are 4K pixels; each builder returns strokes in drawing order.
 */
import rough from "roughjs/bin/rough";
import type { Drawable } from "roughjs/bin/core";
import { mulberry32 } from "../lib/random";
import { layoutFormula, Pt, Stroke, textBox, Tok } from "./strokes";

type V = [number, number];
const LW = 7; // outline width
const HW = 4; // hatch width

const gen = rough.generator();

/** Polyline through points with a gentle hand wobble. */
const wobbly = (pts: V[], seed: number, w = LW, amp = 2.5): Stroke => {
  const r = mulberry32(seed);
  const out: Pt[] = [];
  const p1 = r() * 6.28;
  const p2 = r() * 6.28;
  let run = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) run += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const j = amp * (Math.sin(run / 60 + p1) * 0.6 + Math.sin(run / 23 + p2) * 0.4);
    // perpendicular-ish jitter: use both axes, small
    out.push([pts[i][0] + j * 0.5, pts[i][1] + j, w]);
  }
  return { kind: "ink", pts: out };
};

/** Straight segment, subdivided so the wobble and draw-on work. */
const seg = (a: V, b: V, seed: number, w = LW): Stroke => {
  const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 12));
  const pts: V[] = [];
  for (let i = 0; i <= n; i++) pts.push([a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]);
  return wobbly(pts, seed, w);
};

const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, seed: number, w = LW) => {
  const n = Math.max(8, Math.ceil((Math.abs(a1 - a0) * Math.max(rx, ry)) / 10));
  const pts: V[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return wobbly(pts, seed, w);
};

/** Dashed version of a stroke (for hidden edges). */
const dashed = (s: Stroke, on = 26, off = 16): Stroke[] => {
  const out: Stroke[] = [];
  let cur: Pt[] = [];
  let acc = 0;
  let drawing = true;
  for (let i = 0; i < s.pts.length; i++) {
    if (i > 0) acc += Math.hypot(s.pts[i][0] - s.pts[i - 1][0], s.pts[i][1] - s.pts[i - 1][1]);
    if (drawing) cur.push(s.pts[i]);
    if (acc > (drawing ? on : off)) {
      if (drawing && cur.length > 1) out.push({ kind: "ink", pts: cur });
      cur = [];
      acc = 0;
      drawing = !drawing;
    }
  }
  if (drawing && cur.length > 1) out.push({ kind: "ink", pts: cur });
  return out;
};

/** Convert a Rough.js hachure fill into strokes. */
const roughHatch = (poly: V[], seed: number, gap = 16, angle = -41): Stroke[] => {
  const d: Drawable = gen.polygon(poly, {
    seed: (seed % 2147483646) + 1,
    stroke: "none",
    fill: "white",
    fillStyle: "hachure",
    hachureGap: gap,
    hachureAngle: angle,
    roughness: 1.1,
    fillWeight: HW,
  });
  const strokes: Stroke[] = [];
  for (const set of d.sets) {
    if (set.type !== "fillSketch") continue;
    let cur: Pt[] = [];
    let last: V = [0, 0];
    for (const op of set.ops) {
      if (op.op === "move") {
        if (cur.length > 1) strokes.push({ kind: "hatch", pts: cur });
        last = [op.data[0], op.data[1]];
        cur = [[last[0], last[1], HW]];
      } else if (op.op === "lineTo") {
        last = [op.data[0], op.data[1]];
        cur.push([last[0], last[1], HW]);
      } else if (op.op === "bcurveTo") {
        const [x1, y1, x2, y2, x, y] = op.data;
        for (let i = 1; i <= 6; i++) {
          const t = i / 6;
          const u = 1 - t;
          cur.push([
            u * u * u * last[0] + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x,
            u * u * u * last[1] + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y,
            HW,
          ]);
        }
        last = [x, y];
      }
    }
    if (cur.length > 1) strokes.push({ kind: "hatch", pts: cur });
  }
  // Rough.js emits each hachure line twice (double stroke); keep both, it reads as chalk.
  return strokes;
};

const label = (t: string | Tok[], size: number, x: number, y: number): Stroke[] => {
  const b = typeof t === "string" ? textBox(t, size) : layoutFormula(t, size);
  return b.strokes.map((s) => ({ ...s, pts: s.pts.map(([px, py, w]) => [px + x, py + y, w] as Pt) }));
};

export type Diagram = { strokes: Stroke[]; w: number; h: number };

const ellipsePoly = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 24): V[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as V;
  });

export const cone = (seed: number): Diagram => {
  const apex: V = [170, 20];
  const cy = 360;
  const rx = 125;
  const ry = 38;
  const left: V = [170 - rx, cy];
  const right: V = [170 + rx, cy];
  const body: V[] = [apex, ...ellipsePoly(170, cy, rx, ry, Math.PI, 0, 20).reverse()];
  return {
    strokes: [
      seg(apex, left, seed + 1),
      seg(apex, right, seed + 2),
      arc(170, cy, rx, ry, 0, Math.PI, seed + 3),
      ...dashed(arc(170, cy, rx, ry, Math.PI, Math.PI * 2, seed + 4)),
      ...dashed(seg(apex, [170, cy], seed + 5, 5), 18, 12),
      seg([170, cy], [170 + rx, cy], seed + 6, 5),
      ...roughHatch(body, seed + 7, 15, -50),
      ...label("r", 70, 205, cy - 12),
      ...label("h", 70, 120, 230),
    ],
    w: 340,
    h: 410,
  };
};

export const sphere = (seed: number): Diagram => {
  const c = 170;
  const R = 150;
  return {
    strokes: [
      arc(c, c, R, R, -0.3, Math.PI * 2 - 0.2, seed + 1),
      arc(c, c, R, 40, 0, Math.PI, seed + 2),
      ...dashed(arc(c, c, R, 40, Math.PI, Math.PI * 2, seed + 3)),
      arc(c, c - 75, R * 0.86, 30, 0, Math.PI, seed + 4, 5),
      arc(c, c + 75, R * 0.86, 30, 0, Math.PI, seed + 5, 5),
      arc(c, c, 55, R, -Math.PI / 2, Math.PI / 2, seed + 6, 5),
      ...dashed(seg([c, c], [c + R, c - 2], seed + 7, 5), 16, 10),
      ...label("r", 64, c + 60, c - 14),
    ],
    w: 340,
    h: 340,
  };
};

/** Right angle at C (opposite the hypotenuse c), angle A = 44°. */
export const triangle = (seed: number): Diagram => {
  const b = 330; // side CA
  const a = b * Math.tan((44 * Math.PI) / 180); // side BC
  const C: V = [70, 60 + a];
  const B: V = [70, 60];
  const A: V = [70 + b, 60 + a];
  const s = 34;
  const angA = Math.PI; // arc around A, from CA towards AB
  const toB = Math.atan2(B[1] - A[1], B[0] - A[0]);
  return {
    strokes: [
      seg(C, A, seed + 1),
      seg(A, B, seed + 2),
      seg(B, C, seed + 3),
      wobbly([[C[0], C[1] - s], [C[0] + s, C[1] - s], [C[0] + s, C[1]]], seed + 4, 5),
      arc(A[0], A[1], 70, 70, angA, toB + Math.PI * 2 * (toB < 0 ? 1 : 0), seed + 5, 5),
      ...label("A", 72, A[0] + 12, A[1] + 20),
      ...label("B", 72, B[0] - 22, B[1] - 14),
      ...label("C", 72, C[0] - 62, C[1] + 22),
      ...label("44°", 60, A[0] - 190, A[1] - 24),
      ...label("a", 62, C[0] - 50, (B[1] + C[1]) / 2 + 20),
      ...label("b", 62, (C[0] + A[0]) / 2 - 10, C[1] + 70),
      ...label("c", 62, (A[0] + B[0]) / 2 + 22, (A[1] + B[1]) / 2 - 10),
    ],
    w: 70 + b + 70,
    h: 60 + a + 90,
  };
};

export const goldenSpiral = (seed: number): Diagram => {
  // Fibonacci squares 1,1,2,3,5,8 (unit 30), spiralling; quarter arcs inside.
  const u = 30;
  const squares: { x: number; y: number; s: number; a0: number; cx: number; cy: number }[] = [];
  // Build in a 13x8 golden rectangle, largest square first (left), turning clockwise.
  // Squares (in units): [x, y, size, arc start angle, arc centre]
  const spec: [number, number, number, number, number, number][] = [
    [0, 0, 8, Math.PI, 8, 8],
    [8, 0, 5, -Math.PI / 2, 8, 5],
    [10, 5, 3, 0, 10, 5],
    [8, 6, 2, Math.PI / 2, 10, 6],
    [8, 5, 1, Math.PI, 9, 6],
    [9, 5, 1, -Math.PI / 2, 9, 6],
  ];
  for (const [x, y, s, a0, cx, cy] of spec) squares.push({ x: x * u, y: y * u, s: s * u, a0, cx: cx * u, cy: cy * u });
  const o = 20;
  const strokes: Stroke[] = [];
  squares.forEach((q, i) => {
    strokes.push(
      wobbly(
        [[q.x + o, q.y + o], [q.x + q.s + o, q.y + o], [q.x + q.s + o, q.y + q.s + o], [q.x + o, q.y + q.s + o], [q.x + o, q.y + o]],
        seed + i,
        5,
        1.5,
      ),
    );
  });
  squares.forEach((q, i) => {
    strokes.push(arc(q.cx + o, q.cy + o, q.s, q.s, q.a0, q.a0 + Math.PI / 2, seed + 20 + i, 6.5));
  });
  return { strokes, w: 13 * u + 2 * o, h: 8 * u + 2 * o };
};

export const sineGraph = (seed: number): Diagram => {
  const x0 = 60;
  const y0 = 200;
  const L = 520;
  const A = 120;
  const fx = (t: number) => x0 + (t / (2 * Math.PI)) * L;
  const sinPts: V[] = [];
  const cosPts: V[] = [];
  for (let i = 0; i <= 80; i++) {
    const t = (i / 80) * 2 * Math.PI;
    sinPts.push([fx(t), y0 - A * Math.sin(t)]);
    cosPts.push([fx(t), y0 - A * Math.cos(t)]);
  }
  const hump: V[] = sinPts.slice(0, 41).concat([[fx(Math.PI), y0], [fx(0), y0]]);
  const trough: V[] = sinPts.slice(40).concat([[fx(2 * Math.PI), y0], [fx(Math.PI), y0]]);
  return {
    strokes: [
      seg([x0 - 20, y0], [x0 + L + 40, y0], seed + 1, 5),
      wobbly([[x0 + L + 22, y0 - 12], [x0 + L + 40, y0], [x0 + L + 22, y0 + 12]], seed + 2, 5),
      seg([x0, y0 + A + 30], [x0, y0 - A - 40], seed + 3, 5),
      wobbly([[x0 - 12, y0 - A - 22], [x0, y0 - A - 40], [x0 + 12, y0 - A - 22]], seed + 4, 5),
      wobbly(sinPts, seed + 5, 6.5, 1.5),
      wobbly(cosPts, seed + 6, 6.5, 1.5),
      ...roughHatch(hump, seed + 7, 15, 50),
      ...roughHatch(trough, seed + 8, 15, -50),
      ...label("y", 56, x0 - 46, y0 - A - 26),
      ...label("x", 56, x0 + L + 30, y0 + 52),
      ...label("π", 52, fx(Math.PI) - 14, y0 + 58),
      ...label("2π", 52, fx(2 * Math.PI) - 34, y0 - 16),
      ...label("sin x", 52, fx(Math.PI / 2) + 30, y0 - A - 6),
      ...label("cos x", 52, fx(Math.PI * 1.25) - 70, y0 + A + 60),
    ],
    w: x0 + L + 100,
    h: y0 + A + 80,
  };
};

export const venn = (seed: number): Diagram => {
  const r = 105;
  const cA: V = [150, 140];
  const cB: V = [290, 140];
  const cC: V = [220, 255];
  // intersection of all three, approximated as polygon of points inside all circles
  const lens: V[] = [];
  for (let i = 0; i <= 90; i++) {
    const a = (i / 90) * Math.PI * 2;
    // walk a small circle around the centroid and clamp to inside all three
    const cx = 220;
    const cy = 180;
    let rr = 120;
    for (let k = 0; k < 40; k++) {
      const px = cx + Math.cos(a) * rr;
      const py = cy + Math.sin(a) * rr;
      const inside = [cA, cB, cC].every((c) => Math.hypot(px - c[0], py - c[1]) <= r);
      if (inside) break;
      rr *= 0.94;
    }
    lens.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return {
    strokes: [
      arc(cA[0], cA[1], r, r, 0, Math.PI * 2, seed + 1, 6),
      arc(cB[0], cB[1], r, r, Math.PI, Math.PI * 3, seed + 2, 6),
      arc(cC[0], cC[1], r, r, -Math.PI / 2, Math.PI * 1.5, seed + 3, 6),
      ...roughHatch(lens, seed + 4, 11, -45),
      ...label("A", 64, cA[0] - 60, cA[1] - 10),
      ...label("B", 64, cB[0] + 30, cB[1] - 10),
      ...label("C", 64, cC[0] - 16, cC[1] + 70),
    ],
    w: 420,
    h: 380,
  };
};

export const DIAGRAMS = { cone, sphere, triangle, goldenSpiral, sineGraph, venn };
export type DiagramName = keyof typeof DIAGRAMS;
