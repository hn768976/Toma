import {
  BUCKET_CYCLE,
  DEPTH_BUCKETS,
  DEPTH_FLOOR,
  DEPTH_PEAK,
  DEPTH_PEAK_WIDTH,
  DURATION_IN_FRAMES,
  HORIZONTAL_FADE_FLOOR,
  HORIZONTAL_FADE_WIDTH,
  PARTICLE_COUNT,
  PARTICLE_GAIN,
  SIZE_FAR,
  SIZE_JITTER,
  SIZE_NEAR,
  SPARKLE_DEPTH_RANGE,
  SPARKLE_DURATIONS,
  SPARKLE_PERIODS,
  SPARKLE_SHARE,
  TRAVEL_JITTER,
  TRAVEL_MARGIN,
  VERTICAL_FADE_FLOOR,
  VERTICAL_FADE_POWER,
  WANDER_AMP_1,
  WANDER_AMP_2,
  WANDER_TIME_HARMONICS_1,
  WANDER_TIME_HARMONICS_2,
  WANDER_VERTICAL_RATIO,
  WANDER_WAVELENGTH_1,
  WANDER_WAVELENGTH_2,
} from "./constants";
import { COLOR_BUCKETS } from "./palette";
import { clamp, mulberry32, pick, range } from "./random";

export type Particle = {
  bucket: number;
  depth: number;
  /** Horizontal seed position, 0-1 of frame width. */
  seedX: number;
  /** Diameter as a fraction of frame height. */
  size: number;
  /** Frames for one bottom-to-top traversal; divides the loop length. */
  cycle: number;
  /** Where in its cycle this particle starts, in frames. */
  phaseOffset: number;
  /** Travel distance as a fraction of frame height. */
  travel: number;
  /** Peak brightness before the vertical/horizontal falloffs. */
  luminance: number;
  colorIndex: number;
  // Two-octave periodic wander.
  amp1: number;
  amp2: number;
  timeHarmonic1: number;
  timeHarmonic2: number;
  waveLength1: number;
  waveLength2: number;
  wanderPhase1: number;
  wanderPhase2: number;
  // Sparkle schedule. period === 0 means this particle never sparkles.
  sparklePeriod: number;
  sparkleOffset: number;
  sparkleDuration: number;
};

// Brightness by depth: dim near, brightest just past the middle (the
// sharp band), dim far.
const depthLuminance = (depth: number) => {
  const t = (depth - DEPTH_PEAK) / DEPTH_PEAK_WIDTH;
  return DEPTH_FLOOR + (1 - DEPTH_FLOOR) * Math.exp(-t * t);
};

const buildParticle = (index: number): Particle => {
  const rand = mulberry32(index * 2654435761 + 12345);

  const bucket = index % DEPTH_BUCKETS;
  const depth = (bucket + rand()) / DEPTH_BUCKETS;

  // Bias horizontal placement toward the centre so the field sits under
  // the glow, but keep a uniform tail so the edges are not empty.
  const centred = rand() < 0.62;
  const seedX = centred
    ? clamp(0.5 + (rand() + rand() + rand() - 1.5) * 0.42, -0.05, 1.05)
    : range(rand, -0.05, 1.05);

  const size =
    SIZE_NEAR *
    Math.pow(SIZE_FAR / SIZE_NEAR, depth) *
    range(rand, SIZE_JITTER[0], SIZE_JITTER[1]);

  const cycle = BUCKET_CYCLE[bucket];
  const travel =
    (1 + 2 * TRAVEL_MARGIN) * range(rand, TRAVEL_JITTER[0], TRAVEL_JITTER[1]);

  const luminance = clamp(depthLuminance(depth) * range(rand, 0.8, 1.2));
  const colorIndex = Math.min(
    COLOR_BUCKETS - 1,
    Math.max(0, Math.round((1 - luminance) * (COLOR_BUCKETS - 1))),
  );

  const sparkles =
    rand() < SPARKLE_SHARE &&
    depth >= SPARKLE_DEPTH_RANGE[0] &&
    depth <= SPARKLE_DEPTH_RANGE[1];

  return {
    bucket,
    depth,
    seedX,
    size,
    cycle,
    phaseOffset: Math.floor(rand() * cycle),
    travel,
    luminance,
    colorIndex,
    amp1: range(rand, WANDER_AMP_1[0], WANDER_AMP_1[1]),
    amp2: range(rand, WANDER_AMP_2[0], WANDER_AMP_2[1]),
    timeHarmonic1: pick(rand, WANDER_TIME_HARMONICS_1),
    timeHarmonic2: pick(rand, WANDER_TIME_HARMONICS_2),
    waveLength1: range(rand, WANDER_WAVELENGTH_1[0], WANDER_WAVELENGTH_1[1]),
    waveLength2: range(rand, WANDER_WAVELENGTH_2[0], WANDER_WAVELENGTH_2[1]),
    wanderPhase1: rand() * Math.PI * 2,
    wanderPhase2: rand() * Math.PI * 2,
    sparklePeriod: sparkles ? pick(rand, SPARKLE_PERIODS) : 0,
    sparkleOffset: sparkles ? Math.floor(rand() * 600) : 0,
    sparkleDuration: pick(rand, SPARKLE_DURATIONS),
  };
};

