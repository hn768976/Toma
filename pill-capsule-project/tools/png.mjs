// Minimal PNG reader for the verify loop: 8-bit non-interlaced greyscale, RGB
// or RGBA, which is everything Remotion and ffmpeg's png encoder produce.
// Zero dependencies on purpose — the verification tooling ships with the
// project and should not need an install to run.
import * as zlib from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";

const { inflateSync } = zlib;

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

/** Encode an image back to PNG (8-bit RGB, filter 0). */
export const writePNG = (file, img) => {
  const { deflateSync } = zlib;
  const stride = img.width * 3;
  const raw = Buffer.alloc((stride + 1) * img.height);
  for (let y = 0; y < img.height; y++) {
    raw[y * (stride + 1)] = 0;
    for (let x = 0; x < img.width; x++) {
      const p = pixel(img, x, y);
      const o = y * (stride + 1) + 1 + x * 3;
      raw[o] = p[0];
      raw[o + 1] = p[1];
      raw[o + 2] = p[2];
    }
  }
  const chunk = (type, body) => {
    const out = Buffer.alloc(body.length + 12);
    out.writeUInt32BE(body.length, 0);
    out.write(type, 4, "ascii");
    body.copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)) >>> 0, 8 + body.length);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.width, 0);
  ihdr.writeUInt32BE(img.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  writeFileSync(file, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]));
};

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

const crc32 = (buf) => {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
};

/** Crop, then nearest-neighbour zoom, for inspecting a detail at 1:1 or larger. */
export const crop = (img, x, y, w, h, zoom = 1) => {
  const out = {
    width: w * zoom,
    height: h * zoom,
    channels: 3,
    data: Buffer.alloc(w * zoom * h * zoom * 3),
  };
  for (let j = 0; j < out.height; j++) {
    for (let i = 0; i < out.width; i++) {
      const p = pixel(img, x + Math.floor(i / zoom), y + Math.floor(j / zoom));
      const o = (j * out.width + i) * 3;
      out.data[o] = p[0];
      out.data[o + 1] = p[1];
      out.data[o + 2] = p[2];
    }
  }
  return out;
};
