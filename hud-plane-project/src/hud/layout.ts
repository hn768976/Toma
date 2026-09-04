// Module-level layout generation. The PRNG is seeded once and consumed in a
// fixed order, so the layout is identical in the studio, in a 1080p preview and
// in a 4K render. Nothing in here depends on the frame.

import { VB_H, VB_W } from "./constants";
import { mulberry32, seededPhase } from "./random";

const rnd = mulberry32(0x48554431); // "HUD1"
const rr = (a: number, b: number) => a + rnd() * (b - a);
const ri = (a: number, b: number) => Math.floor(a + rnd() * (b - a + 1));

// The frame's footprint inside the plane, before the rake. Useful for placing
// things that should land on screen rather than in the cropped overfill.
export const FRAME_X0 = 444;
export const FRAME_X1 = 1556;
export const FRAME_Y0 = 387;
export const FRAME_Y1 = 1013;

// ---------------------------------------------------------------------------
// Radar assembly — the anchor, left of centre.
// ---------------------------------------------------------------------------

export type Arc = { a0: number; a1: number };

export type Ring = {
  id: string;
  r: number;
  opacity: number;
  /** null = closed circle; otherwise a set of arc segments. */
  segments: Arc[] | null;
  dash?: string;
  /** Radial tick marks around the circumference. */
  ticks?: { count: number; len: number };
  /** Draw in the accent colour rather than the base line colour. */
  accent?: boolean;
  /** Integer fade cycles per loop. */
  cycles: number;
  phase: number;
};

const R = 0.78; // radar scale — outer ring lands at ~44% of the frame width

export const RADAR = {
  cx: 904,
  cy: 692,
  coreR: 3.2,
  crosshair: 22,
  sweepR: 312 * R,
  sweepWedge: 46, // degrees of trailing wedge
};

export const RADAR_RINGS: Ring[] = [
  {
    id: "ring-0",
    r: 54 * R,
    opacity: 0.42,
    segments: null,
    cycles: 2,
    phase: seededPhase("ring-0"),
  },
  {
    id: "ring-1",
    r: 100 * R,
    opacity: 0.34,
    segments: [
      { a0: -162, a1: -18 },
      { a0: 12, a1: 122 },
    ],
    accent: true,
    cycles: 3,
    phase: seededPhase("ring-1"),
  },
  {
    id: "ring-2",
    r: 152 * R,
    opacity: 0.22,
    segments: null,
    ticks: { count: 72, len: 9 * R },
    cycles: 1,
    phase: seededPhase("ring-2"),
  },
  {
    id: "ring-3",
    r: 208 * R,
    opacity: 0.3,
    segments: [
      { a0: -118, a1: 42 },
      { a0: 72, a1: 148 },
      { a0: 172, a1: 206 },
    ],
    accent: true,
    cycles: 2,
    phase: seededPhase("ring-3"),
  },
  {
    id: "ring-4",
    r: 258 * R,
    opacity: 0.14,
    segments: null,
    dash: "3 11",
    cycles: 1,
    phase: seededPhase("ring-4"),
  },
  {
    id: "ring-5",
    r: 312 * R,
    opacity: 0.24,
    segments: [{ a0: -58, a1: 96 }],
    cycles: 3,
    phase: seededPhase("ring-5"),
  },
];

/** Short arc of dots riding ring-3, like an indicator scale. */
export const RADAR_SCALE = {
  r: 208 * R,
  a0: -36,
  a1: 34,
  count: 15,
  dotR: 1.9,
};

/** Secondary ring fragments elsewhere on the plane — smaller, dimmer echoes. */
export type MiniRings = {
  id: string;
  cx: number;
  cy: number;
  radii: number[];
  arc: Arc | null;
  opacity: number;
  cycles: number;
  phase: number;
};

export const MINI_RINGS: MiniRings[] = [
  {
    id: "mini-0",
    cx: 348,
    cy: 452,
    radii: [46, 78],
    arc: null,
    opacity: 0.16,
    cycles: 1,
    phase: seededPhase("mini-0"),
  },
  {
    id: "mini-1",
    cx: 1498,
    cy: 1118,
    radii: [30, 52, 76],
    arc: { a0: -140, a1: 60 },
    opacity: 0.14,
    cycles: 2,
    phase: seededPhase("mini-1"),
  },
];

// ---------------------------------------------------------------------------
// Data blocks — the only bright elements. Clustered, never spread evenly.
// ---------------------------------------------------------------------------

