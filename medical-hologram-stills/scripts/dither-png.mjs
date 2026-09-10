#!/usr/bin/env node
// Adds ±1/255 dither to a PNG in place (or to --out <file>). Chrome renders
// the big smooth gradient field in 8-bit without dithering, so the deep blue
// falloff can show faint banding; a seeded ±1 level of noise breaks the
// bands up without visible grain. PNG is lossless, so the dither survives.
//
//   node scripts/dither-png.mjs out/heart_blue.png [--out other.png] [--seed 7]
//
// Also exported as ditherPng(buffer, seed) for scripts/render-stills.mjs.

import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";

const mulberry32 = (seed) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const ditherPng = (buffer, seed = 1) => {
  const png = PNG.sync.read(buffer);
  const data = png.data; // RGBA
  const rng = mulberry32(seed);
  for (let i = 0; i < data.length; i += 4) {
    // Independent ±1 per channel: -1, 0 or +1 with P = 1/4, 1/2, 1/4.
    for (let c = 0; c < 3; c++) {
      const n = Math.round(rng() * 2 - 1);
      if (n !== 0) {
        const v = data[i + c] + n;
        data[i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
    }
    data[i + 3] = 255; // opaque RGB output
  }
  return PNG.sync.write(png, { colorType: 2, deflateLevel: 6 });
};

const isMain = process.argv[1] && /dither-png\.mjs$/.test(process.argv[1]);
if (isMain) {
  const args = process.argv.slice(2);
  const input = args.find((a) => !a.startsWith("--"));
  if (!input) {
    console.error("usage: node scripts/dither-png.mjs <file.png> [--out <file.png>] [--seed <n>]");
    process.exit(1);
  }
  const outIdx = args.indexOf("--out");
  const out = outIdx >= 0 ? args[outIdx + 1] : input;
  const seedIdx = args.indexOf("--seed");
  const seed = seedIdx >= 0 ? Number(args[seedIdx + 1]) : 1;
  writeFileSync(out, ditherPng(readFileSync(input), seed));
  console.log(`✔ dithered ${input}${out !== input ? ` -> ${out}` : ""}`);
}
