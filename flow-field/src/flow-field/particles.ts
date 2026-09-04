import { CAMERA } from "./camera";
import {
  CAM_PITCH_DEG,
  CAM_Y,
  CYCLE_LENGTHS,
  PARTICLE_COUNT,
  SEED_DEPTH_FAR,
  SEED_DEPTH_NEAR,
  SEED_X_MARGIN,
  SPEED_MAX,
  SPEED_MIN,
  TRAIL_MAX,
  TRAIL_MIN,
} from "./constants";
import { lerp, mulberry32 } from "./random";

/**
 * The particle table: fixed seed position, trail length, speed, life length and
 * phase offset, all drawn once from a seeded PRNG.
 *
 * Nothing here is mutated at render time. A particle's position at any frame is
 * a pure function of (seed, frame) — integrate forward from the seed by
 * `(frame + phase) mod cycle` steps — which is what lets Remotion render frames
 * out of order across threads without the picture flickering between them.
 */
export type Particles = {
  seedX: Float32Array;
  seedZ: Float32Array;
  /** Trail length in integration steps. */
  trail: Uint8Array;
  /** Life length in frames; always a divisor of the composition duration. */
  cycle: Uint8Array;
  phase: Uint8Array;
  speed: Float32Array;
  /** Per-particle brightness bias, before the ribbon field is applied. */
  bias: Float32Array;
  count: number;
  /** Upper bound on trail segments emitted in a frame, for buffer sizing. */
  maxSegments: number;
};

export const createParticles = (seed: number): Particles => {
  const rand = mulberry32(seed);
  const n = PARTICLE_COUNT;

  const seedX = new Float32Array(n);
  const seedZ = new Float32Array(n);
  const trail = new Uint8Array(n);
  const cycle = new Uint8Array(n);
  const phase = new Uint8Array(n);
  const speed = new Float32Array(n);
  const bias = new Float32Array(n);

  let maxSegments = 0;

  const pitch = (CAM_PITCH_DEG * Math.PI) / 180;
  const sinP = Math.sin(pitch);
  const cosP = Math.cos(pitch);
  const depthRatio = SEED_DEPTH_FAR / SEED_DEPTH_NEAR;

  for (let i = 0; i < n; i++) {
    // Geometric in depth, which is the distribution whose density goes as
    // 1/depth. Then a world x inside the frustum's half-width at that depth.
    const depth = SEED_DEPTH_NEAR * depthRatio ** rand();
    const halfWidth = depth * CAMERA.tanHalfH + SEED_X_MARGIN;
    seedZ[i] = -(depth - CAM_Y * sinP) / cosP;
    seedX[i] = lerp(-halfWidth, halfWidth, rand());

    const c = CYCLE_LENGTHS[(rand() * CYCLE_LENGTHS.length) | 0];
    cycle[i] = c;
    phase[i] = (rand() * c) | 0;

    // Trail length varies from short ticks to long ribbons, but always stops a
    // few steps short of the life length — a particle whose trail is as long as
    // its life spends the whole life growing one and never settles.
    const want = Math.round(lerp(TRAIL_MIN, TRAIL_MAX, rand() ** 1.35));
    const t = Math.max(4, Math.min(want, c - 6));
    trail[i] = t;
    maxSegments += t;

    speed[i] = lerp(SPEED_MIN, SPEED_MAX, rand());

    // Skewed low so most particles sit dim and only a few percent are ever hot.
    bias[i] = rand() ** 3;
  }

  return { seedX, seedZ, trail, cycle, phase, speed, bias, count: n, maxSegments };
};