export type Block = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  base: number;
  bright: boolean;
  accent: boolean;
  cycles: number;
  phase: number;
};

export type BlockCluster = { id: string; blocks: Block[] };

const makeCluster = (
  id: string,
  ox: number,
  oy: number,
  rowSpec: number[],
): BlockCluster => {
  const blocks: Block[] = [];
  const h = 8.5;
  const rowGap = 15;
  rowSpec.forEach((n, r) => {
    let x = rr(0, 14);
    for (let i = 0; i < n; i++) {
      const w = rr(8, 24);
      const bid = `${id}-${r}-${i}`;
      blocks.push({
        id: bid,
        x: ox + x,
        y: oy + r * rowGap,
        w,
        h,
        base: rr(0.42, 0.95),
        bright: rnd() < 0.24,
        accent: rnd() < 0.09,
        cycles: ri(1, 5),
        phase: seededPhase(bid),
      });
      x += w + rr(5, 12);
    }
  });
  return { id, blocks };
};

export const BLOCK_CLUSTERS: BlockCluster[] = [
  makeCluster("cluster-a", 1216, 512, [5, 7, 4]),
  makeCluster("cluster-b", 1268, 902, [6, 4, 5]),
  makeCluster("cluster-c", 508, 986, [4, 3]),
  makeCluster("cluster-d", 386, 646, [3, 5]),
];

// ---------------------------------------------------------------------------
// Rules — long thin straight lines crossing the plane. The structural skeleton
// the rest of the fragments hang off.
// ---------------------------------------------------------------------------

export type Rule = {
  id: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  opacity: number;
  dash?: string;
  cycles: number;
  phase: number;
};

export const RULES: Rule[] = [];
for (let i = 0; i < 15; i++) {
  const id = `rule-${i}`;
  const vertical = i >= 11;
  if (vertical) {
    const x = rr(120, VB_W - 120);
    RULES.push({
      id,
      x0: x,
      y0: rr(-160, 200),
      x1: x + rr(-30, 30),
      y1: rr(VB_H - 200, VB_H + 160),
      opacity: rr(0.07, 0.18),
      dash: rnd() < 0.3 ? "22 16" : undefined,
      cycles: ri(1, 3),
      phase: seededPhase(id),
    });
  } else {
    const y = rr(-40, VB_H + 40);
    RULES.push({
      id,
      x0: rr(-260, 260),
      y0: y,
      x1: rr(VB_W - 260, VB_W + 260),
      y1: y + rr(-24, 24),
      opacity: rr(0.07, 0.22),
      dash: rnd() < 0.25 ? "34 20" : undefined,
      cycles: ri(1, 3),
      phase: seededPhase(id),
    });
  }
}

// ---------------------------------------------------------------------------
// Dotted lines — long runs of small dots with points marching along them.
// ---------------------------------------------------------------------------

export type DotLine = {
  id: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  count: number;
  dotR: number;
  opacity: number;
  /** Integer marches per loop; sign sets direction. */
  cycles: number;
  /** Fraction of the run where the dots start fading out; 1 = no fade. */
  fadeFrom: number;
};

export const DOT_LINES: DotLine[] = [];
for (let i = 0; i < 18; i++) {
  const id = `dotline-${i}`;
  const y = rr(60, VB_H - 60);
  const x0 = rr(-200, 700);
  const len = rr(360, 1900);
  const slope = rnd() < 0.72 ? 0 : rr(-0.1, 0.1);
  DOT_LINES.push({
    id,
    x0,
    y0: y,
    x1: x0 + len,
    y1: y + len * slope,
    count: Math.round(len / rr(14, 30)),
    dotR: rr(1.2, 2.1),
    opacity: rr(0.16, 0.4),
    cycles: (rnd() < 0.35 ? -1 : 1) * ri(1, 2),
    fadeFrom: rnd() < 0.55 ? rr(0.4, 0.8) : 1,
  });
}
for (let i = 0; i < 5; i++) {
  const id = `dotline-v-${i}`;
  const x = rr(160, VB_W - 160);
  const y0 = rr(-160, 260);
  const len = rr(460, 1300);
  DOT_LINES.push({
    id,
    x0: x,
    y0,
    x1: x + len * rr(-0.06, 0.06),
    y1: y0 + len,
    count: Math.round(len / rr(18, 32)),
    dotR: rr(1.2, 2.0),
    opacity: rr(0.14, 0.32),
    cycles: (rnd() < 0.5 ? -1 : 1) * ri(1, 2),
    fadeFrom: rnd() < 0.5 ? rr(0.45, 0.85) : 1,
  });
}

