/**
 * Minimal PNG reader for the verification scripts: 8-bit RGB/RGBA/grayscale,
 * non-interlaced, which is what Remotion and ffmpeg write. Kept in the project
 * so the checks run with no extra dependency.
 */
import { readFileSync } from "node:fs";
import zlib from "node:zlib";

// Minimal PNG reader: 8-bit RGB / RGBA / grayscale, non-interlaced.
export function readPNG(path) {
  const buf = readFileSync(path);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a png: " + path);
  let pos = 8;
  let w = 0, h = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (data[12] !== 0) throw new Error("interlaced png unsupported");
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  if (bitDepth !== 8) throw new Error("bit depth " + bitDepth + " unsupported");
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error("color type " + colorType + " unsupported");
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = channels;
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  let rp = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[rp++];
    const line = raw.subarray(rp, rp + stride);
    rp += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev ? prev[i] : 0;
      const c = prev && i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[i] = v & 0xff;
    }
  }
  // normalise to RGB triplets
  const rgb = new Uint8Array(w * h * 3);
  for (let i = 0, n = w * h; i < n; i++) {
    if (channels === 1) rgb[i * 3] = rgb[i * 3 + 1] = rgb[i * 3 + 2] = out[i];
    else if (channels === 2) rgb[i * 3] = rgb[i * 3 + 1] = rgb[i * 3 + 2] = out[i * 2];
    else { rgb[i * 3] = out[i * bpp]; rgb[i * 3 + 1] = out[i * bpp + 1]; rgb[i * 3 + 2] = out[i * bpp + 2]; }
  }
  return { width: w, height: h, data: rgb };
}

export const px = (img, x, y) => {
  const i = (y * img.width + x) * 3;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
};
export const luma = (img, x, y) => {
  const [r, g, b] = px(img, x, y);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
