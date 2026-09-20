/**
 * Pixel inspection for the verify loop.
 *
 * Decodes a PNG (or a frame of an mp4) to raw RGB through Remotion's own
 * bundled ffmpeg — there is no system ffmpeg here — and answers the
 * geometric questions the per-look criteria ask: where does the plinth top
 * sit in frame, is this corner truly black, is the plinth warmer than the
 * wall, are these two frames identical.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readPng } from "./png.mjs";

/**
 * Load an image. A PNG is read directly; any other file is treated as a
 * video and the requested frame is extracted to PNG first.
 */
export const decode = (file, { frame = null } = {}) => {
  if (!existsSync(file)) throw new Error(`no such file: ${file}`);
  let png;
  let tmp = null;
  try {
    if (file.toLowerCase().endsWith(".png") && frame === null) {
      png = readPng(file);
    } else {
      tmp = mkdtempSync(join(tmpdir(), "px-"));
      const target = join(tmp, "frame.png");
      const select = frame === null ? [] : ["-vf", `select=eq(n\\,${frame})`, "-vsync", "0"];
      execFileSync(
        "npx",
        ["remotion", "ffmpeg", "-v", "error", "-i", file, ...select,
         "-frames:v", "1", "-y", target],
        { stdio: ["ignore", "ignore", "pipe"] },
      );
      png = readPng(target);
    }
  } finally {
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  }

  const { width: w, height: h, data: buf } = png;
  return {
    width: w,
    height: h,
    data: buf,
    at(x, y) {
      const i = (Math.round(y) * w + Math.round(x)) * 3;
      return [buf[i], buf[i + 1], buf[i + 2]];
    },
    lum(x, y) {
      const [r, g, b] = this.at(x, y);
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    },
  };
};

/** Scan a vertical line and report rows where luminance changes sharply. */
export const edgesInColumn = (img, xFrac, threshold = 6) => {
  const x = Math.round(xFrac * img.width);
  const out = [];
  let prev = img.lum(x, 0);
  for (let y = 1; y < img.height; y++) {
    const v = img.lum(x, y);
    if (Math.abs(v - prev) > threshold) {
      out.push({ y, yFrac: y / img.height, from: prev, to: v });
    }
    prev = v;
  }
  return out;
};

export const columnProfile = (img, xFrac, step = 1) => {
  const x = Math.round(xFrac * img.width);
  const out = [];
  for (let y = 0; y < img.height; y += step) out.push([y / img.height, img.lum(x, y)]);
  return out;
};

export const rowProfile = (img, yFrac, step = 1) => {
  const y = Math.round(yFrac * img.height);
  const out = [];
  for (let x = 0; x < img.width; x += step) out.push([x / img.width, img.lum(x, y)]);
  return out;
};

export const identical = (a, b) => {
  if (a.width !== b.width || a.height !== b.height) return { same: false, reason: "size" };
  if (a.data.length !== b.data.length) return { same: false, reason: "length" };
  let diff = 0;
  let maxDiff = 0;
  let firstAt = null;
  for (let i = 0; i < a.data.length; i++) {
    const d = Math.abs(a.data[i] - b.data[i]);
    if (d > 0) {
      diff++;
      if (firstAt === null) firstAt = i;
      if (d > maxDiff) maxDiff = d;
    }
  }
  return {
    same: diff === 0,
    differingBytes: diff,
    totalBytes: a.data.length,
    maxDiff,
    firstAt,
  };
};

/** Mean colour over a rectangle given in frame fractions. */
export const meanRect = (img, x0, y0, x1, y1) => {
  const X0 = Math.round(x0 * img.width);
  const X1 = Math.round(x1 * img.width);
  const Y0 = Math.round(y0 * img.height);
  const Y1 = Math.round(y1 * img.height);
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = Y0; y < Y1; y++) {
    for (let x = X0; x < X1; x++) {
      const [pr, pg, pb] = img.at(x, y);
      r += pr; g += pg; b += pb; n++;
    }
  }
  return [r / n, g / n, b / n];
};

/** Local contrast (stdev of luminance) in a rect — a proxy for "is this sharp". */
export const detail = (img, x0, y0, x1, y1) => {
  const X0 = Math.round(x0 * img.width);
  const X1 = Math.round(x1 * img.width);
  const Y0 = Math.round(y0 * img.height);
  const Y1 = Math.round(y1 * img.height);
  let sum = 0, n = 0;
  for (let y = Y0 + 1; y < Y1 - 1; y++) {
    for (let x = X0 + 1; x < X1 - 1; x++) {
      const gx = img.lum(x + 1, y) - img.lum(x - 1, y);
      const gy = img.lum(x, y + 1) - img.lum(x, y - 1);
      sum += Math.hypot(gx, gy);
      n++;
    }
  }
  return sum / n;
};
