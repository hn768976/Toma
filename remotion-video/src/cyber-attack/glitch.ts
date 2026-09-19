import { GLITCH_HOLD, TEAR_COLORS, scaleFor } from "./constants";
import type { DirectorState } from "./director";
import { pick, rand, randRange, stream } from "./random";

// The damage pass.
//
// Everything here re-rolls once every GLITCH_HOLD frames rather than every
// frame. That 10Hz cadence is what the reference does and it matters: a
// per-frame re-roll reads as fizz, while a held state reads as a signal
// that is genuinely stuck.
//
// Order is deliberate. Slices and blocks displace the picture, the channel
// split then fringes whatever those moves produced, and the flat tears go
// on last because they are meant to look like data replacing the picture
// rather than a treatment applied to it.

type Scratch = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D };

const scratches = new Map<string, Scratch>();

const scratch = (key: string, width: number, height: number): Scratch => {
  const id = `${key}:${width}x${height}`;
  const hit = scratches.get(id);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const made = {
    canvas,
    ctx: canvas.getContext("2d") as CanvasRenderingContext2D,
  };
  scratches.set(id, made);
  return made;
};

/** Slices the picture into bands and shoves them sideways. */
const displaceSlices = (
  dst: CanvasRenderingContext2D,
  src: CanvasImageSource,
  state: DirectorState,
  block: number,
  width: number,
  height: number,
  grunge: number,
): void => {
  const s = scaleFor(width);
  const count = Math.max(1, Math.round((3 + state.intensity * 26) * grunge));
  const next = stream(block * 7919 + 13);
  for (let i = 0; i < count; i += 1) {
    const y = Math.floor(next() * height);
    const h = Math.max(
      2,
      Math.floor((2 + next() * 46) * s * (0.5 + state.intensity)),
    );
    // Most shoves are small; a few are enormous. That mix is what makes
    // the tearing feel like real dropped data.
    const big = next() < 0.18;
    const mag = (big ? 260 : 46) * s * state.intensity;
    const dx = (next() - 0.5) * 2 * mag;
    dst.drawImage(src, 0, y, width, h, dx, y, width, h);
    // Edge of a big shove exposes a sliver of black; fill it from the
    // opposite side so the frame never shows the backing canvas.
    if (big) {
      dst.drawImage(
        src,
        0,
        y,
        width,
        h,
        dx + (dx > 0 ? -width : width),
        y,
        width,
        h,
      );
    }
  }
};

/** Rectangular blocks lifted and dropped somewhere near where they were. */
const shuffleBlocks = (
  dst: CanvasRenderingContext2D,
  src: CanvasImageSource,
  state: DirectorState,
  block: number,
  width: number,
  height: number,
  grunge: number,
): void => {
  if (state.intensity < 0.4) return;
  const s = scaleFor(width);
  const count = Math.round(state.intensity * 14 * grunge);
  const next = stream(block * 104729 + 7);
  for (let i = 0; i < count; i += 1) {
    const w = (60 + next() * 420) * s;
    const h = (14 + next() * 90) * s;
    const x = next() * (width - w);
    const y = next() * (height - h);
    const dx = (next() - 0.5) * 180 * s * state.intensity;
    const dy = (next() - 0.5) * 40 * s * state.intensity;
    dst.drawImage(src, x, y, w, h, x + dx, y + dy, w, h);
  }
};

/** One band stretched down the frame — the vertical drag on the titles. */
const smear = (
  dst: CanvasRenderingContext2D,
  src: CanvasImageSource,
  state: DirectorState,
  block: number,
  width: number,
  height: number,
  grunge: number,
): void => {
  if (state.intensity < 0.55 || rand(block, 0xa1) > 0.25 * grunge) return;
  const s = scaleFor(width);
  const y = randRange(height * 0.12, height * 0.82, block, 0xa2);
  const h = Math.max(2, 3 * s);
  const stretch = randRange(40, 260, block, 0xa3) * s;
  dst.save();
  dst.globalAlpha = 0.6;
  dst.drawImage(src, 0, y, width, h, 0, y, width, stretch);
  dst.restore();
};

