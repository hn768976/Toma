/**
 * Offscreen canvas helpers and the finishing passes.
 *
 * The passes themselves live in the vendored library; this module binds the
 * one that needs a loop length to this project's LOOP_FRAMES, so callers do
 * not have to thread it through.
 */
import { grainPass as libGrainPass } from "../lib/canvas/passes";
import { LOOP_FRAMES } from "./constants";

export {
  makeOffscreen,
  makeBloom,
  vignettePass,
  makeGrainTiles,
  prepareLayer,
  type Bloom,
  type BloomOptions,
} from "../lib/canvas/passes";

/** Grain for this project's loop: seeded on `frame % LOOP_FRAMES`. */
export const grainPass = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: number,
  alpha: number,
  tiles: readonly HTMLCanvasElement[],
): void => libGrainPass(ctx, width, height, frame, alpha, tiles, LOOP_FRAMES);
