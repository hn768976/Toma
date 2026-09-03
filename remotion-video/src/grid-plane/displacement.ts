import { createNoise4D } from "simplex-noise";
import { mulberry32 } from "../particle-ring/random";
import {
  CELL_SIZE,
  GRID_NEAR_Z,
  NOISE_SEED,
  RIPPLE_FREQUENCY,
  RIPPLE_TIME_RADIUS,
  SEGMENTS_X,
  SEGMENTS_Z,
  SWELL_FREQUENCY,
  SWELL_TIME_RADIUS,
} from "./constants";

// Two independently seeded 4D simplex fields: a broad swell and a finer
// ripple. Seeded from mulberry32 rather than Math.random so every render
// -- and every worker thread within a render -- produces the same field.
const swellNoise = createNoise4D(mulberry32(NOISE_SEED));
const rippleNoise = createNoise4D(mulberry32(NOISE_SEED + 7919));

export const VERTEX_COLUMNS = SEGMENTS_X + 1;
export const VERTEX_ROWS = SEGMENTS_Z + 1;
export const VERTEX_COUNT = VERTEX_COLUMNS * VERTEX_ROWS;

export const HALF_EXTENT_X = (SEGMENTS_X * CELL_SIZE) / 2;

export const vertexX = (column: number) => -HALF_EXTENT_X + column * CELL_SIZE;
export const vertexZ = (row: number) => GRID_NEAR_Z - row * CELL_SIZE;

/**
 * Fills `out` with the Y displacement of every grid vertex for one frame.
 *
 * `zOffset` is the grid's current travel phase: the mesh itself is
 * translated by it, so the noise has to be sampled at the vertex's *world*
 * position (localZ + zOffset) to keep the field anchored in space while
 * the wireframe slides through it.
 *
 * `t` is frame / durationInFrames. It drives a full circle through the
 * noise's two extra dimensions, so t = 0 and t = 1 sample the identical
 * field and the loop closes exactly.
 */
export const computeHeights = (
  out: Float32Array,
  zOffset: number,
  t: number,
  swellAmplitude: number,
  rippleAmplitude: number,
) => {
  const angle = Math.PI * 2 * t;
  const swellTimeC = Math.cos(angle) * SWELL_TIME_RADIUS;
  const swellTimeS = Math.sin(angle) * SWELL_TIME_RADIUS;
  const rippleTimeC = Math.cos(angle) * RIPPLE_TIME_RADIUS;
  const rippleTimeS = Math.sin(angle) * RIPPLE_TIME_RADIUS;

  for (let row = 0; row < VERTEX_ROWS; row++) {
    const worldZ = vertexZ(row) + zOffset;
    const swellZ = worldZ * SWELL_FREQUENCY;
    const rippleZ = worldZ * RIPPLE_FREQUENCY;
    const rowBase = row * VERTEX_COLUMNS;
    for (let column = 0; column < VERTEX_COLUMNS; column++) {
      const worldX = vertexX(column);
      out[rowBase + column] =
        swellNoise(worldX * SWELL_FREQUENCY, swellZ, swellTimeC, swellTimeS) *
          swellAmplitude +
        rippleNoise(
          worldX * RIPPLE_FREQUENCY,
          rippleZ,
          rippleTimeC,
          rippleTimeS,
        ) *
          rippleAmplitude;
    }
  }
};
