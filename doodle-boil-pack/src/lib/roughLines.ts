import rough from "roughjs";
import type { Options } from "roughjs/bin/core";
import type { Pt } from "./geom";

const generator = rough.generator();

const bez = (p0: Pt, c1: Pt, c2: Pt, p1: Pt, steps: number): Pt[] => {
  const out: Pt[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0],
      u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1],
    ]);
  }
  return out;
};

/**
 * Rough.js fill lines (hachure / zigzag) for a polygon, as polylines.
 * Segments whose ends meet (zigzag) are chained into one continuous scribble when `chain` > 0.
 */
export const roughFill = (poly: Pt[], opts: Options, chain = 0): Pt[][] => {
  const d = generator.polygon(poly, {
    stroke: "none",
    fill: "#000",
    disableMultiStrokeFill: true,
    ...opts,
  });
  const lines: Pt[][] = [];
  for (const set of d.sets) {
    if (set.type !== "fillSketch") continue;
    let cur: Pt[] | null = null;
    let pen: Pt = [0, 0];
    for (const op of set.ops) {
      if (op.op === "move") {
        const p: Pt = [op.data[0], op.data[1]];
        const last = cur?.[cur.length - 1];
        if (!(cur && last && chain > 0 && Math.hypot(last[0] - p[0], last[1] - p[1]) < chain)) {
          if (cur && cur.length > 1) lines.push(cur);
          cur = [p];
        }
        pen = p;
      } else if (op.op === "bcurveTo" && cur) {
        const [a, b, c, e, x, y] = op.data;
        const seg = bez(pen, [a, b], [c, e], [x, y], 8);
        cur.push(...seg);
        pen = [x, y];
      } else if (op.op === "lineTo" && cur) {
        pen = [op.data[0], op.data[1]];
        cur.push(pen);
      }
    }
    if (cur && cur.length > 1) lines.push(cur);
  }
  // Drop degenerate segments rough.js emits at polygon corners.
  return lines.filter((l) => Math.hypot(l[l.length - 1][0] - l[0][0], l[l.length - 1][1] - l[0][1]) > 2);
};
