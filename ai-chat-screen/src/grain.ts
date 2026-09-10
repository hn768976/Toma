import { mulberry32 } from "./random";

// One 256x256 tile of monochrome noise, built once and then tiled and
// nudged by a per-frame offset. Generating full-frame noise at 4K would
// cost 8.3M pixels every frame for an effect that is 2% opaque; the tile
// is indistinguishable and free. The grain also dithers the near-black
// background, which is what keeps the encode from banding.
const TILE = 256;

let cached: string | null = null;

export const grainTile = (): string => {
  if (cached) return cached;
  if (typeof document === "undefined") return "";

  const canvas = document.createElement("canvas");
  canvas.width = TILE;
  canvas.height = TILE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Bimodal black/white rather than a uniform grey ramp: at the ~1%
  // strength this is composited at, a grey ramp carries too little
  // amplitude to move an 8-bit value at all, and stops dithering. Equal
  // numbers of black and white texels keep the average brightness where
  // it was.
  const image = ctx.createImageData(TILE, TILE);
  const rand = mulberry32(20240917);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = rand() < 0.5 ? 0 : 255;
    image.data[i] = v;
    image.data[i + 1] = v;
    image.data[i + 2] = v;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  cached = canvas.toDataURL("image/png");
  return cached;
};

// A deterministic per-frame jitter, so the grain crawls the way film
// grain does instead of sitting still like a texture.
export const grainOffset = (frame: number) => {
  const rand = mulberry32(frame * 2654435761);
  return { x: Math.floor(rand() * TILE), y: Math.floor(rand() * TILE) };
};
