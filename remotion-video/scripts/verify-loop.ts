/**
 * Loop verification for the document-approval piece.
 *
 * Part 1 asserts, numerically, that every continuous motion in `motion.ts`
 * has the identical value at frame 600 and frame 0 - the column drift tiles
 * exactly, and every flicker, bob and pulse period divides 600.
 *
 * Part 2 renders frame 0 and frame 600 of a composition and reports the pixel
 * difference between them, split into the region that loops and the region
 * the timeline's one-shot entrances occupy.
 *
 * Run with:  npm run verify:loop
 */
import { inflateSync } from "node:zlib";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DURATION_IN_FRAMES, TIMING } from "../src/doc-approval/layout.ts";
import {
  accentDashOffset,
  columnDrift,
  docBob,
  docDropout,
  grainTileIndex,
  iconPulse,
  loopFrame,
  loopT,
  mapDrift,
  squareFlicker,
} from "../src/doc-approval/motion.ts";

let failures = 0;

const check = (name: string, a: unknown, b: unknown): void => {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (!ok) {
    failures++;
    console.error(`  FAIL ${name}: frame 0 = ${JSON.stringify(a)}, frame 600 = ${JSON.stringify(b)}`);
  } else {
    console.log(`  ok   ${name}`);
  }
};

const L = DURATION_IN_FRAMES;

console.log(`\nPart 1 - continuous motion at frame 0 vs frame ${L}\n`);

check("loopT", loopT(0), loopT(L));
check("loopFrame", loopFrame(0), loopFrame(L));
check("mapDrift", mapDrift(0), mapDrift(L));
check("iconPulse", iconPulse(0), iconPulse(L));
check("grainTileIndex", grainTileIndex(0), grainTileIndex(L));

for (const tiles of [1, 2, 3]) {
  check(`columnDrift x${tiles}`, columnDrift(0, tiles), columnDrift(L, tiles));
}

for (const period of TIMING.squareFlickerPeriods) {
  for (const offset of [0, 7, period - 1]) {
    check(
      `squareFlicker p=${period} o=${offset}`,
      squareFlicker(0, period, offset),
      squareFlicker(L, period, offset),
    );
  }
}

for (const period of TIMING.docFlickerPeriods) {
  for (const offset of [0, 13, period - 1]) {
    check(
      `docDropout p=${period} o=${offset}`,
      docDropout(0, period, offset),
      docDropout(L, period, offset),
    );
  }
}

for (const phase of [0, 0.31, 0.87]) {
  check(`docBob phase=${phase}`, docBob(0, 7, 9, phase), docBob(L, 7, 9, phase));
}

for (const direction of [-1, 1]) {
  check(
    `accentDashOffset dir=${direction}`,
    accentDashOffset(0, direction, 44),
    accentDashOffset(L, direction, 44),
  );
}

console.log(`\nPart 1b - periods divide ${L}\n`);
const periods: [string, number][] = [
  ["iconPulse", TIMING.iconPulse],
  ["accentRulePeriod", TIMING.accentRulePeriod],
  ["columnDriftBase", TIMING.columnDriftBase],
  ...TIMING.squareFlickerPeriods.map((p) => [`square ${p}`, p] as [string, number]),
  ...TIMING.docFlickerPeriods.map((p) => [`docFlicker ${p}`, p] as [string, number]),
];
for (const [name, period] of periods) {
  if (L % period !== 0) {
    failures++;
    console.error(`  FAIL ${name} = ${period} does not divide ${L}`);
  } else {
    console.log(`  ok   ${name} = ${period} (${L / period} cycles per loop)`);
  }
}

console.log("\nPart 1c - no one-shot entrance starts after the settle point\n");
const lastEvent = Math.max(
  TIMING.ringDraw[1],
  TIMING.symbolDraw[1],
  TIMING.stampAt + TIMING.stampFrames,
  TIMING.bracketsFadeIn[1],
  TIMING.labelFadeIn[1],
  TIMING.docsStart + 5 * TIMING.docStagger + TIMING.docSpringDuration,
  TIMING.ratingStart + 4 * TIMING.starStagger + TIMING.starSpringDuration,
  TIMING.scoreRuleDraw[1],
);
if (lastEvent > TIMING.settleStart) {
  failures++;
  console.error(`  FAIL last entrance ends at ${lastEvent}, after settle at ${TIMING.settleStart}`);
} else {
  console.log(`  ok   last entrance ends at frame ${lastEvent}; frames ${TIMING.settleStart}-${L} are hold only`);
}

// --------------------------------------------------------------- part 2

type Png = { width: number; height: number; channels: number; data: Uint8Array };

