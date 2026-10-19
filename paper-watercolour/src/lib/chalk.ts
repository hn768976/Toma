import rough from "roughjs";
import type { Drawable, Options } from "roughjs/bin/core";

type P = [number, number];
export type Polyline = P[];

// ---------------------------------------------------------------------------
// A tiny single-stroke "handwriting" font for generic maths symbols.
// Units: em, x 0..~0.5, y 0 (cap height) .. 1 (baseline).
const arc = (cx: number, cy: number, r: number, a0: number, a1: number, n = 14, ry = r): P[] =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * ry];
  });
const scaleGlyph = (g: Polyline[], s: number, dx: number, dy: number) =>
  g.map((l) => l.map(([x, y]) => [x * s + dx, y * s + dy] as P));

const G: Record<string, { w: number; strokes: Polyline[] }> = {
  a: { w: 0.55, strokes: [arc(0.22, 0.73, 0.22, -20, 340, 16, 0.27), [[0.44, 0.45], [0.45, 1.0]]] },
  b: { w: 0.55, strokes: [[[0.02, 0.0], [0.02, 1.0]], arc(0.22, 0.73, 0.21, 180, 540, 16, 0.26)] },
  c: { w: 0.5, strokes: [arc(0.23, 0.73, 0.22, -40, -320, 14, 0.27)] },
  x: { w: 0.52, strokes: [[[0.0, 0.46], [0.44, 1.0]], [[0.44, 0.46], [0.0, 1.0]]] },
  y: { w: 0.52, strokes: [[[0.0, 0.46], [0.22, 0.86]], [[0.45, 0.46], [0.08, 1.3]]] },
  "1": { w: 0.36, strokes: [[[0.06, 0.2], [0.22, 0.0], [0.22, 1.0]]] },
  "2": { w: 0.52, strokes: [[...arc(0.21, 0.25, 0.2, 200, 380, 10), [0.3, 0.55], [0.0, 1.0], [0.46, 0.99]]] },
  "3": { w: 0.5, strokes: [[...arc(0.2, 0.24, 0.2, 210, 450, 10), ...arc(0.2, 0.73, 0.24, -90, 150, 12)]] },
  "4": { w: 0.52, strokes: [[[0.34, 1.0], [0.34, 0.0], [0.0, 0.66], [0.48, 0.66]]] },
  "6": { w: 0.5, strokes: [[[0.38, 0.03], [0.14, 0.25], ...arc(0.22, 0.74, 0.21, 180, 540, 16, 0.25)]] },
  "7": { w: 0.5, strokes: [[[0.0, 0.0], [0.46, 0.0], [0.16, 1.0]], [[0.12, 0.52], [0.38, 0.52]]] },
  "+": { w: 0.56, strokes: [[[0.02, 0.66], [0.48, 0.66]], [[0.25, 0.42], [0.25, 0.9]]] },
  "=": { w: 0.56, strokes: [[[0.02, 0.56], [0.48, 0.55]], [[0.02, 0.8], [0.48, 0.79]]] },
  " ": { w: 0.3, strokes: [] },
  π: { w: 0.62, strokes: [[[0.0, 0.5], [0.56, 0.45]], [[0.16, 0.48], [0.12, 1.0]], [[0.4, 0.47], [0.46, 1.0]]] },
  r: { w: 0.42, strokes: [[[0.02, 0.46], [0.02, 1.0]], [[0.02, 0.68], ...arc(0.22, 0.66, 0.2, 180, 300, 6)]] },
  "√": { w: 0.5, strokes: [[[0.0, 0.62], [0.1, 0.56], [0.22, 1.0], [0.38, -0.08], [1.42, -0.08]]] },
};
G["²"] = { w: 0.3, strokes: scaleGlyph(G["2"].strokes, 0.45, 0.02, -0.12) };

export const textStrokes = (text: string, size: number): { lines: Polyline[]; width: number } => {
  const lines: Polyline[] = [];
  let x = 0;
  for (const ch of text) {
    const g = G[ch];
    if (!g) throw new Error(`No glyph for ${ch}`);
    for (const l of g.strokes) lines.push(l.map(([gx, gy]) => [(x + gx) * size, gy * size] as P));
    x += g.w + 0.12;
  }
  return { lines, width: x * size };
};

