// Top-level configuration for the Christmas bokeh loop. Every length here
// is quoted at the composition's native 4K (3840x2160) and scaled by
// `scaleFor()` if the composition is ever registered at another size.

import type { BokehColorName } from "./theme";

export const FPS = 30;

/** 240 frames @ 30fps = 8.0s. Every period below divides this. */
export const DURATION_IN_FRAMES = 240;

export const WIDTH = 3840;
export const HEIGHT = 2160;

// ── Counts ────────────────────────────────────────────────────────────
export const BOKEH_COUNT = 90;
export const SNOWFLAKE_COUNT = 55;
export const SPARK_COUNT = 120;

// ── Bokeh ─────────────────────────────────────────────────────────────
/** Disc diameter range, px @4K. */
export const BOKEH_SIZE_RANGE: [number, number] = [30, 260];
/** Blur applied to a disc, px @4K. Small discs get the low end. */
export const BOKEH_BLUR_RANGE: [number, number] = [1.5, 16];
/** Alpha of a disc: small+sharp discs are the bright end. */
export const BOKEH_ALPHA_RANGE: [number, number] = [0.3, 0.95];
/** Radius of a disc's closed drift path, px @4K. */
export const BOKEH_DRIFT_RANGE: [number, number] = [7, 28];
/** Brightness breathes +/- this fraction. */
export const BOKEH_BREATHE_AMOUNT = 0.1;
/** Fraction of discs composited with 'lighter' so overlaps pool brighter. */
export const BOKEH_ADDITIVE_FRACTION = 0.62;
/** How many seeded clusters the field pools around. */
export const BOKEH_CLUSTER_COUNT = 9;
/** Fraction of discs placed inside a cluster rather than scattered. */
export const BOKEH_CLUSTERED_FRACTION = 0.62;

/**
 * Colour weighting is what makes this read as Christmas rather than as
 * generic bokeh. Red and gold carry it; green stays sparse, because an
 * even red/green split reads as a clash rather than as festive.
 */
export const BOKEH_COLOR_WEIGHTS: { name: BokehColorName; weight: number }[] = [
  { name: "red", weight: 0.35 },
  { name: "gold", weight: 0.25 },
  { name: "cream", weight: 0.2 },
  { name: "white", weight: 0.14 },
  { name: "green", weight: 0.06 },
];

// ── Snow ──────────────────────────────────────────────────────────────
/** Flake width range, px @4K. */
export const SNOW_SIZE_RANGE: [number, number] = [18, 140];
/** Blur, px @4K. Big (near) flakes are noticeably out of focus. */
export const SNOW_BLUR_RANGE: [number, number] = [0, 6.5];
export const SNOW_OPACITY_RANGE: [number, number] = [0.3, 0.9];
/**
 * A flake's fall must complete a whole number of traversals in 240
 * frames or the loop breaks. Larger (nearer) flakes take more of them,
 * which is what makes fall speed track size.
 */
export const SNOW_TRAVERSALS: [number, number, number] = [1, 2, 3];
/** Extra px above/below frame a flake travels before wrapping. */
export const SNOW_WRAP_MARGIN: [number, number] = [180, 460];
/** Horizontal sway amplitude, px @4K. */
export const SNOW_DRIFT_RANGE: [number, number] = [14, 62];
/** Whole turns a flake makes in 240 frames (sign picked per flake). */
export const SNOW_SPIN_TURNS: [number, number] = [1, 2];
/** Distinct seeded glyph shapes; sprites are cached per shape+size. */
export const SNOW_SHAPE_VARIANTS = 14;
/** Size brackets a flake snaps to, so sprites are shared. */
export const SNOW_SIZE_BRACKETS = 10;

// ── Sparks ────────────────────────────────────────────────────────────
/** Core diameter range, px @4K — much smaller than any disc. */
export const SPARK_SIZE_RANGE: [number, number] = [3, 12];
/** Twinkle periods in frames. All divide 240. */
export const SPARK_PERIODS = [24, 30, 40, 48, 60, 80, 120];
/** Sparks that flash noticeably brighter for a few frames. */
export const SPARK_FLASH_FRACTION = 0.12;
export const SPARK_FLASH_FRAMES = 4;
export const SPARK_FLASH_GAIN = 3.1;

// ── Whole-frame finish ────────────────────────────────────────────────
/** Ambient drift of the entire composition, px @4K. */
export const AMBIENT_DRIFT = 8;
/** Strength of the additive bloom pass over bokeh and sparks. */
export const BLOOM_STRENGTH = 0.62;
/** Bloom is computed at this fraction of full res, then scaled back up. */
export const BLOOM_DOWNSCALE = 0.25;
/** Blur radius applied in that downscaled buffer, px. */
export const BLOOM_BLUR = 11;
/** Alpha the vignette reaches in the frame corners. */
export const VIGNETTE_MAX_ALPHA = 0.55;
/** Exponent of the vignette falloff; higher keeps the middle clearer. */
export const VIGNETTE_FALLOFF = 2.4;
/** Gradient stops used to approximate that curve smoothly. */
export const VIGNETTE_STOPS = 16;
export const GRAIN_ALPHA = 0.04;
export const GRAIN_TILE_SIZE = 512;
/** Distinct noise tiles cycled through; must divide 240. */
export const GRAIN_TILE_COUNT = 8;

/** Lets the piece stay proportioned if rendered at a non-4K size. */
export const scaleFor = (width: number) => width / WIDTH;
