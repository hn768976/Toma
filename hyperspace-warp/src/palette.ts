import { clamp } from "./math";

export type Rgb = readonly [number, number, number];

export type Palette = {
  /** Blown-out hot core. */
  core: Rgb;
  /** Inner body of the streak. */
  inner: Rgb;
  /** Mid body — the palette's identity colour. */
  mid: Rgb;
  /** Outer tail, fading to transparent. */
  outer: Rgb;
};

const hex = (h: string): Rgb => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

export const PALETTES = {
  blue: {
    core: hex("#ffffff"),
    inner: hex("#d6f1ff"),
    mid: hex("#2ea8f0"),
    outer: hex("#1550a0"),
  },
  /**
   * The brief gives violet as three stops (core / body / tail). #b06cff is the
   * body, so it sits at the `mid` slot to match blue's structure, and `inner`
   * is a pale tint of it so the ramp keeps four stops.
   */
  violet: {
    core: hex("#ffffff"),
    inner: hex("#e0ccff"),
    mid: hex("#b06cff"),
    outer: hex("#4a1f9e"),
  },
} satisfies Record<string, Palette>;

export type PaletteName = keyof typeof PALETTES;

/**
 * Stop positions. The pale `inner` is deliberately squeezed into a narrow
 * band near the hot end: give it a third of the ramp and additive stacking
 * turns the whole field steel-grey instead of blue.
 */
const STOPS = [0, 0.18, 0.5, 1];

/**
 * Sample the four-stop ramp. x = 0 is the hot white core, x = 1 the deep
 * outer tail. Writes into `out` to keep the per-frame particle loop
 * allocation-free.
 */
export const sampleRamp = (p: Palette, x: number, out: [number, number, number]) => {
  const t = clamp(x);
  const list: Rgb[] = [p.core, p.inner, p.mid, p.outer];
  let i = 0;
  while (i < 2 && t > STOPS[i + 1]) i++;
  const a = list[i];
  const b = list[i + 1];
  const f = (t - STOPS[i]) / (STOPS[i + 1] - STOPS[i]);
  out[0] = a[0] + (b[0] - a[0]) * f;
  out[1] = a[1] + (b[1] - a[1]) * f;
  out[2] = a[2] + (b[2] - a[2]) * f;
  return out;
};