/** Red / green / blue drawn back at different offsets. */
const channelSplit = (
  out: CanvasRenderingContext2D,
  src: HTMLCanvasElement,
  state: DirectorState,
  block: number,
  width: number,
  height: number,
  grunge: number,
): void => {
  const s = scaleFor(width);
  // Fringing is character rather than clutter, so it is only softened by
  // a lower grunge setting, never removed.
  const mag = state.intensity * 18 * s * (0.6 + 0.4 * grunge);
  const dx = (rand(block, 0xb1) - 0.5) * 2 * mag;
  const dy = (rand(block, 0xb2) - 0.5) * mag * 0.3;

  const channels: [string, number, number][] = [
    ["#ff0000", dx, dy],
    ["#00ff00", 0, 0],
    ["#0000ff", -dx, -dy],
  ];

  out.globalCompositeOperation = "source-over";
  out.fillStyle = "#000000";
  out.fillRect(0, 0, width, height);
  out.globalCompositeOperation = "lighter";
  for (const [tint, ox, oy] of channels) {
    const sc = scratch(`ch${tint}`, width, height);
    sc.ctx.globalCompositeOperation = "source-over";
    sc.ctx.drawImage(src, 0, 0);
    sc.ctx.globalCompositeOperation = "multiply";
    sc.ctx.fillStyle = tint;
    sc.ctx.fillRect(0, 0, width, height);
    sc.ctx.globalCompositeOperation = "source-over";
    out.drawImage(sc.canvas, ox, oy);
  }
  out.globalCompositeOperation = "source-over";
};

/** Flat bars of pure colour — data standing in for picture. */
const tearBars = (
  out: CanvasRenderingContext2D,
  state: DirectorState,
  block: number,
  width: number,
  height: number,
  grunge: number,
): void => {
  const s = scaleFor(width);
  if (state.intensity < 0.28) return;
  // Tears arrive in bursts. Blanketing every held block with bars reads
  // as a pattern; letting most blocks through clean makes the ones that
  // do tear land like dropped data.
  if (rand(block, 0xc0) > (0.2 + state.intensity * 0.42) * grunge) return;
  const count = Math.max(1, Math.round((2 + state.intensity * 11) * grunge));
  const next = stream(block * 15485863 + 3);
  for (let i = 0; i < count; i += 1) {
    if (next() > 0.6) continue;
    const y = next() * height;
    // Most tears are hairlines; roughly one in eight is a slab that
    // takes out a serious chunk of the frame.
    const slab = next() < 0.1;
    const h = slab
      ? (45 + next() * 120) * s * state.intensity
      : Math.max(1, (2 + next() * 60) * s * state.intensity);
    const full = next() < 0.4;
    const w = full ? width : width * (0.18 + next() * 0.82);
    const x = full ? 0 : next() < 0.5 ? 0 : width - w;
    const color = pick(TEAR_COLORS, block, i, 0xc1);
    out.save();
    out.globalAlpha = slab ? 0.6 + next() * 0.4 : 0.45 + next() * 0.55;
    out.globalCompositeOperation = next() < 0.3 ? "difference" : "source-over";
    out.fillStyle = color;
    out.fillRect(x, y, w, h);
    out.restore();
  }
};

let noisePattern: CanvasPattern | null = null;
let noiseKey = "";

const getNoise = (out: CanvasRenderingContext2D): CanvasPattern | null => {
  const size = 160;
  if (noiseKey === `${size}` && noisePattern) return noisePattern;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const cx = c.getContext("2d");
  if (!cx) return null;
  const img = cx.createImageData(size, size);
  const next = stream(0xfeed);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(next() * 255);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  cx.putImageData(img, 0, 0);
  noisePattern = out.createPattern(c, "repeat");
  noiseKey = `${size}`;
  return noisePattern;
};

let scanPattern: CanvasPattern | null = null;
let scanKey = "";

const getScanlines = (
  out: CanvasRenderingContext2D,
  width: number,
): CanvasPattern | null => {
  const s = scaleFor(width);
  const line = Math.max(1, Math.round(2 * s));
  const key = `${line}`;
  if (scanKey === key && scanPattern) return scanPattern;
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = line * 2;
  const cx = c.getContext("2d");
  if (!cx) return null;
  cx.fillStyle = "rgba(0, 0, 0, 0.42)";
  cx.fillRect(0, 0, 4, line);
  scanPattern = out.createPattern(c, "repeat");
  scanKey = key;
  return scanPattern;
};

