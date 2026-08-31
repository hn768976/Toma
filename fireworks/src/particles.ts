import {BURST_TYPES, GRAVITY, dragSum} from './physics';
import {randBool, randRange} from './rng';
import type {Burst} from './schedule';
import type {VariantConfig} from './variants';

export type Particle = {
  /** Initial velocity in px/frame, radial plus any inherited drift. */
  readonly vx: number;
  readonly vy: number;
  readonly drag: number;
  readonly gravity: number;
  readonly life: number;
  readonly size: number;
  /** Index into the variant palette's burst colours. */
  readonly colorIndex: number;
  readonly sparkle: boolean;
  readonly phase: number;
  /** Position along the axis pointing at the camera, -1 (far) to 1 (near). */
  readonly depth: number;
  readonly decay: number;
};

const clamp = (v: number, min: number, max: number) =>
  v < min ? min : v > max ? max : v;

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

const cache = new Map<string, Particle[]>();
const CACHE_LIMIT = 240;

/**
 * A burst's particle set is built once, the first frame the burst is on screen,
 * and reused for every later frame of its life.
 */
export const getBurstParticles = (
  burst: Burst,
  variant: VariantConfig,
): Particle[] => {
  const cached = cache.get(burst.id);
  if (cached) {
    return cached;
  }
  const particles = buildParticles(burst, variant);
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) {
      cache.delete(oldest);
    }
  }
  cache.set(burst.id, particles);
  return particles;
};

const buildParticles = (burst: Burst, variant: VariantConfig): Particle[] => {
  const spec = BURST_TYPES[burst.type];
  const count = Math.max(
    24,
    Math.round(spec.count * variant.density * burst.scale),
  );
  const particles: Particle[] = new Array(count);

  // A ring is a flat disc of directions, so it needs a plane: how far it is
  // tilted away from the camera, and how far it is rolled in frame.
  const tilt = randRange(burst.id + ':tilt', 0.16, 0.46);
  const roll = randRange(burst.id + ':roll', -0.5, 0.5);
  const cosRoll = Math.cos(roll);
  const sinRoll = Math.sin(roll);

  for (let i = 0; i < count; i++) {
    const seed = burst.id + ':p' + i;
    let dx: number;
    let dy: number;
    let depth: number;

    if (spec.shape === 'disc') {
      const a = randRange(seed + ':a', 0, Math.PI * 2);
      const thickness = randRange(seed + ':t', -0.05, 0.05);
      const px = Math.cos(a) + thickness * Math.sin(a);
      const py = Math.sin(a) * tilt;
      dx = px * cosRoll - py * sinRoll;
      dy = px * sinRoll + py * cosRoll;
      depth = Math.sin(a) * Math.sqrt(Math.max(0, 1 - tilt * tilt));
    } else {
      // Uniform on the unit sphere. Projected to the screen this piles
      // particles up at the rim, which is what gives a real shell its clean
      // bright leading edge.
      const u = randRange(seed + ':u', -1, 1);
      const phi = randRange(seed + ':phi', 0, Math.PI * 2);
      const r = Math.sqrt(Math.max(0, 1 - u * u));
      dx = r * Math.cos(phi);
      dy = u;
      depth = r * Math.sin(phi);
    }

    const speed =
      spec.speed *
      burst.scale *
      (1 + spec.speedJitter * randRange(seed + ':s', -1, 1));
    const near = depth * 0.5 + 0.5;

    particles[i] = {
      vx: dx * speed + burst.vx,
      vy: dy * speed + burst.vy,
      drag: spec.drag,
      gravity: GRAVITY * spec.gravity,
      life: Math.round(
        randRange(seed + ':l', spec.life[0], spec.life[1]) * burst.lifeScale,
      ),
      size: spec.size * burst.scale * (0.7 + 0.5 * near),
      colorIndex: randBool(seed + ':c', burst.altRate)
        ? burst.altColorIndex
        : burst.colorIndex,
      sparkle: randBool(seed + ':k', spec.sparkleRate),
      phase: randRange(seed + ':ph', 0, Math.PI * 2),
      depth,
      decay: spec.decay,
    };
  }
  return particles;
};

/** Where a particle is, `age` frames after its burst broke. */
export const positionAt = (
  burst: Burst,
  p: Particle,
  age: number,
): {x: number; y: number} => {
  const n = age < 0 ? 0 : age;
  const s = dragSum(p.drag, n);
  return {
    x: burst.x + p.vx * s,
    y: burst.y + p.vy * s + (p.gravity * (n - s)) / (1 - p.drag),
  };
};

/** A particle's velocity `age` frames after its burst broke. */
export const velocityAt = (
  p: Particle,
  age: number,
): {vx: number; vy: number} => {
  const n = age < 0 ? 0 : age;
  const d = Math.pow(p.drag, n);
  return {
    vx: p.vx * d,
    vy: p.vy * d + p.gravity * dragSum(p.drag, n),
  };
};

/**
 * The rapid, irregular flicker of the quarter of particles that crackle. Two
 * incommensurate sines gate a hard on/off, which reads as sparkle rather than
 * as a pulse.
 */
const flicker = (age: number, phase: number): number => {
  const s =
    Math.sin(age * 2.87 + phase) * Math.sin(age * 1.13 + phase * 1.7) +
    0.4 * Math.sin(age * 5.31 + phase * 0.6);
  return s > 0.04 ? 1 : 0.14;
};

/** 0..1+ brightness of a particle, before the variant's global multiplier. */
export const brightnessAt = (p: Particle, age: number): number => {
  if (age < 0 || age > p.life) {
    return 0;
  }
  const u = age / p.life;
  let b = Math.pow(1 - u, p.decay);
  // Detonation: the first frames are far brighter than the rest of the life.
  b *= 1 + 2 * Math.exp(-age / 1.7);
  // Particles on the far side of the sphere sit behind the smoke, so they read
  // dimmer than the ones coming at the camera.
  b *= 0.62 + 0.38 * (p.depth * 0.5 + 0.5);
  if (p.sparkle) {
    const ramp = smoothstep(0.16, 0.42, u);
    b *= 1 - ramp * (1 - flicker(age, p.phase));
  }
  return b;
};

/** How far a particle has cooled towards ember colour, 0..1. */
export const emberMixAt = (p: Particle, age: number): number => {
  const u = clamp(age / p.life, 0, 1);
  return Math.pow(u, 1.2) * 0.72;
};
