import { DURATION } from "./layout";
import { rndInt, rndRange, rndSign } from "./rng";

export type GlitchWindow = { index: number; start: number; len: number };

export type GlitchState = {
  active: boolean;
  index: number;
  localFrame: number;
};

export type Slice = { y: number; h: number; dx: number };

/** Chromatic fringe offset, in 4K pixels. */
export const FRINGE_BASE = 5;
export const FRINGE_GLITCH = 16;

/**
 * A 2-3 frame hit every 70-130 frames. Windows are laid out once per variant
 * and always finish before frame 900, so frame 0 and frame 900 agree.
 */
export const buildGlitchSchedule = (seed: string): GlitchWindow[] => {
  const windows: GlitchWindow[] = [];
  let f = rndInt(`${seed}-glitch-offset`, 44, 96);
  let index = 0;
  while (f + 4 < DURATION) {
    windows.push({ index, start: f, len: rndInt(`${seed}-glitch-len-${index}`, 2, 4) });
    f += rndInt(`${seed}-glitch-gap-${index}`, 70, 131);
    index++;
  }
  return windows;
};

export const glitchAt = (windows: GlitchWindow[], frame: number): GlitchState => {
  for (const w of windows) {
    if (frame >= w.start && frame < w.start + w.len) {
      return { active: true, index: w.index, localFrame: frame - w.start };
    }
  }
  return { active: false, index: -1, localFrame: 0 };
};

const NO_SLICES: Slice[] = [];

/**
 * 2-4 thin horizontal slices of the symbol shoved sideways by 20-80px. Slices
 * come back sorted and non-overlapping so the banded blit stays gap-free.
 */
export const glitchSlices = (
  seed: string,
  state: GlitchState,
  height: number,
): Slice[] => {
  if (!state.active) {
    return NO_SLICES;
  }
  const key = `${seed}-slice-${state.index}-${state.localFrame}`;
  const count = rndInt(`${key}-n`, 2, 5);
  const raw: Slice[] = [];
  for (let i = 0; i < count; i++) {
    const h = rndRange(`${key}-h-${i}`, 10, 42);
    raw.push({
      y: rndRange(`${key}-y-${i}`, 0, Math.max(1, height - h)),
      h,
      dx: rndSign(`${key}-s-${i}`) * rndRange(`${key}-d-${i}`, 20, 80),
    });
  }
  raw.sort((a, b) => a.y - b.y);

  const out: Slice[] = [];
  let cursor = 0;
  for (const s of raw) {
    const y = Math.max(s.y, cursor);
    const h = Math.min(s.h, height - y);
    if (h > 2) {
      out.push({ y, h, dx: s.dx });
      cursor = y + h;
    }
  }
  return out;
};

/**
 * Blits a sprite in horizontal bands so glitch slices can be pushed sideways
 * without any extra clearing pass. Coordinates are centred on the origin.
 */
export const drawBanded = (
  ctx: CanvasRenderingContext2D,
  img: HTMLCanvasElement,
  offsetX: number,
  slices: Slice[],
) => {
  const w = img.width;
  const h = img.height;
  const left = -w / 2;
  const top = -h / 2;
  if (slices.length === 0) {
    ctx.drawImage(img, left + offsetX, top);
    return;
  }
  let y = 0;
  for (const s of slices) {
    if (s.y > y) {
      ctx.drawImage(img, 0, y, w, s.y - y, left + offsetX, top + y, w, s.y - y);
    }
    ctx.drawImage(img, 0, s.y, w, s.h, left + offsetX + s.dx, top + s.y, w, s.h);
    y = s.y + s.h;
  }
  if (y < h) {
    ctx.drawImage(img, 0, y, w, h - y, left + offsetX, top + y, w, h - y);
  }
};
