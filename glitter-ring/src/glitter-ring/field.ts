// Seeded construction of the particle field. Everything here runs once per
// seed at module scope and is cached: the render path only reads it, and no
// array is ever mutated across frames (Remotion renders frames out of order
// across threads, so per-frame state would tear the animation apart).

import {
  CLUSTER_ANGULAR_SIGMA,
  CLUSTER_COUNT,
  CLUSTER_FRACTION,
  CLUSTER_RADIAL_SIGMA,
  COLOR_BUCKETS,
  FOREGROUND_COUNT,
  BOKEH_COUNT,
  PARTICLE_MAX_SIZE,
  PARTICLE_MIN_SIZE,
  RING_BAND_SIGMA,
  RING_PARTICLE_COUNT,
  RING_STRAY_FRACTION,
  RING_STRAY_SIGMA,
  SOFTNESS_LEVELS,
  SPARKLE_FRACTION,
  SPARKLE_MAX_FRAMES,
  SPARKLE_MIN_FRAMES,
  SPARKLE_PERIOD_CHOICES,
  WOBBLE_CYCLE_CHOICES,
  WOBBLE_MAX_AMPLITUDE,
} from "./constants";
import { gaussianish, hashSeed, lerp, mulberry32 } from "./random";

export type RingParticle = {
  angle: number; // start angle in radians
  radialOffset: number; // signed distance from the ring path, height fractions
  shear: number; // how far this particle leads/lags over the loop, radians
  size: number; // height fractions
  softness: number; // 0 = hard dot, 1 = heavily blurred
  softnessLevel: number; // sprite atlas row
  colorBucket: number; // sprite atlas column
  brightness: number;
  twinkleAmount: number;
  twinkleCycles: number;
  twinklePhase: number;
  wobbleAmplitude: number;
  wobbleCycles: number;
  wobblePhase: number;
  sparklePeriod: number; // 0 = never sparkles
  sparkleOffset: number;
  sparkleFrames: number;
};

export type BokehDisc = {
  x: number; // fractions of width
  y: number; // fractions of height
  radius: number; // fractions of height
  alpha: number;
  driftX: number;
  driftY: number;
  cyclesX: number;
  cyclesY: number;
  phaseX: number;
  phaseY: number;
  tint: number; // 0..1 blend toward the bright end of the palette
};

export type ForegroundParticle = BokehDisc;

export type ParticleField = {
  ring: RingParticle[];
  bokeh: BokehDisc[];
  foreground: ForegroundParticle[];
};

const pick = <T,>(rand: () => number, values: T[]): T =>
  values[Math.floor(rand() * values.length) % values.length];

