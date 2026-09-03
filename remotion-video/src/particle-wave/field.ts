import {
  AMPLITUDE_FRACTION,
  AMP_DEPTH_FLOOR,
  BASE_WIDTH,
  DEPTH_ALPHA_EXP,
  DEPTH_ALPHA_MIN,
  DEPTH_RATIO,
  DEPTH_SPAN,
  DOT_MAX_PX,
  DOT_MIN_PX,
  DOT_SIZE_EXP,
  HORIZON_Y_FRACTION,
  HUE_STEPS,
  H_CONVERGENCE,
  JITTER_X,
  JITTER_Y,
  NEAR_FADE_AMOUNT,
  NEAR_FADE_START,
  NEAR_ROW_Y_FRACTION,
  OVERSCAN_X,
} from "./constants";
import { mulberry32 } from "./random";

export type WaveLayout = {
  cols: number;
  rows: number;
  count: number;
  // Per dot. x, y0 and hue never change from frame to frame — the wave
  // only moves dots vertically and the hue ramp is pinned to the frame —
  // so they are built once and reused for all 600 frames.
  x: Float32Array;
  y0: Float32Array;
  size: Float32Array;
  hue: Uint8Array;
  // Per row.
  amp: Float32Array;
  depthEnergy: Float32Array;
  depthZ: Float32Array;
  // Per column: the column's position across the field, 0..1. The wave
  // is a property of the surface, so it is sampled in field space, not
  // screen space — which also means the expensive part of the noise
  // coordinate can be computed once per column instead of once per dot.
  colFieldX: Float32Array;
  // Vertical extent of the dot band, used to place the background glow.
  horizonY: number;
  nearY: number;
};

// Builds the grid and bakes the projection into it: row index maps to
// depth, and depth sets vertical position, spacing, dot size, brightness
// and how far the row is allowed to move.
export const buildLayout = (
  width: number,
  height: number,
  cols: number,
  rows: number,
  seed: number,
): WaveLayout => {
  const count = cols * rows;
  const x = new Float32Array(count);
  const y0 = new Float32Array(count);
  const size = new Float32Array(count);
  const hue = new Uint8Array(count);
  const amp = new Float32Array(rows);
  const depthEnergy = new Float32Array(rows);
  const depthZ = new Float32Array(rows);
  const colFieldX = new Float32Array(cols);

  const pxScale = width / BASE_WIDTH;
  const horizonY = height * HORIZON_Y_FRACTION;
  const nearY = height * NEAR_ROW_Y_FRACTION;
  const bandHeight = nearY - horizonY;
  const fieldWidth = width * OVERSCAN_X;
  const ampBase = height * AMPLITUDE_FRACTION;

  // 1/Z at the far edge, with Z(near) normalised to 1.
  const farScale = 1 / DEPTH_RATIO;

  const rand = mulberry32(seed);

  for (let c = 0; c < cols; c++) {
    colFieldX[c] = cols === 1 ? 0.5 : c / (cols - 1);
  }

  for (let r = 0; r < rows; r++) {
    // 0 at the far edge, 1 at the near edge.
    const d = rows === 1 ? 1 : r / (rows - 1);
    const z = DEPTH_RATIO + (1 - DEPTH_RATIO) * d;
    const scale = 1 / z; // farScale..1
    const scaleNorm = (scale - farScale) / (1 - farScale); // 0..1

    const rowY = horizonY + bandHeight * scaleNorm;
    const rowSize =
      pxScale *
      (DOT_MIN_PX + (DOT_MAX_PX - DOT_MIN_PX) * Math.pow(d, DOT_SIZE_EXP));
    const hScale = 1 + H_CONVERGENCE * (scale - 1);
    const rowSpan = fieldWidth * hScale;
    const colSpacing = cols === 1 ? rowSpan : rowSpan / (cols - 1);
    // Row spacing at this depth, used to size the vertical jitter.
    const rowSpacing =
      (bandHeight * (scale * scale) * (DEPTH_RATIO - 1)) /
      (1 - farScale) /
      Math.max(1, rows - 1);

    amp[r] = ampBase * (AMP_DEPTH_FLOOR + (1 - AMP_DEPTH_FLOOR) * d);
    const nearFade =
      d > NEAR_FADE_START
        ? 1 -
          NEAR_FADE_AMOUNT *
            Math.pow((d - NEAR_FADE_START) / (1 - NEAR_FADE_START), 1.5)
        : 1;
    depthEnergy[r] =
      (DEPTH_ALPHA_MIN + (1 - DEPTH_ALPHA_MIN) * Math.pow(d, DEPTH_ALPHA_EXP)) *
      nearFade;
    depthZ[r] = d * DEPTH_SPAN;

    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const jx = (rand() - 0.5) * 2 * JITTER_X * colSpacing;
      const jy = (rand() - 0.5) * 2 * JITTER_Y * rowSpacing;
      const px = width / 2 + (colFieldX[c] - 0.5) * rowSpan + jx;
      x[i] = px;
      y0[i] = rowY + jy;
      size[i] = rowSize;
      const t = px / width;
      const bucket = Math.floor(
        (t < 0 ? 0 : t > 0.999999 ? 0.999999 : t) * HUE_STEPS,
      );
      hue[i] = bucket;
    }
  }

  return {
    cols,
    rows,
    count,
    x,
    y0,
    size,
    hue,
    amp,
    depthEnergy,
    depthZ,
    colFieldX,
    horizonY,
    nearY,
  };
};
