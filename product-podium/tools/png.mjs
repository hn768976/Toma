/**
 * Minimal PNG reader.
 *
 * The ffmpeg that ships with Remotion is a reduced build with no rawvideo
 * muxer, and there is no system ffmpeg here, so frames are extracted as PNG
 * and decoded in-process. 8-bit RGB and RGBA, non-interlaced, which is
 * everything this project produces.
 */
import { inflateSync } from "node:zlib";
import { readFileSync } from "node:fs";

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
};

export const readPng = (file) => {
  const buf = readFileSync(file);
  if (!buf.subarray(0, 8).equals(PNG_SIG)) throw new Error(`${file}: not a PNG`);

  let off = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let colorType = 0;
  const idat = [];

  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString("ascii", off + 4, off + 8);
    const body = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
      colorType = body[9];
      if (body[12] !== 0) throw new Error("interlaced PNG not supported");
    } else if (type === "IDAT") {
      idat.push(body);
    } else if (type === "IEND") {
      break;
    }
    off += 12 + len;
  }

  if (depth !== 8) throw new Error(`bit depth ${depth} not supported`);
  const channels = colorType === 2 ? 3 : colorType === 6 ? 4 : 0;
  if (!channels) throw new Error(`colour type ${colorType} not supported`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(width * height * 3);
  let prev = Buffer.alloc(stride);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      switch (filter) {
        case 0: break;
        case 1: line[i] = (line[i] + a) & 0xff; break;
        case 2: line[i] = (line[i] + b) & 0xff; break;
        case 3: line[i] = (line[i] + ((a + b) >> 1)) & 0xff; break;
        case 4: line[i] = (line[i] + paeth(a, b, c)) & 0xff; break;
        default: throw new Error(`unknown filter ${filter}`);
      }
    }
    for (let x = 0; x < width; x++) {
      out[(y * width + x) * 3] = line[x * channels];
      out[(y * width + x) * 3 + 1] = line[x * channels + 1];
      out[(y * width + x) * 3 + 2] = line[x * channels + 2];
    }
    prev = line;
  }

  return { width, height, data: out };
};