const buildRing = (rand: () => number): RingParticle[] => {
  // Angular clumps, each with its own slight inward/outward bias, so the ring
  // has dense knots and thin stretches rather than an even dotted circle.
  const clusters = Array.from({ length: CLUSTER_COUNT }, (_, i) => ({
    angle: (i / CLUSTER_COUNT) * Math.PI * 2 + (rand() - 0.5) * 0.35,
    radialBias: gaussianish(rand) * CLUSTER_RADIAL_SIGMA,
    spread: CLUSTER_ANGULAR_SIGMA * (0.8 + rand() * 1.2),
  }));

  const particles: RingParticle[] = [];
  for (let i = 0; i < RING_PARTICLE_COUNT; i++) {
    const cluster =
      rand() < CLUSTER_FRACTION
        ? clusters[Math.floor(rand() * CLUSTER_COUNT) % CLUSTER_COUNT]
        : null;
    const angle = cluster
      ? cluster.angle + gaussianish(rand) * cluster.spread
      : rand() * Math.PI * 2;
    // Radial scatter: a dense core on the path plus a minority of strays that
    // give the ring wispy inner and outer edges.
    const isStray = rand() < RING_STRAY_FRACTION;
    const sigma = isStray ? RING_STRAY_SIGMA : RING_BAND_SIGMA;
    const radialOffset =
      gaussianish(rand) * sigma + (cluster ? cluster.radialBias : 0);

    // Faked depth drives size, brightness, blur and colour together.
    const depth = Math.pow(rand(), 1.8);
    const size = lerp(PARTICLE_MIN_SIZE, PARTICLE_MAX_SIZE, depth);
    const softness = Math.min(1, 0.1 + depth * 0.8 + rand() * 0.18);
    const brightness = Math.min(
      1.15,
      lerp(0.5, 1, depth) * (0.75 + rand() * 0.5),
    );
    const colorT = Math.min(
      1,
      Math.max(0, 0.85 - depth * 0.75 + (rand() - 0.5) * 0.3),
    );

    const sparkles = rand() < SPARKLE_FRACTION;

    particles.push({
      angle,
      radialOffset,
      // Inner particles lead and then fall back; outer ones do the opposite.
      shear: -(radialOffset / RING_BAND_SIGMA) * (0.6 + rand() * 0.8),
      size,
      softness,
      softnessLevel: Math.min(
        SOFTNESS_LEVELS - 1,
        Math.floor(softness * SOFTNESS_LEVELS),
      ),
      colorBucket: Math.min(
        COLOR_BUCKETS - 1,
        Math.floor(colorT * COLOR_BUCKETS),
      ),
      brightness,
      twinkleAmount: 0.15 + rand() * 0.4,
      twinkleCycles: Math.floor(2 + rand() * 6), // whole cycles per loop
      twinklePhase: rand() * Math.PI * 2,
      wobbleAmplitude: rand() * WOBBLE_MAX_AMPLITUDE,
      wobbleCycles: pick(rand, WOBBLE_CYCLE_CHOICES),
      wobblePhase: rand() * Math.PI * 2,
      sparklePeriod: sparkles ? pick(rand, SPARKLE_PERIOD_CHOICES) : 0,
      sparkleOffset: Math.floor(rand() * 600),
      sparkleFrames:
        SPARKLE_MIN_FRAMES +
        Math.floor(rand() * (SPARKLE_MAX_FRAMES - SPARKLE_MIN_FRAMES + 1)),
    });
  }

  // Batch by depth bucket, then colour bucket: sorting once here means the
  // draw loop walks contiguous runs of the same cached sprite.
  particles.sort(
    (a, b) =>
      a.softnessLevel - b.softnessLevel || a.colorBucket - b.colorBucket,
  );
  return particles;
};

const buildBokeh = (rand: () => number): BokehDisc[] => {
  const discs: BokehDisc[] = [];
  for (let i = 0; i < BOKEH_COUNT; i++) {
    discs.push({
      x: -0.1 + rand() * 1.2,
      y: -0.1 + rand() * 1.2,
      radius: 0.05 + Math.pow(rand(), 1.4) * 0.18,
      alpha: 0.05 + rand() * 0.11,
      driftX: 0.008 + rand() * 0.035,
      driftY: 0.008 + rand() * 0.03,
      cyclesX: 1,
      cyclesY: rand() < 0.5 ? 1 : 2,
      phaseX: rand() * Math.PI * 2,
      phaseY: rand() * Math.PI * 2,
      tint: rand(),
    });
  }
  return discs;
};

// Big, very blurred, dim discs crossing in front of everything. Held to the
// left and right edges so nothing ever drifts across the empty centre.
const buildForeground = (rand: () => number): ForegroundParticle[] => {
  const discs: ForegroundParticle[] = [];
  for (let i = 0; i < FOREGROUND_COUNT; i++) {
    const onLeft = i % 2 === 0;
    const x = onLeft ? -0.04 + rand() * 0.2 : 0.84 + rand() * 0.2;
    discs.push({
      x,
      y: -0.05 + rand() * 1.1,
      radius: 0.04 + rand() * 0.09,
      alpha: 0.035 + rand() * 0.055,
      driftX: 0.006 + rand() * 0.014,
      driftY: 0.01 + rand() * 0.03,
      cyclesX: 1,
      cyclesY: 1,
      phaseX: rand() * Math.PI * 2,
      phaseY: rand() * Math.PI * 2,
      tint: 0.3 + rand() * 0.7,
    });
  }
  return discs;
};

const cache = new Map<string, ParticleField>();

export const getParticleField = (seed: string): ParticleField => {
  const cached = cache.get(seed);
  if (cached) {
    return cached;
  }
  const rand = mulberry32(hashSeed(seed));
  const field: ParticleField = {
    ring: buildRing(rand),
    bokeh: buildBokeh(rand),
    foreground: buildForeground(rand),
  };
  cache.set(seed, field);
  return field;
};
