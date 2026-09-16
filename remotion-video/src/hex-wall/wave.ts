/**
 * The motion of the wall: concentric pulses that start at the centre and
 * travel outwards, lifting every hexagon they pass and letting it settle
 * back down behind them.
 *
 * Everything here is a pure function of (radius, seconds) so a frame can be
 * rendered in isolation - which is exactly how Remotion renders.
 */

import { MAX_EXTRUSION } from "./constants";

export type Pulse = {
  /** Seconds at which the wave front leaves the centre. */
  readonly start: number;
  /** World units per second the front travels. */
  readonly speed: number;
  /** Half-width of the raised ring, in world units. */
  readonly sigma: number;
  /** Peak extrusion of this pulse, relative to MAX_EXTRUSION. */
  readonly strength: number;
  /** Seconds the pulse takes to reach full strength. */
  readonly attack: number;
  /** Seconds over which the pulse dies away once it reaches the rim. */
  readonly release: number;
};

/** Largest radius a tile can sit at, used to work out when a pulse is done. */
export const MAX_RADIUS = 32;

/**
 * Three pulses, matching the cadence of the reference: one just after the
 * start, one around a third in, one around two thirds in, each fully settled
 * before the next begins.
 */
export const PULSES: readonly Pulse[] = [
  {
    start: 0.3,
    speed: 11.6,
    sigma: 4.3,
    strength: 1,
    attack: 0.45,
    release: 0.75,
  },
  {
    start: 3.2,
    speed: 11.2,
    sigma: 4.6,
    strength: 1,
    attack: 0.5,
    release: 0.8,
  },
  {
    start: 6.05,
    speed: 11.4,
    sigma: 4.4,
    strength: 1,
    attack: 0.45,
    release: 0.75,
  },
];

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** Seconds from `start` until the ring has travelled past the far corner. */
const lifetime = (pulse: Pulse) =>
  (MAX_RADIUS + pulse.sigma * 2) / pulse.speed + pulse.release;

/** Normalised height (0..1) contributed by a single pulse at radius `r`. */
const pulseHeight = (pulse: Pulse, r: number, seconds: number) => {
  const local = seconds - pulse.start;
  const life = lifetime(pulse);
  if (local <= 0 || local >= life) {
    return 0;
  }

  const front = local * pulse.speed;
  const offset = (r - front) / pulse.sigma;
  // A super-Gaussian rather than a plain bell: the tiles the front is
  // passing sit at full height together and the band has crisp edges,
  // which is what makes the ring read as tiles instead of a blur.
  const ring = Math.exp(-(offset * offset) * (offset * offset));

  const attack = smoothstep(0, pulse.attack, local);
  const release = 1 - smoothstep(life - pulse.release, life, local);

  return ring * attack * release * pulse.strength;
};

/**
 * Height of a tile in world units.
 *
 * `jitter` (0..1) is a per-tile constant that breaks up the perfectly round
 * wave front so the ring edge reads as tiles rather than as a circle.
 */
export const tileHeight = (
  r: number,
  seconds: number,
  jitter: number,
  pulses: readonly Pulse[] = PULSES,
) => {
  const radius = r + (jitter - 0.5) * 1.15;
  let height = 0;
  for (const pulse of pulses) {
    height += pulseHeight(pulse, radius, seconds);
  }
  const scale = 0.9 + jitter * 0.2;
  return Math.min(1, height) * MAX_EXTRUSION * scale;
};
