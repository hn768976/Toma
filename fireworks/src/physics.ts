import type {BurstTypeName} from './variants';

/**
 * The physics every burst particle obeys, and the per-type parameters that make
 * a peony read differently from a willow.
 *
 * A particle is launched radially at a near-uniform speed, loses speed to drag
 * every frame, and gains downward speed from gravity every frame:
 *
 *   v(n+1) = v(n) * drag + g
 *
 * which has a closed form, so any frame — including the three earlier frames a
 * trail is sampled at — costs the same as any other.
 */

/** Downward acceleration in canvas pixels per frame squared, at 4K. */
export const GRAVITY = 0.85;

export type BurstTypeSpec = {
  /** Particles in the burst before the variant's density multiplier. */
  readonly count: number;
  /** Initial radial speed in px/frame. */
  readonly speed: number;
  /** Fraction of the speed that varies particle to particle. Kept small: a
   * real shell bursts with one charge, so the leading edge stays clean. */
  readonly speedJitter: number;
  /** Velocity retained each frame. Lower drag = faster stop, tighter burst. */
  readonly drag: number;
  /** Multiplier on gravity — how heavily this type droops. */
  readonly gravity: number;
  /** Particle lifetime range in frames. */
  readonly life: readonly [number, number];
  /** Frames between the samples that make up a trail. */
  readonly trailSpacing: number;
  /** Trail opacity relative to the head. */
  readonly trailStrength: number;
  /** Fraction of particles that flicker as they fall. */
  readonly sparkleRate: number;
  /** Head radius in px at 4K. */
  readonly size: number;
  /** Glow radius as a multiple of the head radius. */
  readonly glow: number;
  /** Sphere = a filled shell of directions. Disc = a flat ring. */
  readonly shape: 'sphere' | 'disc';
  /** How sharply brightness decays over the particle's life. */
  readonly decay: number;
};

export const BURST_TYPES: Record<BurstTypeName, BurstTypeSpec> = {
  // The standard shell: uniform radial spread, heavy droop.
  peony: {
    count: 360,
    speed: 63,
    speedJitter: 0.06,
    drag: 0.918,
    gravity: 1,
    life: [62, 76],
    trailSpacing: 1,
    trailStrength: 0.34,
    sparkleRate: 0.25,
    size: 7,
    glow: 8,
    shape: 'sphere',
    decay: 1.35,
  },
  // As a peony, but every particle keeps a long persistent trail.
  chrysanthemum: {
    count: 330,
    speed: 58,
    speedJitter: 0.05,
    drag: 0.926,
    gravity: 1,
    life: [78, 94],
    trailSpacing: 3,
    trailStrength: 0.8,
    sparkleRate: 0.25,
    size: 6.5,
    glow: 8,
    shape: 'sphere',
    decay: 1.25,
  },
  // Slow, long lived, and it falls a very long way.
  willow: {
    count: 230,
    speed: 38,
    speedJitter: 0.05,
    drag: 0.949,
    gravity: 0.92,
    life: [104, 124],
    trailSpacing: 3,
    trailStrength: 0.7,
    sparkleRate: 0.22,
    size: 7.5,
    glow: 8,
    shape: 'sphere',
    decay: 1.1,
  },
  // Small, dense, short lived, and it crackles hard.
  crackle: {
    count: 300,
    speed: 41,
    speedJitter: 0.09,
    drag: 0.9,
    gravity: 1.05,
    life: [36, 48],
    trailSpacing: 1,
    trailStrength: 0.35,
    sparkleRate: 0.85,
    size: 5,
    glow: 7,
    shape: 'sphere',
    decay: 1.55,
  },
  // Emitted in a flat disc, so it reads as a ring seen at an angle.
  ring: {
    count: 260,
    speed: 62,
    speedJitter: 0.03,
    drag: 0.923,
    gravity: 1,
    life: [64, 80],
    trailSpacing: 2,
    trailStrength: 0.55,
    sparkleRate: 0.2,
    size: 7,
    glow: 8,
    shape: 'disc',
    decay: 1.35,
  },
};

/** Sum of drag^k for k in [0, n): how far a unit initial speed has carried. */
export const dragSum = (drag: number, n: number): number =>
  drag === 1 ? n : (1 - Math.pow(drag, n)) / (1 - drag);
