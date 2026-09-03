/**
 * Low-resolution generation with browser upscaling.
 *
 * Broad, soft imagery — background mottling, tonal variation, fog — has no
 * business being computed at composition resolution. At 4K that is 8.3M
 * samples per frame for detail the eye cannot resolve anyway. Generate it into
 * a small backing store, stretch the canvas to full size with CSS, and blur
 * away the interpolation.
 *
 * This module supplies the value-noise generator and the styling that makes
 * the upscale read as intentional rather than as a low-res mistake.
 */

import React from "react";
import { clamp01, lerp, rand } from "../random";

export type Octave = { cols: number; rows: number; amp: number };

/** Sensible large-scale mottling: three octaves, halving in amplitude. */
export const MOTTLE_OCTAVES: Octave[] = [
  { cols: 6, rows: 4, amp: 1 },
  { cols: 13, rows: 8, amp: 0.5 },
  { cols: 27, rows: 17, amp: 0.25 },
];

/** Seeded lattice of corner values for one octave, `(cols+1) * (rows+1)` long. */
export const buildNoiseGrid = (seed: string, cols: number, rows: number) => {
  const grid: number[] = [];
  for (let y = 0; y <= rows; y++) {
    for (let x = 0; x <= cols; x++) {
      grid.push(rand(`${seed}:${x}:${y}`));
    }
  }
  return grid;
};

/** Bilinear value noise on a `cols x rows` lattice, sampled at (u, v) in [0, 1]. */
export const sampleNoise = (
  cols: number,
  rows: number,
  u: number,
  v: number,
  grid: number[],
) => {
  const fx = u * cols;
  const fy = v * rows;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  // Smoothstep the interpolant so lattice edges do not read as creases.
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const at = (x: number, y: number) =>
    grid[Math.min(rows, y) * (cols + 1) + Math.min(cols, x)];
  return lerp(
    lerp(at(x0, y0), at(x0 + 1, y0), sx),
    lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), sx),
    sy,
  );
};

/** Fills a small canvas with greyscale multi-octave value noise. */
export const paintNoiseField = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  octaves: readonly Octave[],
  grids: number[][],
) => {
  const image = ctx.createImageData(width, height);
  const data = image.data;
  let i = 0;
  for (let y = 0; y < height; y++) {
    const v = y / height;
    for (let x = 0; x < width; x++) {
      const u = x / width;
      let sum = 0;
      let norm = 0;
      for (let o = 0; o < octaves.length; o++) {
        sum += sampleNoise(octaves[o].cols, octaves[o].rows, u, v, grids[o]) * octaves[o].amp;
        norm += octaves[o].amp;
      }
      const level = Math.round(clamp01(sum / norm) * 255);
      data[i++] = level;
      data[i++] = level;
      data[i++] = level;
      data[i++] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
};

/**
 * Style for the upscaled canvas. The blur is what turns a stretched low-res
 * field into broad tonal variation; `soft-light` keeps it a modulation of the
 * layer beneath rather than a grey haze over it.
 */
export const lowResLayerStyle = (opts: {
  blur: number;
  opacity: number;
  blendMode?: React.CSSProperties["mixBlendMode"];
}): React.CSSProperties => ({
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  display: "block",
  filter: `blur(${opts.blur}px)`,
  mixBlendMode: opts.blendMode ?? "soft-light",
  opacity: opts.opacity,
});