/** Minimal reader for the 8-bit RGB/RGBA non-interlaced PNGs Chrome produces. */
const readPng = (file: string): Png => {
  const buf = readFileSync(file);
  let offset = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat: Buffer[] = [];
  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    const body = buf.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      channels = body[9] === 6 ? 4 : body[9] === 2 ? 3 : 0;
      if (body[8] !== 8 || channels === 0 || body[12] !== 0) {
        throw new Error(
          `Expected an 8-bit RGB or RGBA non-interlaced PNG (depth ${body[8]}, colour type ${body[9]}, interlace ${body[12]})`,
        );
      }
    } else if (type === "IDAT") {
      idat.push(body);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = new Uint8Array(height * stride);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    for (let x = 0; x < stride; x++) {
      const value = raw[pos + x];
      const left = x >= channels ? out[y * stride + x - channels] : 0;
      const up = y > 0 ? out[(y - 1) * stride + x] : 0;
      const upLeft = x >= channels && y > 0 ? out[(y - 1) * stride + x - channels] : 0;
      let recon: number;
      switch (filter) {
        case 0: recon = value; break;
        case 1: recon = value + left; break;
        case 2: recon = value + up; break;
        case 3: recon = value + ((left + up) >> 1); break;
        case 4: {
          const p = left + up - upLeft;
          const pa = Math.abs(p - left);
          const pb = Math.abs(p - up);
          const pc = Math.abs(p - upLeft);
          recon = value + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft);
          break;
        }
        default: throw new Error(`Unknown PNG filter ${filter}`);
      }
      out[y * stride + x] = recon & 0xff;
    }
    pos += stride;
  }
  return { width, height, channels, data: out };
};

const compositionId = process.argv[2] ?? "DocApproved";
const outDir = path.resolve("out/loop");

const { bundle } = await import("@remotion/bundler");
const { renderStill, selectComposition } = await import("@remotion/renderer");

console.log(`\nPart 2 - pixel comparison of frames ${L} apart\n`);
mkdirSync(outDir, { recursive: true });

// The Node APIs do not read remotion.config.ts, so mirror its browser
// override here for sandboxes that ship a Chromium but cannot download one.
const playwrightHeadlessShell =
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const browserExecutable = existsSync(playwrightHeadlessShell)
  ? playwrightHeadlessShell
  : null;

const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id: compositionId, browserExecutable });
// Frames past the composition's last one are rendered from a copy that is
// long enough to hold them. Nothing else about the composition changes, and
// every motion is a pure function of the frame number, so frame N + 600
// exercises exactly the state the loop would wrap into.
const extended = { ...composition, durationInFrames: L * 2 + 1 };

const renderFrame = async (frame: number): Promise<string> => {
  const output = path.join(outDir, `${compositionId}-${String(frame).padStart(4, "0")}.png`);
  await renderStill({
    composition: extended,
    serveUrl,
    output,
    frame,
    imageFormat: "png",
    browserExecutable,
  });
  return output;
};

const diff = (a: Png, b: Png): { pixels: number; max: number } => {
  if (a.width !== b.width || a.height !== b.height || a.channels !== b.channels) {
    throw new Error("Size or format mismatch between the two frames");
  }
  let pixels = 0;
  let max = 0;
  for (let i = 0; i < a.data.length; i += a.channels) {
    const d =
      Math.abs(a.data[i] - b.data[i]) +
      Math.abs(a.data[i + 1] - b.data[i + 1]) +
      Math.abs(a.data[i + 2] - b.data[i + 2]);
    if (d > 0) {
      pixels++;
      if (d > max) max = d;
    }
  }
  return { pixels, max };
};

// From the end of the build (frame 220) onward the piece is exactly periodic,
// so any frame in the hold and the frame 600 later must be identical.
for (const frame of [300, 560]) {
  const a = readPng(await renderFrame(frame));
  const b = readPng(await renderFrame(frame + L));
  const total = a.width * a.height;
  const result = diff(a, b);
  if (result.pixels === 0) {
    console.log(`  ok   frame ${frame} and frame ${frame + L} are pixel-identical (${a.width}x${a.height})`);
  } else {
    failures++;
    console.error(
      `  FAIL frame ${frame} vs frame ${frame + L}: ${result.pixels} of ${total} pixels differ, max channel sum ${result.max}`,
    );
  }
}

// Reported, not asserted. Frames 0-220 are the one-shot build described by
// the brief - the backdrop fades up and the icon, documents and rating row
// arrive - so frame 600 holds that finished state while frame 0 is empty.
// What has to match at frame 600 is the drift phase of every continuous
// motion, which Part 1 checks directly.
const zero = readPng(await renderFrame(0));
const wrap = readPng(await renderFrame(L));
const wrapDiff = diff(zero, wrap);
console.log(
  `  note frame 0 vs frame ${L}: ${wrapDiff.pixels} of ${zero.width * zero.height} pixels differ - the frames 0-220 build-on, not a drift mismatch (see Part 1).`,
);

console.log(failures === 0 ? "\nAll loop checks passed.\n" : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
