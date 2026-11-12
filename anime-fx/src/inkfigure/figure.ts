// Original stylised fashion-illustration woman, front view, knees up.
// Rest geometry in design px; x relative to her centre line, y absolute.

import type { Pt } from "../lib/math";
import { catmull } from "../lib/path";

export type PartName = "body" | "armL" | "armR" | "neck" | "head" | "bunL" | "bunR";

const mirror = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [-x, y] as Pt);

// right half of torso + legs, top to bottom (x > 0)
const torsoRight: Pt[] = [
  [70, 775], [230, 800], [335, 830], [372, 885], [350, 980], [318, 1080], [300, 1180],
  [272, 1290], [230, 1395], [262, 1490], [330, 1600], [385, 1730], [405, 1880], [418, 2050],
  [425, 2250], [0, 2250],
];
export const BODY: Pt[] = [...torsoRight, ...mirror(torsoRight).reverse().slice(1)];

const armRight: Pt[] = [
  // outer edge down
  [345, 840], [400, 900], [422, 1080], [442, 1300], [466, 1480], [494, 1680], [516, 1800],
  [536, 1900], [526, 1990], [500, 2060], [470, 2030],
  // inner edge up
  [452, 1930], [436, 1800], [408, 1680], [378, 1480], [352, 1310], [330, 1120], [306, 960],
];
export const ARM_R: Pt[] = armRight;
export const ARM_L: Pt[] = mirror(armRight).reverse();

export const NECK: Pt[] = [[-46, 600], [46, 600], [62, 800], [-62, 800]];

export const HEAD = { c: [0, 480] as Pt, rx: 150, ry: 188 }; // hair + face silhouette
export const FACE = { c: [0, 510] as Pt, rx: 130, ry: 156 }; // negative-space face
export const BUNS: { c: Pt; r: number }[] = [
  { c: [-98, 296], r: 54 },
  { c: [98, 296], r: 54 },
];
export const LIPS: Pt = [0, 600];
export const NECK_JOINT: Pt = [0, 660];
export const WAIST: Pt = [0, 1400];
export const PIVOT: Pt = [0, 2950];
export const SHOULDER_R: Pt = [365, 870];
export const SHOULDER_L: Pt = [-365, 870];

export const ellipsePts = (c: Pt, rx: number, ry: number, n = 28): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [c[0] + Math.cos(a) * rx, c[1] + Math.sin(a) * ry] as Pt;
  });

// Resample a closed polygon so the boil jitter has enough points.
export const densify = (pts: Pt[], step = 24): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let k = 0; k < n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  return out;
};

export const PARTS: { name: PartName; pts: Pt[] }[] = [
  { name: "armL", pts: densify(ARM_L) },
  { name: "armR", pts: densify(ARM_R) },
  { name: "body", pts: densify(BODY) },
  { name: "neck", pts: densify(NECK) },
  { name: "bunL", pts: ellipsePts(BUNS[0].c, BUNS[0].r, BUNS[0].r * 0.95, 14) },
  { name: "bunR", pts: ellipsePts(BUNS[1].c, BUNS[1].r, BUNS[1].r * 0.95, 14) },
  { name: "head", pts: ellipsePts(HEAD.c, HEAD.rx, HEAD.ry, 30) },
];

const inPoly = (p: Pt, poly: Pt[]) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};

// Which part (if any) contains a rest-pose point, for the dot targets.
export const partAt = (p: Pt): PartName | null => {
  for (const part of [...PARTS].reverse()) if (inPoly(p, part.pts)) return part.name;
  return null;
};

export const smoothClosed = (pts: Pt[]) => catmull([...pts, pts[0], pts[1]], 3);
