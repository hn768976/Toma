import { mulberry32 } from "./random";
import type { ShellColorName } from "./palettes";

/**
 * All positions/sizes are in "reference units": a 768 x 432 grid matching the
 * reference clip. The renderer scales them to the composition size, so the
 * 4K composition is drawn natively at 3840 x 2160 (scale factor 5).
 */
export const REF_W = 768;
export const REF_H = 432;

export type Burst = {
  id: number;
  t0: number; // break time in seconds
  x: number;
  y: number;
  radius: number; // final radius of the break
  life: number; // seconds until fully burnt out
  color: ShellColorName;
  /** 1 = bright peony, lower values for the softer back-row shells */
  intensity: number;
  /** seconds of visible trail behind each star */
  trail: number;
  /** gravity in ref px / s^2 */
  gravity: number;
  /** how quickly the brightness decays (1 / seconds) */
  decay: number;
  stars: {
    dx: Float32Array;
    dy: Float32Array;
    speed: Float32Array;
    bright: Uint8Array; // 0 = dim group, 1 = bright group
    seed: Uint32Array;
  };
};

type Slot = {
  x: number;
  y: number;
  radius: number;
  color: ShellColorName;
  alt: ShellColorName; // occasional colour variation
  phase: number; // first break time (s)
  intensity: number;
  trail: number;
  gravity: number;
  decay: number;
  life: number;
};

/** Show period: each position re-fires every 2 s, like the reference. */
export const PERIOD = 2.0;

// Layout traced from the reference: a wide, roughly mirror-symmetric cluster
// with a big orange shell in the middle, red / gold shells top-left and
// top-right, bright orange shells low-left / low-right, a small pink shell on
// the right and softer shells at the back.
const SLOTS: Slot[] = [
  // top-left red
  { x: 140, y: 146, radius: 66, color: "red", alt: "orange", phase: -0.12, intensity: 1, trail: 0.59, gravity: 9, decay: 0.75, life: 2.5 },
  // centre big orange (first shown as a golden flash)
  { x: 384, y: 228, radius: 92, color: "orange", alt: "orange", phase: -0.08, intensity: 1.1, trail: 0.62, gravity: 8, decay: 0.7, life: 2.6 },
  // top-right gold
  { x: 536, y: 146, radius: 62, color: "gold", alt: "amber", phase: 0.3, intensity: 1, trail: 0.59, gravity: 9, decay: 0.75, life: 2.5 },
  // left-mid gold
  { x: 244, y: 196, radius: 54, color: "gold", alt: "gold", phase: 0.8, intensity: 1, trail: 0.55, gravity: 9, decay: 0.8, life: 2.4 },
  // low-left orange (bright ball that grows into a drooping curtain)
  { x: 176, y: 270, radius: 82, color: "orange", alt: "amber", phase: 0.95, intensity: 1.05, trail: 0.82, gravity: 22, decay: 1.4, life: 2.7 },
  // low-right orange
  { x: 582, y: 270, radius: 82, color: "orange", alt: "amber", phase: 1.0, intensity: 1.05, trail: 0.82, gravity: 22, decay: 1.4, life: 2.7 },
  // right pink
  { x: 638, y: 196, radius: 36, color: "pink", alt: "pink", phase: 1.22, intensity: 1, trail: 0.47, gravity: 8, decay: 0.85, life: 2.1 },
  // back-left amber (soft)
  { x: 236, y: 108, radius: 46, color: "amber", alt: "gold", phase: 1.35, intensity: 0.7, trail: 0.7, gravity: 10, decay: 0.9, life: 2.4 },
  // back-right red (soft)
  { x: 632, y: 112, radius: 50, color: "red", alt: "orange", phase: 1.5, intensity: 0.75, trail: 0.7, gravity: 10, decay: 0.9, life: 2.4 },
  // small top accents
  { x: 112, y: 106, radius: 22, color: "pink", alt: "red", phase: 1.62, intensity: 0.9, trail: 0.39, gravity: 7, decay: 1.0, life: 1.8 },
  { x: 664, y: 104, radius: 18, color: "orange", alt: "pink", phase: 1.78, intensity: 0.85, trail: 0.39, gravity: 7, decay: 1.0, life: 1.7 },
  // sparse glitter shell drifting at the right edge
  { x: 700, y: 236, radius: 40, color: "amber", alt: "red", phase: 1.9, intensity: 0.45, trail: 0.98, gravity: 13, decay: 0.7, life: 2.6 },
];

const makeStars = (count: number, seed: number): Burst["stars"] => {
  const rnd = mulberry32(seed);
  const dx = new Float32Array(count);
  const dy = new Float32Array(count);
  const speed = new Float32Array(count);
  const bright = new Uint8Array(count);
  const seeds = new Uint32Array(count);
  for (let i = 0; i < count; i++) {
    // Uniform direction on a sphere, projected to the image plane: gives the
    // dense-rimmed chrysanthemum look of a real spherical break.
    const z = rnd() * 2 - 1;
    const r = Math.sqrt(1 - z * z);
    const a = rnd() * Math.PI * 2;
    dx[i] = Math.cos(a) * r;
    dy[i] = Math.sin(a) * r;
    speed[i] = 0.86 + rnd() * 0.18;
    bright[i] = rnd() < 0.45 ? 1 : 0;
    seeds[i] = Math.floor(rnd() * 1e9);
  }
  return { dx, dy, speed, bright, seed: seeds };
};

export const buildShow = (durationSeconds: number): Burst[] => {
  const rnd = mulberry32(20261031);
  const bursts: Burst[] = [];
  let id = 0;
  for (const slot of SLOTS) {
    for (let t = slot.phase; t < durationSeconds + 0.1; t += PERIOD) {
      const isFirst = t === slot.phase;
      const jitterT = isFirst ? 0 : (rnd() - 0.5) * 0.12;
      const jx = (rnd() - 0.5) * 8;
      const jy = (rnd() - 0.5) * 6;
      const radius = slot.radius * (0.94 + rnd() * 0.12);
      const color = rnd() < 0.22 ? slot.alt : slot.color;
      const count = Math.round(160 + radius * 4.2);
      bursts.push({
        id: id++,
        t0: t + jitterT,
        x: slot.x + jx,
        y: slot.y + jy,
        radius,
        life: slot.life,
        color,
        intensity: slot.intensity * (0.92 + rnd() * 0.16),
        trail: slot.trail,
        gravity: slot.gravity,
        decay: slot.decay,
        stars: makeStars(count, Math.floor(rnd() * 1e9)),
      });
    }
  }
  return bursts.sort((a, b) => a.t0 - b.t0);
};
