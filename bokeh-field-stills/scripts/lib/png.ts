/**
 * A minimal PNG reader/writer, so the contact sheet needs no image
 * dependency: everything it uses (zlib, buffers) ships with Node.
 *
 * Scope is deliberately narrow — 8-bit non-interlaced RGB/RGBA/grey, which is
 * what Chrome (and therefore Remotion) writes. Anything else throws loudly
 * rather than producing a quietly wrong sheet.
 */
import { deflateSync, inflateSync } from "node:zlib";

export type Bitmap = { width: number; height: number; data: Uint8Array };

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

const crc32 = (buffer: Buffer) => {
  let crc = -1;
  for (let i = 0; i < buffer.length; i++) crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
};

const paeth = (a: number, b: number, c: number) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
};

/** Decodes to tightly packed RGBA. */
export const decodePng = (file: Buffer): Bitmap => {
  for (let i = 0; i < SIGNATURE.length; i++) {
    if (file[i] !== SIGNATURE[i]) throw new Error("Not a PNG file");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat: Buffer[] = [];

  while (offset < file.length) {
    const length = file.readUInt32BE(offset);
    const type = file.toString("ascii", offset + 4, offset + 8);
    const start = offset + 8;

    if (type === "IHDR") {
      width = file.readUInt32BE(start);
      height = file.readUInt32BE(start + 4);
      bitDepth = file[start + 8];
      colorType = file[start + 9];
      if (file[start + 12] !== 0) throw new Error("Interlaced PNGs are not supported");
    } else if (type === "IDAT") {
      idat.push(file.subarray(start, start + length));
    } else if (type === "IEND") {
      break;
    }

    offset = start + length + 4;
  }

  if (bitDepth !== 8) throw new Error(`Unsupported PNG bit depth: ${bitDepth}`);
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType as 0 | 2 | 4 | 6];
  if (!channels) throw new Error(`Unsupported PNG colour type: ${colorType}`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = new Uint8Array(stride * height);

  // Reverse the per-scanline filters in place.
  let source = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[source++];
    const row = y * stride;
    const previous = row - stride;
    for (let x = 0; x < stride; x++) {
      const value = raw[source + x];
      const left = x >= channels ? pixels[row + x - channels] : 0;
      const up = y > 0 ? pixels[previous + x] : 0;
      const upLeft = y > 0 && x >= channels ? pixels[previous + x - channels] : 0;
      let restored: number;
      switch (filter) {
        case 0:
          restored = value;
          break;
        case 1:
          restored = value + left;
          break;
        case 2:
          restored = value + up;
          break;
        case 3:
          restored = value + ((left + up) >> 1);
          break;
        case 4:
          restored = value + paeth(left, up, upLeft);
          break;
        default:
          throw new Error(`Unknown PNG filter type: ${filter}`);
      }
      pixels[row + x] = restored & 0xff;
    }
    source += stride;
  }

  if (channels === 4) return { width, height, data: pixels };

  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0, p = 0; i < width * height; i++, p += 4) {
    if (channels === 3) {
      rgba[p] = pixels[i * 3];
      rgba[p + 1] = pixels[i * 3 + 1];
      rgba[p + 2] = pixels[i * 3 + 2];
    } else if (channels === 1) {
      rgba[p] = rgba[p + 1] = rgba[p + 2] = pixels[i];
    } else {
      rgba[p] = rgba[p + 1] = rgba[p + 2] = pixels[i * 2];
    }
    rgba[p + 3] = 255;
  }
  return { width, height, data: rgba };
};

const chunk = (type: string, data: Buffer) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
};

export const encodePng = ({ width, height, data }: Bitmap): Buffer => {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    raw.set(data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return Buffer.concat([
    Buffer.from(SIGNATURE),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

/** Box-filter downsample. Averaging every source pixel keeps fine grain and
 *  single-pixel marks visible instead of aliasing them away. */
export const downsample = (source: Bitmap, width: number, height: number): Bitmap => {
  const data = new Uint8Array(width * height * 4);
  const scaleX = source.width / width;
  const scaleY = source.height / height;

  for (let y = 0; y < height; y++) {
    const y0 = Math.floor(y * scaleY);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * scaleY));
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor(x * scaleX);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * scaleX));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      for (let sy = y0; sy < y1; sy++) {
        let index = (sy * source.width + x0) * 4;
        for (let sx = x0; sx < x1; sx++) {
          r += source.data[index];
          g += source.data[index + 1];
          b += source.data[index + 2];
          a += source.data[index + 3];
          index += 4;
          count++;
        }
      }
      const target = (y * width + x) * 4;
      data[target] = r / count;
      data[target + 1] = g / count;
      data[target + 2] = b / count;
      data[target + 3] = a / count;
    }
  }

  return { width, height, data };
};

export const blit = (target: Bitmap, source: Bitmap, atX: number, atY: number) => {
  for (let y = 0; y < source.height; y++) {
    const ty = atY + y;
    if (ty < 0 || ty >= target.height) continue;
    for (let x = 0; x < source.width; x++) {
      const tx = atX + x;
      if (tx < 0 || tx >= target.width) continue;
      const s = (y * source.width + x) * 4;
      const t = (ty * target.width + tx) * 4;
      target.data[t] = source.data[s];
      target.data[t + 1] = source.data[s + 1];
      target.data[t + 2] = source.data[s + 2];
      target.data[t + 3] = source.data[s + 3];
    }
  }
};
