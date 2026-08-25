import { random } from "remotion";
import {
  boardAt,
  boardFromScreen,
  CELL_H,
  CELL_W,
  COL,
  DIGITS_OFFSET,
  FALLOFF_LEFT,
  FALLOFF_RIGHT,
  FALLOFF_V,
  FOCUS_X,
  FOCUS_Y,
  LADDER_BOTTOM_SCREEN,
  LADDER_TOP_SCREEN,
  MAX_BLUR,
  N_CELLS,
  N_DIGITS,
  PRICE_B,
  PRICE_T,
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

// ── Chart furniture ────────────────────────────────────────────────────────

/** Board y of each horizontal rule. The price axis labels ride these too. */
export const GRID_Y: number[] = Array.from(
  { length: 9 },
  (_, i) => PRICE_T - 120 + ((PRICE_B + 320 - (PRICE_T - 120)) * i) / 8,
);

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
const [DBX, DBY] = boardFromScreen(
  LADDER_BOTTOM_SCREEN[0] + DIGITS_OFFSET,
  LADDER_BOTTOM_SCREEN[1],
);
const [DTX, DTY] = boardFromScreen(
  LADDER_TOP_SCREEN[0] + DIGITS_OFFSET,
  LADDER_TOP_SCREEN[1],
);

export const buildLadder = (): Cell[] => {
  const cells: Cell[] = [];
  for (let i = 0; i < N_CELLS; i++) {
    const t = i / (N_CELLS - 1);
    const roll = random(`cell-hue-${i}`);
    cells.push({
      x: LBX + (LTX - LBX) * t,
      y: LBY + (LTY - LBY) * t,
      w: CELL_W * (0.72 + random(`cell-w-${i}`) * 0.5),
      h: CELL_H,
      color: roll < 0.11 ? COL.green : roll < 0.2 ? COL.red : COL.cell,
      alpha: 0.72 + random(`cell-a-${i}`) * 0.28,
    });
  }
  return cells;
};

export type Digit = { x: number; y: number; text: string; size: number };

/**
 * The price column running alongside the cells. Blurred well past reading, but
 * number-shaped, which is what stops that half of the frame reading as
 * abstract blocks rather than as a terminal.
 */
export const buildDigits = (): Digit[] => {
  const out: Digit[] = [];
  for (let i = 0; i < N_DIGITS; i++) {
    const t = i / (N_DIGITS - 1);
    const v = 2986.8 - i * 0.4 + Math.round(random(`dig-j-${i}`) * 2 - 1) / 10;
    out.push({
      x: DBX + (DTX - DBX) * t,
      y: DBY + (DTY - DBY) * t,
      text: v.toFixed(1),
      size: 54,
    });
  }
  return out;
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
 * only to fill the defocused right edge with soft bokeh. All of it is placed
 * against screen fractions, because board coordinates stop being legible once
 * the board is tilted.
 */
export const buildBokeh = (): Blob[] => {
  const out: Blob[] = [];
  const push = (
    fx: number,
    fy: number,
    w: number,
    h: number,
    color: string,
    alpha: number,
    glowOnly = false,
  ) => {
    const [x, y] = boardAt(fx, fy);
    out.push({ x, y, w, h, color, alpha, glowOnly });
  };

  // The reference's top right corner is a whole defocused red panel — rows of
  // blocks, bright enough to be the second thing the eye finds after the
  // ladder. Scattered bokeh alone does not reproduce it.
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 2; c++) {
      push(
        0.82 + c * 0.11 + random(`rp-x-${r}-${c}`) * 0.035,
        0.2 + r * 0.13 + random(`rp-y-${r}-${c}`) * 0.04,
        230 + random(`rp-w-${r}-${c}`) * 150,
        100 + random(`rp-h-${r}-${c}`) * 50,
        COL.red,
        0.13 + random(`rp-a-${r}-${c}`) * 0.15,
      );
    }
  }

  // Scattered clusters at larger scale, out at the frame edge. Red up top,
  // warming to orange lower down, with green the exception.
  for (let c = 0; c < 8; c++) {
    const fx = 0.78 + random(`bkc-x-${c}`) * 0.26;
    const fy = -0.08 + random(`bkc-y-${c}`) * 1.2;
    const hue = random(`bkc-hue-${c}`);
    const color =
      fy < 0.42
        ? hue < 0.82
          ? COL.red
          : COL.green
        : hue < 0.42
          ? COL.red
          : hue < 0.78
            ? "#E8763C"
            : COL.green;
    const n = 3 + Math.floor(random(`bkc-n-${c}`) * 4);
    for (let i = 0; i < n; i++) {
      push(
        fx + (random(`bkb-x-${c}-${i}`) - 0.5) * 0.12,
        fy + (random(`bkb-y-${c}-${i}`) - 0.5) * 0.26,
        110 + random(`bkb-w-${c}-${i}`) * 240,
        60 + random(`bkb-h-${c}-${i}`) * 110,
        color,
        0.12 + random(`bkb-a-${c}-${i}`) * 0.24,
      );
    }
  }

  // The highlighted order-book rows: long soft bars behind everything.
  push(0.88, 0.42, 1400, 78, "#9FB4CC", 0.28);
  push(0.92, 0.66, 820, 56, "#5C7086", 0.12);

  // Ambient spill along the ladder. In the reference the bezel between the
  // cells and the number column is nowhere near black — it sits around a fifth
  // of full — and that lift comes from light scattering off the panel, not
  // from the cells themselves. Doing it with wider per-cell halos instead just
  // fuses the chain into one stripe.
  for (let i = 0; i < 20; i++) {
    const t = i / 19;
    // A narrow band along the chain rather than a broad wash: in the
    // reference the lift peaks just above frame centre and falls away hard at
    // both ends, and wide blobs bleed it across the whole right half.
    for (const [dx, dy, a, mid, sigma] of [
      [300, 110, 0.17, 0.6, 0.32],
      [820, 220, 0.13, 0.5, 0.26],
    ] as const) {
      const u = (t - mid) / sigma;
      const taper = 0.06 + 0.94 * Math.exp(-u * u);
      out.push({
        x: LBX + (LTX - LBX) * t + dx,
        y: LBY + (LTY - LBY) * t + dy,
        w: 600,
        h: 600,
        color: "#8FA6C2",
        alpha: a * taper,
        glowOnly: true,
      });
    }
  }

  // Another panel running off the left edge of frame, far outside the focal
  // band. Pure halo, so it sits behind the chart no matter the draw order.
  for (let i = 0; i < 7; i++) {
    const top = i < 5;
    push(
      -0.04 + random(`le-x-${i}`) * 0.12,
      top
        ? -0.1 + random(`le-y-${i}`) * 0.24
        : 0.86 + random(`le-y-${i}`) * 0.2,
      260 + random(`le-w-${i}`) * 340,
      150 + random(`le-h-${i}`) * 260,
      random(`le-hue-${i}`) < 0.72 ? COL.red : COL.green,
      0.07 + random(`le-a-${i}`) * 0.1,
      true,
    );
  }

  return out;
};

// ── Terminal chrome ────────────────────────────────────────────────────────

export type Readout = { x: number; y: number; text: string; size: number };

/**
 * The strip of tiny numbers along the top. Its board row runs off the top of
 * frame on the left and drops into view towards the middle, so it is mostly
 * cropped — exactly as in the reference.
 */
export const buildChrome = (): Readout[] => {
  const out: Readout[] = [];
  for (let i = 0; i < 9; i++) {
    const v = 2982 + Math.round(random(`chrome-v-${i}`) * 40 - 20) / 10;
    out.push({
      x: -200 + i * 400 + random(`chrome-x-${i}`) * 60,
      y: 210,
      text: v.toFixed(1),
      size: 40,
    });
  }
  return out;
};
