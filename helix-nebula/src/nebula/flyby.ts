import { FPS } from "./constants";

// Foreground dust that drifts past the lens in the last quarter of the shot
// (in the reference, one or two soft white motes at a time, ~16.3-18.8 s). Each
// mote travels on a straight 3D path towards the camera, so it accelerates
// outwards and swells as it gets closer.

export const MAX_FLYBY = 6;

type Mote = {
  start: number; // seconds
  life: number; // seconds
  dirX: number;
  dirY: number;
  dist0: number; // initial screen-space distance from centre (frame heights)
  size: number; // radius at the end of its life (frame heights)
};

// Deterministic PRNG so every render produces the same motes.
const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const MOTES: Mote[] = (() => {
  const rnd = mulberry32(1337);
  const motes: Mote[] = [];
  for (let i = 0; i < MAX_FLYBY; i++) {
    const a = rnd() * Math.PI * 2;
    motes.push({
      // Mostly late in the shot, matching the reference.
      start: 16.2 + (i / MAX_FLYBY) * 2.2 + (rnd() - 0.5) * 0.2,
      life: 0.7 + rnd() * 0.5,
      dirX: Math.cos(a),
      dirY: Math.sin(a),
      dist0: 0.12 + rnd() * 0.32,
      size: 0.045 + Math.pow(rnd(), 2) * 0.035,
    });
  }
  return motes;
})();

// Returns vec4s (screen x, screen y, radius, alpha) in frame-height units,
// y pointing down, origin at the screen centre.
export const getFlyby = (frame: number): Float32Array => {
  const time = frame / FPS;
  const out = new Float32Array(MAX_FLYBY * 4);
  MOTES.forEach((m, i) => {
    const u = (time - m.start) / m.life;
    if (u < 0 || u > 1) return;
    // Perspective: depth goes from 1 to 0.35, screen offset scales with 1/z.
    const z = 1 - 0.65 * u;
    const d = m.dist0 / z;
    const r = (m.size * 0.35) / z;
    const fade = Math.min(1, u / 0.15) * Math.min(1, (1 - u) / 0.2);
    out.set([m.dirX * d, m.dirY * d, r, 0.85 * fade], i * 4);
  });
  return out;
};
