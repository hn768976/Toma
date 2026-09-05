// Canvas painting for the halftone sheet.
//
// Compositing is additive on pure black, which has a useful consequence:
// alpha-blending a colour C at opacity a onto black is identical to adding
// C * a. So every dot can be drawn fully opaque with its colour premultiplied
// by its intensity, which means dots that share a (colour bucket, intensity
// level) pair share a fillStyle and can be filled as one batched path
// instead of one fill() per dot.

import {
  COLOR_BUCKETS,
  CREST_GAIN,
  DOT_MAX,
  DOT_MIN,
  FACING_ALPHA,
  GLOW_ALPHA,
  GLOW_RADIUS,
  GLOW_X,
  GLOW_Y,
  HEIGHT_GAIN,
  LEVEL_BUCKETS,
  ROW_STEP,
} from "./constants";
import { Palette, Rgb, buildColorRamp } from "./color";
import {
  Sheet,
  createSheet,
  facingAt,
  heightAt,
  toScreenX,
  toScreenY,
} from "./sheet";

const TAU = Math.PI * 2;

export type RenderState = {
  sheet: Sheet;
  ramp: Rgb[];
  /** Premultiplied fill colour for every (colour bucket, level) pair. */
  fills: string[];
  /** Reused per-bucket scratch lists of x, y, r triples. */
  buckets: number[][];
  glowRgb: Rgb;
};

export const createRenderState = (palette: Palette): RenderState => {
  const ramp = buildColorRamp(palette, COLOR_BUCKETS);
  const fills: string[] = new Array(COLOR_BUCKETS * LEVEL_BUCKETS);
  for (let c = 0; c < COLOR_BUCKETS; c++) {
    for (let l = 0; l < LEVEL_BUCKETS; l++) {
      const k = l / (LEVEL_BUCKETS - 1);
      const { r, g, b } = ramp[c];
      fills[c * LEVEL_BUCKETS + l] =
        `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`;
    }
  }
  const buckets: number[][] = new Array(COLOR_BUCKETS * LEVEL_BUCKETS);
  for (let i = 0; i < buckets.length; i++) buckets[i] = [];

  return { sheet: createSheet(), ramp, fills, buckets, glowRgb: palette.glow };
};

/** The wide, faint glow that sits under the densest part of the sheet. */
const drawGlow = (
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  k: number,
  tN: number,
) => {
  const { sheet, glowRgb } = state;
  // Breathes once per loop, in step with the sheet itself.
  const pulse = 1 + 0.18 * Math.sin(TAU * tN);
  const cx = toScreenX(sheet, GLOW_X, GLOW_Y) * k;
  const cy = toScreenY(sheet, GLOW_X, GLOW_Y) * k;
  const r = GLOW_RADIUS * k * pulse;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  const { r: gr, g: gg, b: gb } = glowRgb;
  g.addColorStop(0, `rgba(${gr},${gg},${gb},${GLOW_ALPHA})`);
  g.addColorStop(0.45, `rgba(${gr},${gg},${gb},${GLOW_ALPHA * 0.4})`);
  g.addColorStop(1, `rgba(${gr},${gg},${gb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
};

/**
 * Paints one frame of the sheet. `tN` is the loop position in 0..1 and `k`
 * scales master (3840x2160) geometry to the canvas actually being drawn.
 */
export const drawFrame = (
  ctx: CanvasRenderingContext2D,
  state: RenderState,
  width: number,
  height: number,
  tN: number,
  k: number,
) => {
  const { sheet, buckets, fills } = state;
  const { cols, rows, rowScale, rowY, rowSpacing, rowBucket, rowAlpha } = sheet;

  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);

  ctx.globalCompositeOperation = "lighter";
  drawGlow(ctx, state, k, tN);

  for (let i = 0; i < buckets.length; i++) buckets[i].length = 0;

  const halfCols = (cols - 1) / 2;
  const dj = 1 / (rows - 1);
  const invHeightMax = 1 / sheet.heightMax;

  for (let j = 0; j < rows; j++) {
    const alphaRow = rowAlpha[j];
    if (alphaRow <= 0.002) continue;
    const jN = j * dj;
    const scale = rowScale[j];
    const spacing = rowSpacing[j];
    const stepY = ROW_STEP * scale;
    const bucketBase = rowBucket[j] * LEVEL_BUCKETS;
    // Generous cull margin: a dot near the frame edge still contributes.
    const margin = spacing * 2 * k;

    for (let i = 0; i < cols; i++) {
      const iN = i / (cols - 1);
      const h = heightAt(iN, jN, tN);
      const facing = facingAt(iN, jN, tN, dj);

      const idx = j * cols + i;
      const xs = spacing * (i - halfCols) + sheet.jitterX[idx] * spacing;
      const ys = rowY[j] - HEIGHT_GAIN * scale * h + sheet.jitterY[idx] * stepY;

      const x = toScreenX(sheet, xs, ys) * k;
      if (x < -margin || x > width + margin) continue;
      const y = toScreenY(sheet, xs, ys) * k;
      if (y < -margin || y > height + margin) continue;

      // Halftone: dot diameter is a fraction of the local spacing, set by
      // how squarely the folded surface faces the viewer.
      const r = 0.5 * spacing * k * (DOT_MIN + (DOT_MAX - DOT_MIN) * facing);
      if (r < 0.2) continue;

      const crest = 1 + CREST_GAIN * Math.max(0, h * invHeightMax);
      const intensity =
        alphaRow * (1 - FACING_ALPHA + FACING_ALPHA * facing) * crest;
      const level = Math.round(
        Math.min(1, intensity) * (LEVEL_BUCKETS - 1),
      );
      if (level <= 0) continue;

      const bucket = buckets[bucketBase + level];
      bucket.push(x, y, r);
    }
  }

  for (let b = 0; b < buckets.length; b++) {
    const list = buckets[b];
    if (list.length === 0) continue;
    ctx.fillStyle = fills[b];
    ctx.beginPath();
    for (let n = 0; n < list.length; n += 3) {
      const x = list[n];
      const y = list[n + 1];
      const r = list[n + 2];
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, TAU);
    }
    ctx.fill();
  }

  ctx.globalCompositeOperation = "source-over";
};