/** Pushes the whole frame toward the mood colour of the moment. */
const grade = (
  out: CanvasRenderingContext2D,
  state: DirectorState,
  width: number,
  height: number,
): void => {
  const { mood } = state;
  out.save();
  // Multiply first: this is what makes the red passages read as red
  // rather than as a red haze laid over blue.
  out.globalCompositeOperation = "multiply";
  out.globalAlpha = 0.55;
  out.fillStyle = `rgb(${Math.round(120 + mood.r * 135)}, ${Math.round(110 + mood.g * 130)}, ${Math.round(140 + mood.b * 115)})`;
  out.fillRect(0, 0, width, height);
  // Then lift the blacks back up with the same hue so it stays luminous.
  out.globalCompositeOperation = "lighter";
  out.globalAlpha = 0.1 + state.mood.heat * 0.12;
  out.fillStyle = `rgb(${Math.round(mood.r * 90)}, ${Math.round(mood.g * 60)}, ${Math.round(mood.b * 95)})`;
  out.fillRect(0, 0, width, height);
  out.restore();
};

/** Applies the full damage chain, from the clean frame to the visible one. */
export const applyGlitch = (
  out: CanvasRenderingContext2D,
  clean: HTMLCanvasElement,
  state: DirectorState,
  frame: number,
  width: number,
  height: number,
  grunge = 1,
): void => {
  const block = Math.floor(frame / GLITCH_HOLD);

  // 1. Displacement, onto a staging canvas so slices always read from the
  //    undamaged picture instead of feeding back on themselves.
  const stage = scratch("stage", width, height);
  stage.ctx.globalCompositeOperation = "source-over";
  stage.ctx.globalAlpha = 1;
  stage.ctx.drawImage(clean, 0, 0);
  displaceSlices(stage.ctx, clean, state, block, width, height, grunge);
  shuffleBlocks(stage.ctx, clean, state, block, width, height, grunge);
  smear(stage.ctx, clean, state, block, width, height, grunge);

  // 2. Chromatic fringing on the displaced picture.
  const splitting = state.intensity > 0.22;
  if (splitting) {
    channelSplit(out, stage.canvas, state, block, width, height, grunge);
  } else {
    out.globalCompositeOperation = "source-over";
    out.globalAlpha = 1;
    out.drawImage(stage.canvas, 0, 0);
  }

  // 3. Flat data tears.
  tearBars(out, state, block, width, height, grunge);

  // 4. Grade, then the texture that sells it as a screen.
  grade(out, state, width, height);

  const scan = getScanlines(out, width);
  if (scan) {
    out.save();
    out.globalAlpha = 0.5;
    out.fillStyle = scan;
    out.fillRect(0, 0, width, height);
    out.restore();
  }

  const noise = getNoise(out);
  if (noise) {
    out.save();
    out.globalCompositeOperation = "overlay";
    // Grain never goes away entirely — it is what makes this read as a
    // screen rather than as flat vector art.
    out.globalAlpha = (0.05 + state.intensity * 0.12) * (0.4 + 0.6 * grunge);
    // Re-seat the tile every frame so the grain moves.
    out.translate(
      Math.floor(rand(frame, 0xd1) * 160),
      Math.floor(rand(frame, 0xd2) * 160),
    );
    out.fillStyle = noise;
    out.fillRect(-160, -160, width + 320, height + 320);
    out.restore();
  }

  // 5. Blowouts, last, over everything.
  if (state.flash > 0) {
    // Most blowouts take a colour cast off the tear palette; the rest go
    // to white and lift the whole frame off the floor.
    const white = rand(block, 0xe2) < 0.4;
    out.save();
    out.globalCompositeOperation = "lighter";
    out.globalAlpha = state.flash * (white ? 0.72 : 0.5);
    out.fillStyle = white ? "#ffffff" : pick(TEAR_COLORS, block, 0xe1);
    out.fillRect(0, 0, width, height);
    out.restore();
  }
  if (state.invert) {
    out.save();
    out.globalCompositeOperation = "difference";
    out.fillStyle = "#ffffff";
    out.fillRect(0, 0, width, height);
    out.restore();
  }

  out.globalCompositeOperation = "source-over";
  out.globalAlpha = 1;
};
