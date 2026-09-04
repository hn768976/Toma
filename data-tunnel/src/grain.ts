import { GRAIN_TILE } from "./constants";
import { mulberry32 } from "./random";

let cached: string | null = null;

/**
 * A tile of white noise held in the alpha channel, generated once from a
 * seeded PRNG and returned as a data URI.
 *
 * Composited with `plus-lighter` at a couple of percent it acts as a dither:
 * without it the very dark background ramp posterises into visible bands in
 * H.264, which is only apparent in the encoded file and not in the preview.
 */
export const grainTileUrl = (): string | null => {
  if (cached !== null) {
    return cached;
  }
  if (typeof document === "undefined") {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = GRAIN_TILE;
  canvas.height = GRAIN_TILE;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }

  const image = ctx.createImageData(GRAIN_TILE, GRAIN_TILE);
  const rnd = mulberry32(424242);
  for (let i = 0; i < GRAIN_TILE * GRAIN_TILE; i++) {
    image.data[i * 4] = 255;
    image.data[i * 4 + 1] = 255;
    image.data[i * 4 + 2] = 255;
    image.data[i * 4 + 3] = Math.floor(rnd() * 256);
  }
  ctx.putImageData(image, 0, 0);

  cached = canvas.toDataURL("image/png");
  return cached;
};
