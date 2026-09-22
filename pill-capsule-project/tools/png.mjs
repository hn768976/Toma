// Minimal PNG reader for the verify loop: 8-bit non-interlaced greyscale, RGB
// or RGBA, which is everything Remotion and ffmpeg's png encoder produce.
// Zero dependencies on purpose — the verification tooling ships with the
// project and should not need an install to run.
import { inflateSync } from "node:zlib";
import { readFileSync } from "node:fs";

const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

export const readPNG = (file) => {
  const buf = readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`${file}: not a PNG`);

  let pos = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let colorType = 0;
  const idat = [];

  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
      colorType = body[9];
      if (depth !== 8) throw new Error(`${file}: only 8-bit PNGs supported, got ${depth}`);
      if (body[12] !== 0) throw new Error(`${file}: interlaced PNGs not supported`);
    } else if (type === "IDAT") {
      idat.push(body);
    } else if (type === "IEND") {
      break;
    }
    pos += 12 + len;
  }

  const ch = CHANNELS[colorType];
  if (!ch) throw new Error(`${file}: unsupported colour type ${colorType}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * ch;
  const out = Buffer.alloc(stride * height);

  // Undo the per-scanline filters (PNG spec 9.2).
  let src = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[src++];
    const row = y * stride;
    const prev = row - stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? out[row + x - ch] : 0;
      const b = y > 0 ? out[prev + x] : 0;
      const c = x >= ch && y > 0 ? out[prev + x - ch] : 0;
      const v = raw[src + x];
      let r;
      switch (filter) {
        case 0: r = v; break;
        case 1: r = v + a; break;
        case 2: r = v + b; break;
        case 3: r = v + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: throw new Error(`${file}: bad filter ${filter} on row ${y}`);
      }
      out[row + x] = r & 0xff;
    }
    src += stride;
  }

  return { width, height, channels: ch, data: out };
};

/** [r, g, b] at a pixel, in 0-255. */
export const pixel = (img, x, y) => {
  const i = (Math.round(y) * img.width + Math.round(x)) * img.channels;
  if (img.channels >= 3) return [img.data[i], img.data[i + 1], img.data[i + 2]];
  return [img.data[i], img.data[i], img.data[i]];
};

export const hex = (p) => "#" + p.map((v) => v.toString(16).padStart(2, "0")).join("");

/** Max and mean absolute per-channel difference between two same-size images. */
export const diff = (a, b) => {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`size mismatch: ${a.width}x${a.height} vs ${b.width}x${b.height}`);
  }
  let max = 0;
  let sum = 0;
  let count = 0;
  let worst = [0, 0];
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      const pa = pixel(a, x, y);
      const pb = pixel(b, x, y);
      for (let c = 0; c < 3; c++) {
        const d = Math.abs(pa[c] - pb[c]);
        if (d > max) {
          max = d;
          worst = [x, y];
        }
        sum += d;
        count++;
      }
    }
  }
  return { max, mean: sum / count, worst };
};
