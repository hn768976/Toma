import { clamp, easeInOutSine } from "../lib/random";

/**
 * Global drift measured from the reference with phase correlation:
 * the whole field slides up-and-right along the 45° diagonal,
 * ≈311 px right / 330 px up over 320 frames on a 768 px wide frame,
 * slightly faster in the first two seconds and slower around 7–9 s.
 */
const SPEED_KEYS: [number, number][] = [
  [0, 1.1],
  [15, 1.22],
  [40, 1.5],
  [60, 1.45],
  [75, 1.1],
  [90, 1.0],
  [150, 1.03],
  [200, 0.96],
  [230, 0.76],
  [270, 0.82],
  [290, 1.12],
  [320, 1.15],
];
const TOTAL_DX = 311.5;
const TOTAL_DY = -329.8;
export const REF_WIDTH_PX = 768;

const speedAt = (f: number) => {
  for (let i = 0; i < SPEED_KEYS.length - 1; i++) {
    const [f0, v0] = SPEED_KEYS[i];
    const [f1, v1] = SPEED_KEYS[i + 1];
    if (f <= f1) return v0 + (v1 - v0) * clamp((f - f0) / (f1 - f0));
  }
  return SPEED_KEYS[SPEED_KEYS.length - 1][1];
};

/** Cumulative screen displacement (reference pixels) at a given frame. */
export const createDrift = (totalFrames: number) => {
  const cum: number[] = [0];
  for (let f = 1; f <= totalFrames; f++) cum.push(cum[f - 1] + speedAt(f - 0.5));
  const norm = cum[Math.min(319, totalFrames)] || 1;
  return (frame: number) => {
    const f = clamp(frame, 0, totalFrames);
    const i = Math.floor(f);
    const frac = f - i;
    const c = cum[i] + (cum[Math.min(i + 1, totalFrames)] - cum[i]) * frac;
    const p = c / norm;
    return { dx: TOTAL_DX * p, dy: TOTAL_DY * p };
  };
};

/** Version 2: tilted, orbiting, slowly dollying camera. */
export const orbitAt = (frame: number, totalFrames: number) => {
  const t = clamp(frame / (totalFrames - 1));
  const e = easeInOutSine(t);
  return {
    tilt: ((30 + 14 * e) * Math.PI) / 180, // polar angle from straight down
    azimuth: ((-128 + 52 * e) * Math.PI) / 180, // camera position around the target
    distance: 13.6 - 3.4 * e,
  };
};
