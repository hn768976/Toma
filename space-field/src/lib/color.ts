/**
 * Colour plumbing.
 *
 * Hex strings live only in `variants.ts`. Everything downstream works with
 * pre-parsed RGB triples and a cached table of `rgba()` strings: at 22000
 * particles a frame, building a colour string per particle per frame is a
 * measurable cost, so alpha is quantised into ALPHA_STEPS buckets and the
 * strings are built once.
 */

import { clamp } from "./math";

export type Rgb = readonly [number, number, number];

export const hexToRgb = (hex: string): Rgb => {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

export const rgba = (color: Rgb, alpha: number) =>
  `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;

export const ALPHA_STEPS = 96;

export type ColorTable = {
  readonly rgb: readonly Rgb[];
  /** colors[colorIndex][alphaBucket] -> "rgba(...)" */
  readonly strings: readonly (readonly string[])[];
};

export const buildColorTable = (hexes: readonly string[]): ColorTable => {
  const rgb = hexes.map(hexToRgb);
  const strings = rgb.map((color) => {
    const row: string[] = new Array(ALPHA_STEPS);
    for (let i = 0; i < ALPHA_STEPS; i++) {
      row[i] = rgba(color, i / (ALPHA_STEPS - 1));
    }
    return row;
  });
  return { rgb, strings };
};

export const alphaBucket = (alpha: number) =>
  clamp(Math.round(alpha * (ALPHA_STEPS - 1)), 0, ALPHA_STEPS - 1);