// The field is built once at module level and never mutated. Positions
// are derived from (particle, frame), so frames rendered out of order
// across threads stay consistent and the loop closes exactly.
export const FIELD: readonly Particle[] = Array.from(
  { length: PARTICLE_COUNT },
  (_unused, index) => buildParticle(index),
);

export type ParticleSample = {
  /** Pixels. */
  x: number;
  y: number;
  /** Diameter, pixels. */
  size: number;
  alpha: number;
  /** 0 when not flashing, otherwise the flash envelope 0-1. */
  sparkle: number;
};

/**
 * Evaluates one particle at one frame. Pure — depends only on the
 * particle's seed values and the frame number.
 */
export const sampleParticle = (
  particle: Particle,
  frame: number,
  width: number,
  height: number,
): ParticleSample => {
  // Position along this particle's own cycle, 0 at the bottom.
  const phase =
    ((frame + particle.phaseOffset) % particle.cycle) / particle.cycle;

  // Height fraction from the top of the frame: 1 is the bottom edge, 0
  // the top. The margins at either end keep the particle off-frame when
  // it recycles, so the reset is never visible.
  const yNorm = 1 + TRAVEL_MARGIN - phase * particle.travel;

  // Time sampled on a circle so the turbulence field itself repeats.
  const tau = (2 * Math.PI * frame) / DURATION_IN_FRAMES;
  const w1 =
    particle.wanderPhase1 +
    particle.timeHarmonic1 * tau +
    yNorm * particle.waveLength1 * Math.PI * 2;
  const w2 =
    particle.wanderPhase2 +
    particle.timeHarmonic2 * tau +
    yNorm * particle.waveLength2 * Math.PI * 2;

  const dx = particle.amp1 * Math.sin(w1) + particle.amp2 * Math.sin(w2);
  // Vertical wander reuses the same harmonics (integer multiples of the
  // loop) so it stays periodic — a fractional multiplier here would
  // quietly break the loop.
  const dy =
    WANDER_VERTICAL_RATIO *
    (particle.amp1 * Math.cos(w1) + particle.amp2 * Math.cos(w2));

  const x = particle.seedX * width + dx * height;
  const y = (yNorm + dy) * height;

  // Density falls off upward and, more gently, toward the sides.
  const verticalFade =
    VERTICAL_FADE_FLOOR +
    (1 - VERTICAL_FADE_FLOOR) *
      Math.pow(clamp(yNorm), VERTICAL_FADE_POWER);
  const xNorm = x / width - 0.5;
  const horizontalFade =
    HORIZONTAL_FADE_FLOOR +
    (1 - HORIZONTAL_FADE_FLOOR) *
      Math.exp(-Math.pow(xNorm / HORIZONTAL_FADE_WIDTH, 2));

  return {
    x,
    y,
    size: particle.size * height,
    alpha: clamp(
      particle.luminance * verticalFade * horizontalFade * PARTICLE_GAIN,
    ),
    sparkle: sparkleEnvelope(particle, frame),
  };
};

// A short flash: quick rise, brief hold, fade back. Staggered by
// sparkleOffset so a few are always firing somewhere in frame.
const sparkleEnvelope = (particle: Particle, frame: number) => {
  if (particle.sparklePeriod === 0) {
    return 0;
  }
  const t = (frame + particle.sparkleOffset) % particle.sparklePeriod;
  if (t >= particle.sparkleDuration) {
    return 0;
  }
  const u = (t + 0.5) / particle.sparkleDuration;
  return Math.pow(Math.sin(Math.PI * u), 0.55);
};
