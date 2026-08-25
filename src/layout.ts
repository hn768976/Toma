import { random } from "remotion";
import {
  boardFromScreen,
  CELL_H,
  CELL_W,
  COL,
  FALLOFF_LEFT,
  FALLOFF_RIGHT,
  FALLOFF_V,
  FOCUS_X,
  FOCUS_Y,
  LADDER_BOTTOM_SCREEN,
  LADDER_TOP_SCREEN,
  MAX_BLUR,
  N_CELLS,
} from "./config";
import { smoothstep } from "./motion";

// ── Depth of field ─────────────────────────────────────────────────────────

/** Blur radius in board px for a point on the board. */
export const blurAt = (x: number, y: number) => {
  const dx = x - FOCUS_X;
  const hx = dx > 0 ? dx / FALLOFF_RIGHT : -dx / FALLOFF_LEFT;
  const hy = Math.abs(y - FOCUS_Y) / FALLOFF_V;
  return MAX_BLUR * smoothstep(0.14, 1, hx + hy);
};

/**
 * Split a blur radius across the three depth buffers. The bands overlap so an
 * element straddling a boundary is drawn into both with complementary alpha —
 * without that cross-fade the bucket edges read as visible seams.
 */
export const depthWeights = (blur: number): [number, number, number] => {
  const far = smoothstep(8, 17, blur);
  const mid = (1 - far) * smoothstep(1, 6.5, blur);
  return [1 - far - mid, mid, far];
};

// ── Order-book ladder ──────────────────────────────────────────────────────

export type Cell = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  /** Base opacity before any flash. */
  alpha: number;
};

const [LBX, LBY] = boardFromScreen(...LADDER_BOTTOM_SCREEN);
const [LTX, LTY] = boardFromScreen(...LADDER_TOP_SCREEN);

export const buildLadder = (): Cell[] => {
  const cells: Cell[] = [];
  for (let i = 0; i < N_CELLS; i++) {
    const t = i / (N_CELLS - 1);
    const x = LBX + (LTX - LBX) * t;
    const y = LBY + (LTY - LBY) * t;
    const roll = random(`cell-hue-${i}`);
    const color = roll < 0.11 ? COL.green : roll < 0.2 ? COL.red : COL.cell;
    const w = CELL_W * (0.72 + random(`cell-w-${i}`) * 0.5);
    cells.push({
      x,
      y,
      w,
      h: CELL_H,
      color,
      alpha: 0.5 + random(`cell-a-${i}`) * 0.5,
    });
  }
  return cells;
};

// ── Out-of-focus dressing on the right ─────────────────────────────────────

export type Blob = {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  alpha: number;
  /** Additive halo only, no solid body — for shapes that never resolve. */
  glowOnly?: boolean;
};

/**
 * Loose clusters of colour past the ladder. These never resolve — they exist
 * only to fill the defocused right edge with soft bokeh.
 */
export const buildBokeh = (): Blob[] => {
  const out: Blob[] = [];

  // A second, larger ladder running parallel to the first, further back.
  for (let i = 0; i < 22; i++) {
    const t = i / 21;
    const x = LBX + (LTX - LBX) * t + 660;
    const y = LBY + (LTY - LBY) * t + 40;
    const roll = random(`bk2-hue-${i}`);
    out.push({
      x,
      y,
      w: 230 * (0.65 + random(`bk2-w-${i}`) * 0.8),
      h: 78,
      color: roll < 0.16 ? COL.green : roll < 0.32 ? COL.red : COL.cell,
      alpha: 0.18 + random(`bk2-a-${i}`) * 0.26,
    });
  }

  // Scattered clusters at larger scale, out at the frame edge.
  for (let c = 0; c < 8; c++) {
    const cxp = 3450 + random(`bkc-x-${c}`) * 1050;
    const cyp = -250 + random(`bkc-y-${c}`) * 2900;
    const hue = random(`bkc-hue-${c}`);
    const color = hue < 0.46 ? COL.red : hue < 0.72 ? "#E8763C" : COL.green;
    const n = 3 + Math.floor(random(`bkc-n-${c}`) * 4);
    for (let i = 0; i < n; i++) {
      out.push({
        x: cxp + (random(`bkb-x-${c}-${i}`) - 0.5) * 480,
        y: cyp + (random(`bkb-y-${c}-${i}`) - 0.5) * 600,
        w: 110 + random(`bkb-w-${c}-${i}`) * 240,
        h: 60 + random(`bkb-h-${c}-${i}`) * 110,
        color,
        alpha: 0.12 + random(`bkb-a-${c}-${i}`) * 0.26,
      });
    }
  }

  // The highlighted order-book row: a long soft bar behind everything.
  out.push({ x: 3260, y: 958, w: 1150, h: 70, color: "#8FA4BC", alpha: 0.16 });
  out.push({ x: 3560, y: 1660, w: 820, h: 56, color: "#5C7086", alpha: 0.12 });

  // Another panel running off the left edge of frame, far outside the focal
  // band. Pure halo, so it sits behind the chart no matter the draw order.
  for (let i = 0; i < 7; i++) {
    const top = i < 5;
    out.push({
      x: -230 + random(`le-x-${i}`) * 460,
      y: top
        ? -380 + random(`le-y-${i}`) * 620
        : 1980 + random(`le-y-${i}`) * 520,
      w: 260 + random(`le-w-${i}`) * 340,
      h: 150 + random(`le-h-${i}`) * 260,
      color: random(`le-hue-${i}`) < 0.72 ? COL.red : COL.green,
      alpha: 0.07 + random(`le-a-${i}`) * 0.1,
      glowOnly: true,
    });
  }

  return out;
};

// ── Terminal chrome ────────────────────────────────────────────────────────

export type Readout = { x: number; y: number; text: string; size: number };

/**
 * The strip of tiny numbers along the very top. It sits mostly above the
 * frame and always lands in the far buffer, so it only ever suggests text.
 */
export const buildChrome = (): Readout[] => {
  const out: Readout[] = [];
  const base = 2982;
  for (let i = 0; i < 9; i++) {
    const v = base + Math.round(random(`chrome-v-${i}`) * 40 - 20) / 10;
    out.push({
      x: 150 + i * 430 + random(`chrome-x-${i}`) * 60,
      y: -46,
      text: v.toFixed(1),
      size: 34,
    });
  }
  return out;
};
