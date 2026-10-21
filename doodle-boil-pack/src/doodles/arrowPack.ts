import { brushPressure, Pt, samplePath, polyPath, smoothPath, Stroke, transformPts } from "../lib/geom";
import { Streak } from "../lib/ink";
import { mulberry32, range, rngFor } from "../lib/random";
import { chevron, endDir, SPACING } from "./common";

// ---------- 7 and 8: twelve brush-ink arrows on a 4 x 3 grid ----------

type ArrowDef = { name: string; shaft: Pt[]; straight?: boolean; headLen?: number; headSpread?: number; openHead?: boolean };

const TAU = Math.PI * 2;

const loopsLine = (x0: number, x1: number, y: number, loops: number, r: number, lift = 0): Pt[] => {
  const pts: Pt[] = [];
  const N = loops * 10;
  for (let i = 0; i <= N; i++) {
    const th = (i / N) * loops * TAU;
    pts.push([x0 + ((x1 - x0) * i) / N + r * 0.85 * Math.sin(th), y - r * (1 - Math.cos(th)) + lift * (i / N)]);
  }
  return pts;
};

// Shapes in a cell-local frame (cell is 960 x 720; drawing stays inside about 640 x 470).
const ARROWS: ArrowDef[] = [
  {
    name: "straight",
    shaft: [
      [270, 175],
      [80, 50],
      [-110, -70],
      [-280, -175],
    ],
  },
  {
    name: "curved",
    shaft: [
      [-300, 190],
      [-170, -20],
      [20, -160],
      [210, -175],
      [260, -60],
      [150, 120],
      [40, 215],
    ],
  },
  {
    name: "loop",
    shaft: [[300, -40], ...loopsLine(230, -170, 40, 2, 120).slice(1), [-235, 30], [-285, 130]],
  },
  {
    name: "spiral",
    shaft: (() => {
      const pts: Pt[] = [];
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const a = Math.PI / 2 + (1 - t) * 1.5 * TAU;
        const r = 45 + 150 * t;
        pts.push([-110 + r * Math.cos(a), -50 + r * Math.sin(a)]);
      }
      pts.push([60, 125], [190, 165], [300, 200]);
      return pts;
    })(),
    headLen: 120,
    openHead: true,
  },
  {
    name: "circle",
    shaft: (() => {
      const pts: Pt[] = [];
      for (let i = 0; i <= 30; i++) {
        const a = 2.35 - (i / 30) * 0.86 * TAU;
        pts.push([30 + 205 * Math.cos(a) * 1.05, 10 + 205 * Math.sin(a)]);
      }
      return pts;
    })(),
  },
  {
    name: "corner",
    straight: true,
    shaft: [
      [300, 190],
      [40, 186],
      [-170, 178],
      [-178, 0],
      [-190, -210],
    ],
  },
  {
    name: "zigzag",
    shaft: [
      [-300, 20],
      [-130, -90],
      [-60, -40],
      [-200, 70],
      [-120, 100],
      [30, -10],
      [110, -20],
      [300, -10],
    ],
  },
  {
    name: "heart-loop",
    shaft: [
      [-310, 180],
      [-140, 190],
      [-10, 160],
      [-150, 20],
      [-170, -110],
      [-80, -170],
      [0, -90],
      [70, -170],
      [170, -110],
      [140, 30],
      [-10, 160],
      [120, 120],
      [220, 20],
      [300, -120],
    ],
    headLen: 120,
    openHead: true,
  },
  {
    name: "straight-right",
    shaft: [
      [-310, 60],
      [-80, 20],
      [120, -15],
      [310, -40],
    ],
  },
  {
    name: "wave",
    shaft: Array.from({ length: 13 }, (_, i) => [-300 + i * 50, 70 * Math.sin((i / 12) * 2 * TAU)] as Pt),
  },
  {
    name: "loop-de-loop",
    shaft: [
      [-310, 140],
      [-120, 70],
      [40, -60],
      [70, -170],
      [-30, -200],
      [-90, -110],
      [20, -10],
      [180, 40],
      [310, 10],
    ],
  },
  {
    name: "arc-down",
    shaft: [
      [-300, -110],
      [-60, -190],
      [170, -150],
      [260, 0],
      [220, 200],
    ],
  },
];

export const CELL = { w: 960, h: 720 };
export const GRID = { cols: 4, rows: 3 };

export type PackArrow = {
  /** Draw order: shaft then head. */
  strokes: Stroke[];
  streaks: Streak[][];
  bbox: { x: number; y: number; w: number; h: number };
  size: number;
};

