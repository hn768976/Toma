/**
 * Renders `public/grain.png`, the 256x256 noise tile the board multiplies over
 * the frame. Baking it beats running an SVG turbulence filter over a 4K frame
 * 600 times.
 *
 * Run with: npm run generate:grain
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas } from "@napi-rs/canvas";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "public", "grain.png");
const SIZE = 256;

// Same PRNG as src/data-network/rng.ts, so the tile is reproducible.
let a = 0x9e3779b9;
const rand = () => {
  a = (a + 0x6d2b79f5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const canvas = createCanvas(SIZE, SIZE);
const ctx = canvas.getContext("2d");
const image = ctx.createImageData(SIZE, SIZE);

for (let i = 0; i < SIZE * SIZE; i++) {
  // Gaussian-ish grey noise centred on mid grey, so `overlay` blending leaves
  // the average exposure of the frame alone.
  const n = (rand() + rand() + rand()) / 3;
  const v = Math.round(128 + (n - 0.5) * 190);
  image.data[i * 4 + 0] = v;
  image.data[i * 4 + 1] = v;
  image.data[i * 4 + 2] = v;
  image.data[i * 4 + 3] = 255;
}
ctx.putImageData(image, 0, 0);

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, await canvas.encode("png"));
console.log(`grain.png  ${SIZE}x${SIZE}`);
