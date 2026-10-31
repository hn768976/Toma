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
    1 + Math.floor((99 * (t - PCT_START)) / (PCT_END - PCT_START) + 0.52),
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

/** Occasional 1-2 frame dropouts of the "LOADING..." label, as in the reference. */
const BLINKS: { at: number; dur: number; level: number }[] = (() => {
  const out: { at: number; dur: number; level: number }[] = [];
  let at = 1.1;
  let i = 0;
  while (at < 11.8) {
    out.push({
      at,
      dur: random(`blink-dur-${i}`) < 0.6 ? 1 / 30 : 2 / 30,
      level: 0.15 + 0.3 * random(`blink-level-${i}`),
    });
    at += 0.5 + 0.35 * random(`blink-gap-${i}`);
    i++;
  }
  return out;
})();

export const labelBlink = (t: number) => {
  for (const b of BLINKS) {
    if (t >= b.at && t < b.at + b.dur) return b.level;
  }
  return 1;
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
