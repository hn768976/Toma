import { GRAIN_AMPLITUDE, GRAIN_TILE_SIZE } from "./constants";
import { mulberry32 } from "./random";

/**
 * A tile of fine additive grain. Smooth gradients between the ribs band badly
 * in H.264 without it. Tiles are seeded per index and cycled by frame, so the
 * grain is deterministic, differs frame to frame, and repeats on the loop.
 */
export const buildGrainTile = (index: number): Uint8ClampedArray => {
  const random = mulberry32(0x9e37 + index * 7919);
  const pixels = new Uint8ClampedArray(GRAIN_TILE_SIZE * GRAIN_TILE_SIZE * 4);

  for (let i = 0; i < GRAIN_TILE_SIZE * GRAIN_TILE_SIZE; i++) {
    const value = random() * GRAIN_AMPLITUDE;
    const offset = i * 4;
    pixels[offset] = value;
    pixels[offset + 1] = value;
    pixels[offset + 2] = value;
    pixels[offset + 3] = 255;
  }

  return pixels;
};