// ---------------------------------------------------------------------------
// Rough.js drawables -> polylines (so strokes can be drawn on progressively)
const bez = (p0: P, c1: P, c2: P, p1: P, n: number): P[] =>
  Array.from({ length: n }, (_, i) => {
    const t = (i + 1) / n;
    const u = 1 - t;
    return [
      u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0],
      u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1],
    ];
  });

export const toPolylines = (d: Drawable): Polyline[] => {
  const out: Polyline[] = [];
  for (const set of d.sets) {
    if (set.type === "fillPath") continue;
    let cur: Polyline | null = null;
    for (const op of set.ops) {
      if (op.op === "move") {
        cur = [[op.data[0], op.data[1]]];
        out.push(cur);
      } else if (op.op === "lineTo" && cur) cur.push([op.data[0], op.data[1]]);
      else if (op.op === "bcurveTo" && cur) {
        const p0 = cur[cur.length - 1];
        cur.push(...bez(p0, [op.data[0], op.data[1]], [op.data[2], op.data[3]], [op.data[4], op.data[5]], 6));
      }
    }
  }
  return out.filter((l) => l.length > 1);
};

const gen = rough.generator();
const CHALK: Options = { roughness: 1.35, bowing: 1.6, strokeWidth: 1, disableMultiStroke: false };

const rLines = (lines: Polyline[], seed: number, o: Options = {}) =>
  lines.flatMap((l, i) =>
    toPolylines(
      l.length === 2
        ? gen.line(l[0][0], l[0][1], l[1][0], l[1][1], { ...CHALK, ...o, seed: seed + i })
        : gen.curve(l, { ...CHALK, ...o, seed: seed + i }),
    ),
  );

// ---------------------------------------------------------------------------
// Sketch designs, centred on the origin, in 3840-basis px.
export type Design = "formulaA" | "formulaB" | "formulaC" | "formulaD" | "atom" | "bulb" | "arrow" | "star" | "graph";

const formula = (text: string, size: number, seed: number) => {
  const { lines, width } = textStrokes(text, size);
  return rLines(
    lines.map((l) => l.map(([x, y]) => [x - width / 2, y - size / 2] as P)),
    seed,
    { roughness: 1.0, bowing: 1.0 },
  );
};