const streaksFor = (rng: () => number, size: number): Streak[] => {
  const n = 1 + Math.floor(rng() * 2);
  return Array.from({ length: n }, (_, i) => {
    const tail = i >= n - 1;
    return {
      k: tail ? range(rng, -0.5, 0.5) : range(rng, -0.38, 0.38),
      from: tail ? range(rng, 0.55, 0.8) : range(rng, 0.35, 0.6),
      width: tail ? size * range(rng, 0.07, 0.11) : size * range(rng, 0.035, 0.06),
      dash: [range(rng, 60, 200), range(rng, 90, 260), range(rng, 30, 120), range(rng, 140, 320)],
      dashOff: range(rng, 0, 400),
      wander: range(rng, 0.12, 0.3),
      phase: range(rng, 0, 6.28),
    };
  });
};

const BRUSH = 60;

/** The 12 arrows placed in their cells, in grid order. Shared by both packs. */
export const packArrows = (): PackArrow[] =>
  ARROWS.map((a, i) => {
    const rng = rngFor("BrushArrowPack", a.name);
    const col = i % GRID.cols;
    const row = Math.floor(i / GRID.cols);
    const cx = (col + 0.5) * CELL.w;
    const cy = (row + 0.5) * CELL.h;
    const ctrl = transformPts(a.shaft, range(rng, 1.25, 1.33), range(rng, -0.06, 0.06), cx, cy);
    const pts = samplePath(a.straight ? polyPath(ctrl) : smoothPath(ctrl), SPACING);
    const size = BRUSH * range(rng, 0.92, 1.08);
    const shaft: Stroke = { pts, size, thinning: 0.62, pressure: brushPressure(pts.length, rng), taperEnd: size * 2.5 };
    const tip = pts[pts.length - 1];
    const dir = endDir(pts, 8);
    const chev = chevron(tip, dir, (a.headLen ?? 175) * range(rng, 0.9, 1.1), a.headSpread ?? (a.openHead ? 0.5 : 0.42), range(rng, -0.08, 0.08));
    // Solid heads: round the triangle and back toward the tip, so the brush fills it in.
    const headCtrl = a.openHead
      ? chev
      : [...chev, chev[0], [tip[0] * 0.55 + chev[0][0] * 0.225 + chev[2][0] * 0.225, tip[1] * 0.55 + chev[0][1] * 0.225 + chev[2][1] * 0.225] as Pt];
    const headPts = samplePath(polyPath(headCtrl), SPACING);
    const head: Stroke = {
      pts: headPts,
      size: size * (a.openHead ? 0.7 : 0.85),
      solid: !a.openHead,
      thinning: 0.62,
      pressure: headPts.map((_, j) => {
        const t = j / (headPts.length - 1);
        return 0.72 - 0.42 * t + 0.1 * Math.exp(-(((t - 0.5) / 0.1) ** 2));
      }),
    };
    const all = [...pts, ...headPts];
    const xs = all.map((p) => p[0]);
    const ys = all.map((p) => p[1]);
    const pad = size + 16;
    return {
      strokes: [shaft, head],
      streaks: [streaksFor(rng, size), []],
      bbox: {
        x: Math.min(...xs) - pad,
        y: Math.min(...ys) - pad,
        w: Math.max(...xs) - Math.min(...xs) + 2 * pad,
        h: Math.max(...ys) - Math.min(...ys) + 2 * pad,
      },
      size: Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)),
    };
  });

// ---------- Draw-on schedule ----------

export const DRAW_END = 120; // all arrows finished by 4s
export const PEN_LIFT = 3; // frames between shaft and head

export type Schedule = { start: number; dur: number; split: number }; // split: frames for the shaft

/** Seeded order, each arrow 12-21 frames (0.4-0.7s), started one after another. */
export const packSchedule = (arrows: PackArrow[]): Schedule[] => {
  const rng = mulberry32(0xa77a0);
  const order = arrows.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const durs = arrows.map(() => 12 + Math.floor(rng() * 10));
  const out: Schedule[] = new Array(arrows.length);
  const lastDur = durs[order[order.length - 1]];
  const step = (DRAW_END - lastDur) / (order.length - 1);
  order.forEach((idx, k) => {
    const a = arrows[idx];
    const shaftLen = a.strokes[0].pts.length;
    const headLen = a.strokes[1].pts.length;
    const drawFrames = durs[idx] - PEN_LIFT;
    const split = Math.max(6, Math.round((drawFrames * shaftLen) / (shaftLen + headLen * 1.6)));
    out[idx] = { start: Math.round(k * step), dur: durs[idx], split };
  });
  return out;
};
