#!/usr/bin/env node
/**
 * Compare a render against a reference clip on the quantities that actually
 * decide whether a fabric texture reads as the same material.
 *
 *   node tools/match-reference.mjs <reference> <render> [--frame N]
 *
 * Both inputs may be a video or a still. Each is reduced to 8-bit greyscale at
 * the reference's own resolution, so the two are always measured on the same
 * pixel grid -- comparing a 1920px render against a 768px reference at their
 * native sizes would otherwise make the render look finer simply for being
 * bigger.
 *
 * Why these measures. Luma mean, sigma and percentiles pin the tone. The share
 * of pixels at pure white matters on its own: fitting the summary stats without
 * watching it is how bright cells end up as blown discs. The autocorrelation of
 * a row gives the weave's period (its peak's lag), how regular it is (the peak),
 * and how cleanly light and dark cells alternate (the trough at half period).
 * Row spread gives the lighting falloff across the frame, and mean local sigma
 * separates contrast that lives inside a small patch from contrast that is just
 * a gradient -- two textures can share a global sigma and look nothing alike.
 *
 * Analysis only: it never writes to the project.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { decodeGray } from "./png-gray.mjs";

const here = dirname(fileURLToPath(import.meta.url));

/** Remotion ships a full ffmpeg/ffprobe with its native compositor. */
const findFfmpeg = () => {
  const candidates = [
    "@remotion/compositor-linux-x64-gnu",
    "@remotion/compositor-linux-x64-musl",
    "@remotion/compositor-linux-arm64-gnu",
    "@remotion/compositor-darwin-x64",
    "@remotion/compositor-darwin-arm64",
    "@remotion/compositor-win32-x64-msvc",
  ];
  for (const pkg of candidates) {
    const dir = join(here, "..", "node_modules", pkg);
    for (const name of ["ffmpeg", "ffmpeg.exe"]) {
      if (existsSync(join(dir, name))) return { bin: join(dir, name), libDir: dir };
    }
  }
  throw new Error(
    "Could not find the ffmpeg that ships with Remotion's compositor. Run npm install first.",
  );
};

const { bin: ffmpeg, libDir } = findFfmpeg();
const run = (args) =>
  execFileSync(ffmpeg, args, {
    stdio: ["ignore", "pipe", "pipe"],
    // The bundled ffmpeg links against shared libraries beside it.
    env: { ...process.env, LD_LIBRARY_PATH: libDir, DYLD_LIBRARY_PATH: libDir },
  });

const argv = process.argv.slice(2);
let frame = 0;
const positional = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--frame") {
    frame = Number(argv[++i]);
    if (!Number.isFinite(frame) || frame < 0) {
      console.error("--frame needs a non-negative number");
      process.exit(2);
    }
  } else if (argv[i].startsWith("--")) {
    console.error(`unknown option ${argv[i]}`);
    process.exit(2);
  } else {
    positional.push(argv[i]);
  }
}
const [reference, render] = positional;

if (!reference || !render) {
  console.error("usage: node tools/match-reference.mjs <reference> <render> [--frame N]");
  process.exit(2);
}

const tmp = mkdtempSync(join(tmpdir(), "match-ref-"));
const grab = (input, out, size) => {
  const vf = "scale=" + (size ? `${size.w}:${size.h}` : "iw:ih");
  const base = ["-y", "-v", "error"];
  const tail = ["-i", input, "-vf", vf, "-pix_fmt", "gray", "-frames:v", "1", out];

  // Seek only when asked for a later frame, and fall back to no seek: a still
  // image has nothing to seek into, so the seek would yield an empty output.
  const attempts = frame > 0 ? [["-ss", String(frame / 30)], []] : [[]];
  for (const seek of attempts) {
    try {
      run([...base, ...seek, ...tail]);
      if (existsSync(out)) return decodeGray(out);
    } catch {
      // try the next form
    }
  }
  throw new Error(`ffmpeg could not read a frame from ${input}`);
};