export const designStrokes = (d: Design, seed: number): Polyline[] => {
  switch (d) {
    case "formulaA":
      return formula("a²+b²=c²", 170, seed);
    case "formulaB":
      return formula("y=2x+1", 170, seed);
    case "formulaC":
      return formula("√16=4", 160, seed);
    case "formulaD":
      return formula("x+3=7", 160, seed);
    case "atom": {
      const out: Polyline[] = [];
      for (let k = 0; k < 3; k++) {
        const rot = (k * Math.PI) / 3;
        const pts: P[] = Array.from({ length: 33 }, (_, i) => {
          const a = (i / 32) * Math.PI * 2;
          const x = Math.cos(a) * 300;
          const y = Math.sin(a) * 100;
          return [x * Math.cos(rot) - y * Math.sin(rot), x * Math.sin(rot) + y * Math.cos(rot)];
        });
        out.push(...toPolylines(gen.curve(pts, { ...CHALK, seed: seed + k })));
      }
      out.push(...toPolylines(gen.circle(0, 0, 70, { ...CHALK, seed: seed + 5, fill: "x", fillStyle: "hachure", hachureGap: 14 })));
      for (const [x, y] of [[280, 60], [-170, 230], [40, -260]] as P[])
        out.push(...toPolylines(gen.circle(x, y, 26, { ...CHALK, seed: seed + 9 + x, fill: "x", fillStyle: "hachure", hachureGap: 8 })));
      return out;
    }
    case "bulb": {
      const outline: P[] = [
        [-70, 170], [-80, 100], [-150, 10], [-170, -100], [-120, -220], [0, -270], [120, -220], [170, -100], [150, 10], [80, 100], [70, 170],
      ];
      const out = toPolylines(gen.curve(outline, { ...CHALK, seed }));
      for (let i = 0; i < 3; i++) out.push(...rLines([[[-75, 195 + i * 32], [75, 195 + i * 32]]], seed + 20 + i));
      out.push(...rLines([[[-40, 290], [40, 290]]], seed + 30));
      out.push(...rLines([[[-60, 110], [-30, -60], [-10, -10], [10, -60], [30, -10], [60, 110]]], seed + 40));
      for (let i = 0; i < 7; i++) {
        const a = (-160 + i * 23.3 + [4, -6, 3, 7, -4, 5, -7][i]) * (Math.PI / 180);
        const r0 = 230 + [10, -5, 20, 0, 15, -10, 5][i];
        const r1 = r0 + 70 + [20, 40, 0, 30, 10, 45, 15][i];
        out.push(...rLines([[[Math.cos(a) * r0, Math.sin(a) * r0 - 90], [Math.cos(a) * r1, Math.sin(a) * r1 - 90]]], seed + 50 + i));
      }
      return out;
    }
    case "arrow": {
      const pts: P[] = [[-300, 120], [-150, 40], [0, 50], [150, -20], [290, -110]];
      return [
        ...toPolylines(gen.curve(pts, { ...CHALK, seed })),
        ...rLines([[[290, -110], [200, -110]], [[290, -110], [250, -30]]], seed + 3),
      ];
    }
    case "star": {
      const pts: P[] = Array.from({ length: 11 }, (_, i) => {
        const a = ((i % 10) / 10) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? 220 : 90;
        return [Math.cos(a) * r, Math.sin(a) * r];
      });
      return toPolylines(gen.linearPath(pts, { ...CHALK, seed }));
    }
    case "graph": {
      const out = rLines(
        [
          [[-300, 200], [-300, -230]],
          [[-300, 200], [320, 200]],
          [[-300, -230], [-325, -190]],
          [[-300, -230], [-275, -190]],
          [[320, 200], [280, 175]],
          [[320, 200], [280, 225]],
        ],
        seed,
      );
      const curve: P[] = Array.from({ length: 9 }, (_, i) => {
        const x = -270 + i * 68;
        return [x, 170 - Math.pow((i / 8), 1.8) * 330 + Math.sin(i * 1.3) * 18];
      });
      out.push(...toPolylines(gen.curve(curve, { ...CHALK, seed: seed + 11 })));
      for (let i = 1; i <= 4; i++) out.push(...rLines([[[-300 + i * 130, 188], [-300 + i * 130, 214]]], seed + 20 + i));
      return out;
    }
  }
};

export const polyLength = (lines: Polyline[]) =>
  lines.reduce((s, l) => s + l.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - l[i][0], p[1] - l[i][1]), 0), 0);

/** Strokes the first `frac` of the total path length (writing order). */
export const strokePartial = (
  ctx: CanvasRenderingContext2D,
  lines: Polyline[],
  frac: number,
  /** optional per-stroke styling (pressure); each polyline is then stroked on its own */
  styler?: (index: number) => void,
) => {
  if (frac <= 0) return;
  const total = polyLength(lines);
  let budget = total * Math.min(1, frac);
  ctx.beginPath();
  for (let li = 0; li < lines.length; li++) {
    const l = lines[li];
    if (budget <= 0) break;
    if (styler) {
      ctx.stroke();
      ctx.beginPath();
      styler(li);
    }
    ctx.moveTo(l[0][0], l[0][1]);
    for (let i = 1; i < l.length; i++) {
      const seg = Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]);
      if (seg >= budget) {
        const t = budget / seg;
        ctx.lineTo(l[i - 1][0] + (l[i][0] - l[i - 1][0]) * t, l[i - 1][1] + (l[i][1] - l[i - 1][1]) * t);
        budget = 0;
        break;
      }
      ctx.lineTo(l[i][0], l[i][1]);
      budget -= seg;
    }
  }
  ctx.stroke();
};
