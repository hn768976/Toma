// Shared geometry, timing and palette for the "growth timeline" motion
// graphics. Everything is authored against a 1920x1080 design canvas; the
// `resolutionScale` prop on the composition scales the whole scene up, so
// the 4K composition is a true vector upscale of the same layout rather
// than a separate set of numbers to keep in sync.

export const FPS = 30;

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

/** Chevron-trail version. 400 frames = 13.33s. */
export const V1_DURATION_IN_FRAMES = 400;
/** Dual bar-chart version. 420 frames = 14s. */
export const V2_DURATION_IN_FRAMES = 420;

/** First year on the timeline. Quarter index 0 is Q1 of this year. */
export const START_YEAR = 2025;

export const QUARTER_LABELS = ["Q1", "Q2", "Q3", "Q4"] as const;

/** Deep navy the whole frame sits on. */
export const BACKGROUND_COLOR = "#050d22";

/** The glowing axis / grid cyan. */
export const CYAN = "#3fd2ff";
export const CYAN_BRIGHT = "#9ff0ff";

/**
 * The chevron trail does not colour per-arrow: the whole trail shifts hue
 * over the length of the shot, cyan -> white -> magenta. Stops are
 * (progress 0..1, colour).
 */
export const TRAIL_RAMP: readonly [number, string][] = [
  [0.0, "#2fd8ff"],
  [0.13, "#8fe9ff"],
  [0.27, "#eef8ff"],
  [0.42, "#ffc4ee"],
  [0.6, "#ff95e2"],
  [1.0, "#ff7cdc"],
];

/**
 * Year labels behind the playhead "ignite" from cool white into a heat
 * ramp, green -> amber -> orange -> red, the further into the future the
 * timeline gets. Indexed by year offset from START_YEAR.
 */
export const HEAT_RAMP: readonly [number, string][] = [
  [0, "#6cf08a"],
  [2, "#c8f06c"],
  [3, "#ffd24a"],
  [5, "#ff9a34"],
  [7, "#ff5c2e"],
  [9, "#ff3b2e"],
];

/** Bars above the axis: fresh green with a yellow cap. */
export const BAR_UP_TOP = "#e8f57a";
export const BAR_UP_BOTTOM = "#4ad98a";
/** Bars below the axis: amber, mirrored. */
export const BAR_DOWN_TOP = "#ff9b3d";
export const BAR_DOWN_BOTTOM = "#ffd97a";

/** Interpolate a colour ramp in sRGB. Stops must be sorted ascending. */
export const sampleRamp = (
  ramp: readonly [number, string][],
  at: number,
): string => {
  if (at <= ramp[0][0]) return ramp[0][1];
  const last = ramp[ramp.length - 1];
  if (at >= last[0]) return last[1];
  let i = 0;
  while (i < ramp.length - 1 && ramp[i + 1][0] < at) i++;
  const [a, ca] = ramp[i];
  const [b, cb] = ramp[i + 1];
  const t = (at - a) / (b - a);
  const pa = hexToRgb(ca);
  const pb = hexToRgb(cb);
  return `rgb(${Math.round(pa[0] + (pb[0] - pa[0]) * t)}, ${Math.round(
    pa[1] + (pb[1] - pa[1]) * t,
  )}, ${Math.round(pa[2] + (pb[2] - pa[2]) * t)})`;
};

export const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** `#rrggbb` -> `rgba(r, g, b, a)`. */
export const rgba = (hex: string, alpha: number): string => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * Cheap deterministic hash -> 0..1. Used for bar heights so the chart is
 * stable across renders (no Math.random, which would desync frames that
 * render on different workers).
 */
export const hash01 = (n: number, seed = 0): number => {
  let x = Math.imul(n + seed * 374761393 + 1, 668265263);
  x = (x ^ (x >>> 13)) >>> 0;
  x = Math.imul(x, 1274126177) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

/** Year label for a quarter index. */
export const yearOf = (quarter: number): number =>
  START_YEAR + Math.floor(quarter / 4);
