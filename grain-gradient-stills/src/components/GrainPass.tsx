import { useLayoutEffect } from "react";
import type { GrainConfig } from "../compositions";
import { STAGE_ORDER, smoothstep, usePipeline, type FieldState } from "../pipeline";
import { rnd } from "../random";

/**
 * Grain is generated at a coarser pitch than the pixel grid and sampled back
 * bilinearly, so a grain has visible size and neighbouring grains clump
 * slightly. At 1:1 it would read as sensor noise rather than film.
 */
const GRAIN_PITCH = 1.3;

/** Amplitude at intensity 1 before the region and luminance gains, 0..1. */
const BASE_AMPLITUDE = 0.085;

/** Luminance at which grain has fully backed off to `brightGain`. */
const LUMINANCE_REFERENCE = 0.62;

/**
 * Grain is heaviest in the darkest regions, which is also where there is least
 * room for it: swing 30 levels around a pixel sitting at 4 and most of the
 * negative half is clipped away at zero, leaving a dead black speckled with
 * light dots instead of a grainy one. Tying the amplitude to the
 * value actually present keeps the grain alive all the way down instead: the
 * dark mid-tones, which is where most of a composition's dark area lives, stay
 * the grainiest part of the frame, and only true black is held back.
 */
const SHADOW_HEADROOM = 1.25;
/** A little value assumed under even a black pixel, so grain never dies. */
const SHADOW_PEDESTAL = 2;

/** Draw indices are offset per composition so each one grains differently. */
const SEED_STRIDE = 9973;

const bilinear = (
  field: Float32Array,
  cols: number,
  rows: number,
  fx: number,
  fy: number,
): number => {
  const x0 = fx < 0 ? 0 : fx > cols - 1 ? cols - 1 : Math.floor(fx);
  const y0 = fy < 0 ? 0 : fy > rows - 1 ? rows - 1 : Math.floor(fy);
  const x1 = x0 + 1 < cols ? x0 + 1 : x0;
  const y1 = y0 + 1 < rows ? y0 + 1 : y0;
  const tx = fx - x0;
  const ty = fy - y0;
  const a = field[y0 * cols + x0];
  const b = field[y0 * cols + x1];
  const c = field[y1 * cols + x0];
  const d = field[y1 * cols + x1];
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
};

/**
 * A slow low-frequency field, smoothstep-interpolated, that decides how grainy
 * each region of the frame is. Uniform grain across a frame reads as a digital
 * overlay; varying it is what makes it read as film stock.
 */
const buildVariationField = (
  grain: GrainConfig,
  aspect: number,
  seed: number,
): { field: Float32Array; cols: number; rows: number } => {
  const cols = Math.max(2, grain.variationCells);
  const rows = Math.max(2, Math.round(grain.variationCells / aspect));
  const field = new Float32Array(cols * rows);
  const [lo, hi] = grain.variation;
  for (let i = 0; i < field.length; i++) {
    field[i] = lo + (hi - lo) * rnd(seed + i);
  }
  return { field, cols, rows };
};

/**
 * Adds the grain into the float field, then a sub-LSB dither.
 *
 * This runs BEFORE the field is quantised to 8 bits. Smooth colour on a dark
 * background bands badly, and grain laid over an already-banded 8-bit image
 * cannot remove the bands underneath it — it has to be part of the signal that
 * gets rounded. The dither handles the few regions flat enough that even the
 * grain's own low points would otherwise land on one code value.
 */
export const applyGrain = (state: FieldState): void => {
  const { width, height, rgb, composition, seed } = state;
  const grain = composition.grain;

  const seedBase = seed * SEED_STRIDE;
  const variation = buildVariationField(grain, width / height, seedBase);

  // Monochrome grain: one value per cell, added equally to R, G and B so it
  // lightens and darkens the colour underneath instead of tinting it.
  const cols = Math.ceil(width / GRAIN_PITCH) + 2;
  const rows = Math.ceil(height / GRAIN_PITCH) + 2;
  const cells = new Float32Array(cols * rows);
  const cellSeed = seedBase + variation.field.length;
  for (let i = 0; i < cells.length; i++) {
    // Two draws summed: a triangular distribution, closer to film than a flat
    // one and cheap enough to run at 4K.
    cells[i] = rnd(cellSeed + i * 2) + rnd(cellSeed + i * 2 + 1) - 1;
  }

  const ditherSeed = cellSeed + cells.length * 2;
  const amplitude = grain.intensity * BASE_AMPLITUDE * 255;
  const { darkGain, brightGain } = grain;

  for (let y = 0; y < height; y++) {
    const gy = y / GRAIN_PITCH;
    const vy = ((y + 0.5) / height) * (variation.rows - 1);
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 3;
      const r = rgb[o];
      const g = rgb[o + 1];
      const b = rgb[o + 2];

      const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      // Heavier in the dark regions and lighter in the bright ones, the way
      // film actually behaves.
      const luminanceGain =
        darkGain +
        (brightGain - darkGain) * smoothstep(0, LUMINANCE_REFERENCE, luminance);

      const regionGain = bilinear(
        variation.field,
        variation.cols,
        variation.rows,
        ((x + 0.5) / width) * (variation.cols - 1),
        vy,
      );

      const sample = bilinear(cells, cols, rows, x / GRAIN_PITCH, gy);
      const level = luminance * 255;
      let amp = amplitude * regionGain * luminanceGain;
      const headroom = (level + SHADOW_PEDESTAL) * SHADOW_HEADROOM;
      if (amp > headroom) amp = headroom;
      const value = sample * amp;
      const dither = rnd(ditherSeed + y * width + x) - 0.5;

      rgb[o] = r + value + dither;
      rgb[o + 1] = g + value + dither;
      rgb[o + 2] = b + value + dither;
    }
  }
};

export const GrainPass: React.FC = () => {
  const { register } = usePipeline();
  useLayoutEffect(() => {
    register({ order: STAGE_ORDER.grain, run: applyGrain });
  }, [register]);
  return null;
};