try {
  // The reference sets the measurement grid; the render is matched onto it.
  const ref = grab(reference, join(tmp, "ref.png"));
  const mine = grab(render, join(tmp, "mine.png"), { w: ref.width, h: ref.height });

  const measure = ({ width: W, height: H, data: d }) => {
    let sum = 0;
    for (let i = 0; i < d.length; i++) sum += d[i];
    const mean = sum / d.length;

    let variance = 0;
    for (let i = 0; i < d.length; i++) variance += (d[i] - mean) ** 2;
    const std = Math.sqrt(variance / d.length);

    const sorted = Array.from(d).sort((a, b) => a - b);
    const pct = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];

    let clipped = 0;
    for (let i = 0; i < d.length; i++) if (d[i] >= 254) clipped++;

    // Autocorrelation along a row, averaged over rows.
    const maxLag = Math.min(40, Math.floor(W / 8));
    const acc = new Float64Array(maxLag + 1);
    for (let y = 0; y < H; y += 2) {
      let rowMean = 0;
      for (let x = 0; x < W; x++) rowMean += d[y * W + x];
      rowMean /= W;
      for (let lag = 0; lag <= maxLag; lag++) {
        let s = 0;
        let n = 0;
        for (let x = 0; x + lag < W; x++) {
          s += (d[y * W + x] - rowMean) * (d[y * W + x + lag] - rowMean);
          n++;
        }
        acc[lag] += s / n;
      }
    }
    const ac = Array.from(acc, (v) => v / acc[0]);
    // The weave's period is the *first* prominent peak, not the tallest one.
    // A periodic signal correlates just as strongly at 2x and 3x its period, so
    // taking the global maximum picks a harmonic and reports a period several
    // times too long.
    let peak = 0;
    let peakLag = 0;
    for (let lag = 2; lag < maxLag - 1; lag++) {
      if (ac[lag] > ac[lag - 1] && ac[lag] >= ac[lag + 1] && ac[lag] > 0.15) {
        peak = ac[lag];
        peakLag = lag;
        break;
      }
    }
    if (peakLag === 0) {
      // No clear periodicity; fall back to the strongest lag so the number
      // reported is at least defined.
      for (let lag = 2; lag < maxLag; lag++)
        if (ac[lag] > peak) {
          peak = ac[lag];
          peakLag = lag;
        }
    }
    let trough = 0;
    for (let lag = 1; lag < peakLag; lag++) if (ac[lag] < trough) trough = ac[lag];

    const band = (b, of = 8) => {
      let s = 0;
      let n = 0;
      for (let y = Math.floor((b * H) / of); y < Math.floor(((b + 1) * H) / of); y++)
        for (let x = 0; x < W; x++) {
          s += d[y * W + x];
          n++;
        }
      return s / n;
    };

    // Mean sigma within tiles: contrast that lives inside a small patch, as
    // opposed to contrast that is really a gradient across the frame.
    const tw = Math.floor(W / 6);
    const th = Math.floor(H / 3);
    let localSum = 0;
    let tiles = 0;
    for (let ty = 0; ty < 3; ty++)
      for (let tx = 0; tx < 6; tx++) {
        const x0 = tx * tw;
        const y0 = ty * th;
        let s = 0;
        let n = 0;
        for (let y = y0; y < y0 + th; y++)
          for (let x = x0; x < x0 + tw; x++) {
            s += d[y * W + x];
            n++;
          }
        const m = s / n;
        let v = 0;
        for (let y = y0; y < y0 + th; y++)
          for (let x = x0; x < x0 + tw; x++) v += (d[y * W + x] - m) ** 2;
        localSum += Math.sqrt(v / n);
        tiles++;
      }

    return {
      mean,
      std,
      p01: pct(0.01),
      p50: pct(0.5),
      p99: pct(0.99),
      clipped: (100 * clipped) / d.length,
      acPeak: peak,
      acTrough: trough,
      acPeakLag: peakLag,
      rowSpread: band(0) - band(7),
      localStd: localSum / tiles,
    };
  };

  const a = measure(ref);
  const b = measure(mine);

  // Tolerances: how far each quantity can drift before the two stop reading as
  // the same material.
  const rows = [
    ["luma mean", "mean", 4],
    ["luma sigma", "std", 3],
    ["1st pct", "p01", 10],
    ["median", "p50", 6],
    ["99th pct", "p99", 6],
    ["clipped %", "clipped", 2.5],
    ["weave period px", "acPeakLag", 1],
    ["regularity", "acPeak", 0.08],
    ["alternation", "acTrough", 0.1],
    ["row falloff", "rowSpread", 12],
    ["local sigma", "localStd", 4],
  ];

  console.log(`reference  ${reference}  (${ref.width}x${ref.height}, frame ${frame})`);
  console.log(`render     ${render}  (matched onto the reference grid)\n`);
  console.log("quantity           reference     render      delta");
  let fails = 0;
  for (const [label, key, tol] of rows) {
    const delta = b[key] - a[key];
    const ok = Math.abs(delta) <= tol;
    if (!ok) fails++;
    console.log(
      `${label.padEnd(18)}${a[key].toFixed(2).padStart(9)}${b[key].toFixed(2).padStart(12)}` +
        `${(delta >= 0 ? "+" : "") + delta.toFixed(2)}`.padStart(11) +
        (ok ? "" : "   <-- outside tolerance"),
    );
  }
  console.log(`\n${rows.length - fails}/${rows.length} within tolerance.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
