import { random } from "remotion";

/**
 * Timing measured from the reference (25 fps, 300 frames = 12 s):
 *  - frame 0-15 : HUD builds in (lines draw left -> right, labels flicker on)
 *  - frame 14   : "1%" appears
 *  - frame 214  : "100%" is reached, then the HUD holds until the end
 * Everything here works in seconds so it is frame-rate independent.
 */

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
export const easeOutCubic = (u: number) => 1 - Math.pow(1 - clamp01(u), 3);
export const easeInOut = (u: number) => {
  const x = clamp01(u);
  return x * x * (3 - 2 * x);
};

export const PCT_START = 14 / 25; // 0.56 s  -> 1 %
export const PCT_END = 214 / 25; // 8.56 s  -> 100 %

/** Displayed percentage (integer) or null before the counter starts. */
export const percentAt = (t: number): number | null => {
  if (t < PCT_START) return null;
  return Math.min(
    100,
    1 + Math.floor((99 * (t - PCT_START)) / (PCT_END - PCT_START) + 0.3),
  );
};

/** Continuous bar fill 0..1 following the counter. */
export const fillAt = (t: number) =>
  clamp01((t - (PCT_START - 0.04)) / (PCT_END - PCT_START + 0.04));

/** Build-in progress of the line work (fits the reference's frames 3, 6, 9, 12, 15). */
export const lineReveal = (t: number) => easeOutCubic(t / 0.7);

/** Fade helper: 0 before `start`, 1 after `start + dur`. */
export const fadeIn = (t: number, start: number, dur: number) =>
  clamp01((t - start) / dur);

/**
 * Neon "switch-on" flicker: before `start` it is off, then it stutters for a few
 * frames before settling at full brightness.
 */
export const flickerOn = (t: number, start: number, seed: string) => {
  if (t < start) return 0;
  const k = (t - start) / 0.16;
  if (k >= 1) return 1;
  const step = Math.floor((t - start) * 30);
  const r = random(`${seed}-${step}`);
  return k < 0.5 ? 0.25 + 0.5 * r : 0.6 + 0.4 * r;
};

/**
 * Regular blink of the label and bar fill: the reference dims them for 1-2 frames
 * every ~0.667 s starting at 0.96 s. Returns a 0..1 multiplier.
 */
export const BLINK_START = 0.96;
export const BLINK_PERIOD = 0.667;
export const blinkAt = (t: number) => {
  if (t < BLINK_START - 1e-6) return 0;
  const k = Math.floor((t - BLINK_START + 1e-6) / BLINK_PERIOD);
  const local = t - (BLINK_START + k * BLINK_PERIOD);
  // two 30 fps frames, the second one less deep (like a neon stutter)
  if (local < 1 / 30) return 1;
  if (local < 2 / 30) return 0.55 + 0.25 * random(`blink-${k}`);
  return 0;
};

/**
 * Small marker triangles hop between positions every few hundred ms
 * (stepped motion with a quick ease), like the reference's scanning markers.
 */
export const markerX = (
  t: number,
  seed: string,
  min: number,
  max: number,
  period: number,
) => {
  const k = Math.floor(t / period);
  const target = (i: number) => min + (max - min) * random(`${seed}-${i}`);
  const u = easeOutCubic((t - k * period) / 0.12);
  return target(k - 1) + (target(k) - target(k - 1)) * u;
};
