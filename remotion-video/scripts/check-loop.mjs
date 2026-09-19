#!/usr/bin/env node
/**
 * Verifies that each gradient composition actually loops.
 *
 *   node scripts/check-loop.mjs            # all variants
 *   node scripts/check-loop.mjs V2         # just that one
 *
 * Renders the four frames that bracket the wrap point and compares the step
 * from the last frame back to the first against a normal frame-to-frame step.
 * A ratio near 1.0 means the seam is indistinguishable from any other frame
 * boundary. A ratio well above 1 means something in the shader is not periodic
 * -- a linear ramp in uPhase rather than a closed path, say.
 *
 * Deliberately dependency-free: it reads the PNGs Remotion writes with nothing
 * but zlib, so running the check never drags an image library into the project.
 */
import { spawnSync } from "node:child_process";
import { inflateSync } from "node:zlib";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const VARIANTS = [
  { id: "V1-MidnightBloom", frames: 300 },
  { id: "V2-HolographicFoil", frames: 600 },
  { id: "V3-CyanDrift", frames: 450 },
  { id: "V4-DeepCurrent", frames: 600 },
];

/** Minimal PNG reader: 8-bit, non-interlaced, which is what Remotion emits. */
function decodePng(buffer) {
  let offset = 8; // skip signature
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const bitDepth = data[8];
      const colorType = data[9];
      if (bitDepth !== 8 || data[12] !== 0) {
        throw new Error(`Unsupported PNG: depth ${bitDepth}, interlace ${data[12]}`);
      }
      channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
      if (!channels) throw new Error(`Unsupported PNG colour type ${colorType}`);
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(stride * height);

  // Undo the per-scanline filters. Each row is prefixed with a filter byte.
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;

    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= channels ? prev[x - channels] : 0;
      let value = src[x];

      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = value & 0xff;
    }
  }

  return out;
}

function renderStill(composition, frame, file) {
  const result = spawnSync(
    "npx",
    [
      "remotion",
      "still",
      composition,
      file,
      `--frame=${frame}`,
      "--gl=swangle",
      "--scale=0.25",
      "--log=error",
    ],
    { cwd: root, stdio: "inherit" },
  );
  if (result.status !== 0) throw new Error(`Failed to render ${composition} frame ${frame}`);
  return decodePng(readFileSync(file));
}

const meanAbsDiff = (a, b) => {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
};

const filters = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const selected = filters.length
  ? VARIANTS.filter((v) => filters.some((f) => v.id.toLowerCase().includes(f.toLowerCase())))
  : VARIANTS;

const tmp = mkdtempSync(join(tmpdir(), "loopcheck-"));
let worst = 0;

try {
  for (const { id, frames } of selected) {
    const composition = `${id}-1080p`;
    const at = (frame, name) =>
      renderStill(composition, frame, join(tmp, `${id}-${name}.png`));

    const first = at(0, "first");
    const second = at(1, "second");
    const penultimate = at(frames - 2, "penultimate");
    const last = at(frames - 1, "last");

    const seam = meanAbsDiff(last, first);
    const typical =
      (meanAbsDiff(penultimate, last) + meanAbsDiff(first, second)) / 2;
    const ratio = seam / typical;
    worst = Math.max(worst, ratio);

    console.log(
      `${id.padEnd(22)} seam=${seam.toFixed(3)}  typical=${typical.toFixed(3)}  ratio=${ratio.toFixed(2)}x  ${ratio < 1.35 ? "OK" : "NOT SEAMLESS"}`,
    );
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

if (worst >= 1.35) {
  console.error("\nAt least one composition does not loop cleanly.");
  process.exit(1);
}
console.log("\nAll checked compositions loop cleanly.");
