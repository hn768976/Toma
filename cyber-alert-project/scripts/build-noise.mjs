// Writes seeded noise tiles to public/noise/ as PNG (no dependencies).
// grain.png:      256x256 grey noise for the grain overlay.
// colornoise.png: 64x64 saturated RGB blocks for look 2's noise patches.
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { mulberry32 } from "./rng.mjs";

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const png = (w, h, pixel) => {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const [r, g, b] = pixel(x, y);
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

mkdirSync(new URL("../public/noise/", import.meta.url), { recursive: true });

const rg = mulberry32(0x9e3779b1);
writeFileSync(
  new URL("../public/noise/grain.png", import.meta.url),
  png(256, 256, () => {
    // Triangular distribution: sum of two uniforms, centred on 128.
    const v = Math.round(((rg() + rg()) / 2) * 255);
    return [v, v, v];
  }),
);

const rc = mulberry32(0x1234abcd);
writeFileSync(
  new URL("../public/noise/colornoise.png", import.meta.url),
  png(64, 64, () => {
    const pick = rc();
    const v = 80 + Math.floor(rc() * 175);
    if (pick < 0.33) return [v, Math.floor(rc() * 40), Math.floor(rc() * 60)];
    if (pick < 0.66) return [Math.floor(rc() * 40), v, Math.floor(rc() * 80)];
    if (pick < 0.85) return [Math.floor(rc() * 60), Math.floor(rc() * 90), v];
    return [0, 0, 0];
  }),
);
console.log("noise tiles written");