// ---------------------------------------------------------------------------
// Bracket frames — corner brackets and open rectangles, all empty.
// ---------------------------------------------------------------------------

export type Bracket = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  arm: number;
  /** "corners" = four L-shapes; "open" = a dashed rectangle. */
  kind: "corners" | "open";
  opacity: number;
  cycles: number;
  phase: number;
};

export const BRACKETS: Bracket[] = [];
{
  const spots: [number, number, number, number][] = [
    [1152, 432, 320, 200],
    [1214, 846, 290, 176],
    [430, 926, 250, 150],
    [252, 250, 292, 186],
    [1548, 622, 340, 214],
    [636, 1176, 400, 146],
    [318, 604, 210, 130],
    [812, 244, 268, 152],
    [1004, 1088, 236, 140],
    [1662, 300, 300, 180],
  ];
  spots.forEach(([x, y, w, h], i) => {
    const id = `bracket-${i}`;
    BRACKETS.push({
      id,
      x,
      y,
      w,
      h,
      arm: rr(24, 50),
      kind: rnd() < 0.6 ? "corners" : "open",
      opacity: rr(0.12, 0.3),
      cycles: ri(1, 3),
      phase: seededPhase(id),
    });
  });
}

// ---------------------------------------------------------------------------
// Tick rows — short vertical strokes in evenly spaced rows, like scales.
// ---------------------------------------------------------------------------

export type TickRow = {
  id: string;
  x: number;
  y: number;
  count: number;
  gap: number;
  len: number;
  /** Every nth tick is drawn longer. */
  majorEvery: number;
  opacity: number;
  cycles: number;
  phase: number;
};

export const TICK_ROWS: TickRow[] = [];
for (let i = 0; i < 12; i++) {
  const id = `tickrow-${i}`;
  TICK_ROWS.push({
    id,
    x: rr(-60, 1500),
    y: rr(80, VB_H - 100),
    count: ri(10, 42),
    gap: rr(8, 16),
    len: rr(6, 14),
    majorEvery: ri(4, 6),
    opacity: rr(0.13, 0.3),
    cycles: ri(1, 3),
    phase: seededPhase(id),
  });
}

// ---------------------------------------------------------------------------
// Dot matrices — tiny grids of dots, the "readout" texture that fills the
// field between the larger fragments.
// ---------------------------------------------------------------------------

export type DotMatrix = {
  id: string;
  x: number;
  y: number;
  cols: number;
  rows: number;
  gap: number;
  dotR: number;
  opacity: number;
  cycles: number;
  phase: number;
};

export const DOT_MATRICES: DotMatrix[] = [];
for (let i = 0; i < 11; i++) {
  const id = `matrix-${i}`;
  DOT_MATRICES.push({
    id,
    x: rr(40, VB_W - 240),
    y: rr(80, VB_H - 120),
    cols: ri(5, 16),
    rows: ri(2, 5),
    gap: rr(6.5, 11),
    dotR: rr(0.9, 1.5),
    opacity: rr(0.12, 0.34),
    cycles: ri(1, 4),
    phase: seededPhase(id),
  });
}

// ---------------------------------------------------------------------------
// Scattered points — single dots at varied brightness across the field.
// ---------------------------------------------------------------------------

export type Point = {
  id: string;
  x: number;
  y: number;
  r: number;
  opacity: number;
  cycles: number;
  phase: number;
  /** "line" = dim structural dot, "block" = saturated, "accent" = teal/red. */
  tone: "line" | "block" | "accent";
};

export const POINTS: Point[] = [];
for (let i = 0; i < 220; i++) {
  const id = `point-${i}`;
  const roll = rnd();
  POINTS.push({
    id,
    x: rr(-80, VB_W + 80),
    y: rr(-80, VB_H + 80),
    r: rr(1, 2.6),
    opacity: rr(0.1, 0.6),
    cycles: ri(1, 4),
    phase: seededPhase(id),
    tone: roll < 0.06 ? "accent" : roll < 0.24 ? "block" : "line",
  });
}

// ---------------------------------------------------------------------------
// Faint grid — a very low-contrast rule structure under everything.
// ---------------------------------------------------------------------------

export const GRID = {
  stepX: 100,
  stepY: 100,
  opacity: 0.05,
  /** Every nth rule is slightly stronger. */
  majorEvery: 5,
};
