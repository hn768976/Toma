import { mulberry32 } from "./rng";
import { SEED } from "../config";

/**
 * A tile of monochrome noise, built once and used as a CSS background.
 *
 * The background gradient is a long, shallow ramp across a very dark field,
 * which is exactly what H.264 bands on. A couple of percent of grain gives the
 * encoder something to dither against. Judge it on the encoded file — the
 * studio preview shows the gradient clean whether or not it survives encoding.
 */
const TILE = 256;

let cached: string | null = null;

export const getGrainDataUri = (): string => {
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = TILE;
  canvas.height = TILE;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(TILE, TILE);
  const rng = mulberry32(SEED ^ 0x00c0_ffee);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.round(rng() * 255);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  cached = canvas.toDataURL("image/png");
  return cached;
};

/** Deterministic per-frame offset so the grain crawls instead of sitting still. */
export const grainOffset = (frame: number) => {
  const rng = mulberry32((SEED ^ 0x00c0_ffee) + frame * 2654435761);
  return [Math.floor(rng() * TILE), Math.floor(rng() * TILE)] as const;
};
