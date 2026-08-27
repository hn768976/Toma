import type {MaskField} from './mask';
import {clamp, mix} from './space';

/**
 * The grid overlay is the technique the whole piece hangs on.
 *
 * Vertical lines are placed at even steps of a surface angle theta, not at even
 * steps of screen x. Mapping theta -> sin(theta) is exactly what happens when a
 * cylinder is projected flat, so the lines bunch up as they approach the
 * left/right silhouette boundary and spread out across the middle of the form.
 * That single non-linearity is what makes a flat mask read as a body with
 * volume. The bunching is computed per scanline against the run of silhouette
 * the pixel actually sits in, so each arm, each hand, each side of the head
 * gets its own wrap.
 *
 * Horizontal lines use one global mapping over the figure's bounding box, so
 * they stay continuous straight across the whole form; they are compressed
 * toward the top and bottom of the figure but only half as hard, which reads as
 * foreshortening rather than as a second competing wrap.
 */
export const GRID_NX = 16;
export const GRID_NY = 24;
const VERTICAL_WARP = 0.5;
/** Runs thinner than this (mask px) are left alone; snapping them is degenerate. */
const MIN_SPAN = 7;

const warpToBand = (t: number, n: number): number => {
  const theta = Math.asin(clamp(t * 2 - 1, -1, 1));
  const step = Math.PI / n;
  const snapped = clamp(Math.round(theta / step) * step, -Math.PI / 2, Math.PI / 2);
  return (Math.sin(snapped) + 1) / 2;
};

/** The k-th vertical grid line's normalised position within a run (k = 0..NX). */
export const verticalBand = (k: number, n: number): number =>
  (Math.sin(-Math.PI / 2 + (k * Math.PI) / n) + 1) / 2;

/** Global mapping used by the horizontal lines, in mask y. */
export const horizontalLevel = (
  m: number,
  n: number,
  y0: number,
  y1: number,
): number => {
  const linear = m / n;
  const warped = verticalBand(m, n);
  return y0 + mix(linear, warped, VERTICAL_WARP) * (y1 - y0);
};

const snapGlobalY = (my: number, y0: number, y1: number): number => {
  const t = clamp((my - y0) / Math.max(1, y1 - y0), 0, 1);
  const linear = Math.round(t * GRID_NY) / GRID_NY;
  const warped = warpToBand(t, GRID_NY);
  return y0 + mix(linear, warped, VERTICAL_WARP) * (y1 - y0);
};

/**
 * Pull a mask-space point toward the distorted grid. `ax`/`ay` are per-particle
 * snap strengths — varying them keeps some particles riding a single line
 * instead of every particle collapsing onto a lattice intersection.
 */
export const snapToGrid = (
  field: MaskField,
  mx: number,
  my: number,
  ax: number,
  ay: number,
): {x: number; y: number} => {
  const px = clamp(Math.round(mx), 0, field.w - 1);
  const py = clamp(Math.round(my), 0, field.h - 1);
  const i = py * field.w + px;
  if (!field.inside[i]) return {x: mx, y: my};

  let x = mx;
  const a = field.rowA[i];
  const b = field.rowB[i];
  if (b - a >= MIN_SPAN) {
    const u = (mx - a) / (b - a);
    x = mix(mx, a + warpToBand(u, GRID_NX) * (b - a), ax);
  }

  const y = mix(my, snapGlobalY(my, field.bbox.y0, field.bbox.y1), ay);
  return {x, y};
};

/** Flat [x0,y0,x1,y1, ...] segment lists, in mask coordinates. */
export type GridLines = {vertical: Float32Array; horizontal: Float32Array};

/** Best-overlap match between a run on one row and the runs on the next. */
const matchRun = (bounds: Int16Array, a: number, b: number): number => {
  let best = -1;
  let bestOverlap = 0;
  for (let j = 0; j < bounds.length; j += 2) {
    const overlap = Math.min(b, bounds[j + 1]) - Math.max(a, bounds[j]);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = j;
    }
  }
  return best;
};

export const buildGridLines = (field: MaskField): GridLines => {
  const vertical: number[] = [];
  const horizontal: number[] = [];
  const step = 2;

  // Vertical (wrapping) lines: walk row pairs, matching each run to the run it
  // continues into, and emit one short segment per grid band.
  for (let y = field.bbox.y0; y + step <= field.bbox.y1; y += step) {
    const top = field.runs[y];
    const bottom = field.runs[y + step];
    for (let j = 0; j < top.length; j += 2) {
      const a0 = top[j];
      const b0 = top[j + 1];
      if (b0 - a0 < MIN_SPAN) continue;
      const jb = matchRun(bottom, a0, b0);
      if (jb < 0) continue;
      const a1 = bottom[jb];
      const b1 = bottom[jb + 1];
      if (b1 - a1 < MIN_SPAN) continue;
      for (let k = 0; k <= GRID_NX; k++) {
        const t = verticalBand(k, GRID_NX);
        vertical.push(a0 + t * (b0 - a0), y, a1 + t * (b1 - a1), y + step);
      }
    }
  }

  // Horizontal (level) lines: one global y per band, walked across in x.
  for (let m = 0; m <= GRID_NY; m++) {
    const yf = horizontalLevel(m, GRID_NY, field.bbox.y0, field.bbox.y1);
    const y = clamp(Math.round(yf), 0, field.h - 1);
    const bounds = field.runs[y];
    for (let j = 0; j < bounds.length; j += 2) {
      const a = bounds[j];
      const b = bounds[j + 1];
      if (b - a < MIN_SPAN) continue;
      horizontal.push(a, yf, b, yf);
    }
  }

  return {
    vertical: Float32Array.from(vertical),
    horizontal: Float32Array.from(horizontal),
  };
};
