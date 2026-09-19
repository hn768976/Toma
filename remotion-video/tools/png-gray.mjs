import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

/**
 * Minimal PNG reader for 8-bit greyscale, non-interlaced images -- which is
 * what the frame extractor in `match-reference.mjs` writes. Kept local so the
 * comparison tool needs no image dependency.
 */
export const decodeGray = (path) => {
  const b = readFileSync(path);
  let off = 8;
  let w = 0;
  let h = 0;
  const idat = [];

  while (off < b.length) {
    const len = b.readUInt32BE(off);
    const type = b.toString("ascii", off + 4, off + 8);
    const data = b.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      const bitDepth = data[8];
      const colorType = data[9];
      if (bitDepth !== 8 || colorType !== 0) {
        throw new Error(
          `${path}: expected 8-bit greyscale (bitDepth 8, colorType 0), got ${bitDepth}/${colorType}`,
        );
      }
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    off += 12 + len;
  }

  const raw = inflateSync(Buffer.concat(idat));
  const out = new Uint8Array(w * h);
  let p = 0;

  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    const row = y * w;
    const above = (y - 1) * w;
    for (let x = 0; x < w; x++) {
      const cur = raw[p + x];
      const left = x > 0 ? out[row + x - 1] : 0;
      const up = y > 0 ? out[above + x] : 0;
      const upLeft = x > 0 && y > 0 ? out[above + x - 1] : 0;
      let v;
      switch (filter) {
        case 0:
          v = cur;
          break;
        case 1:
          v = cur + left;
          break;
        case 2:
          v = cur + up;
          break;
        case 3:
          v = cur + ((left + up) >> 1);
          break;
        case 4: {
          const pred = left + up - upLeft;
          const dl = Math.abs(pred - left);
          const du = Math.abs(pred - up);
          const dul = Math.abs(pred - upLeft);
          v = cur + (dl <= du && dl <= dul ? left : du <= dul ? up : upLeft);
          break;
        }
        default:
          throw new Error(`${path}: unsupported PNG row filter ${filter}`);
      }
      out[row + x] = v & 255;
    }
    p += w;
  }

  return { width: w, height: h, data: out };
};
