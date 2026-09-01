/**
 * radialPlaces — scatter N items around a centre with angle AND radius jitter.
 *
 * WHAT: Returns N positions around a point. Each item starts at an evenly
 * spaced ideal angle, then both its angle and its radius are perturbed by a
 * seeded amount.
 *
 * WHY: Regular angular spacing produces a rosette that reads as a flower or a
 * wheel — the eye locks onto the symmetry immediately and the result stops
 * looking like a natural distribution. Jittering the angle alone is not enough:
 * items still sit on a perfect circle and read as a dial or a clock face. Both
 * axes must move. `radiusJitter` defaults to a non-zero value for exactly this
 * reason; setting it to 0 gives you back the wheel.
 *
 * PARAMETERS
 *   count         How many positions to produce.
 *   cx, cy        Centre of the distribution.
 *   radius        Mean radius from the centre.
 *   angleJitter   Angular perturbation as a fraction of the gap between two
 *                 neighbouring ideal angles. 0 = perfectly regular spokes,
 *                 1 = an item may travel a full slot either way. Default 0.26,
 *                 the value used by the particle-burst project.
 *   radiusJitter  Radial perturbation as a fraction of `radius`. 0 = all items
 *                 on an exact circle. Default 0.18.
 *   startAngle    Angle of the first ideal slot, in radians. Default -PI/2, so
 *                 item 0 sits at twelve o'clock.
 *   spread        Total angle covered, in radians. Default TAU (a full ring);
 *                 pass a smaller value for a fan or an arc.
 *   rng           Seeded generator. Required — there is no internal default,
 *                 because a component that seeds itself cannot be made
 *                 deterministic by its caller.
 *
 * RETURNS an array of { x, y, angle, radius, index }. `angle` and `radius` are
 * the post-jitter values, so a caller can orient a sprite along its own spoke
 * without recomputing them.
 *
 * EXAMPLE
 *   const rng = mulberry32(seedFrom(random('burst')));
 *   for (const p of radialPlaces({ count: 24, cx: 960, cy: 540, radius: 300, rng })) {
 *     ctx.beginPath();
 *     ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
 *     ctx.fill();
 *   }
 */
import type { Rng } from '../types';

const TAU = Math.PI * 2;

export type RadialPlace = {
  x: number;
  y: number;
  /** Final angle in radians, after jitter. */
  angle: number;
  /** Final distance from the centre, after jitter. */
  radius: number;
  /** Position in the output array, so callers can stagger by index. */
  index: number;
};

export type RadialPlacesOptions = {
  count: number;
  cx: number;
  cy: number;
  radius: number;
  rng: Rng;
  angleJitter?: number;
  radiusJitter?: number;
  startAngle?: number;
  spread?: number;
};

export const radialPlaces = ({
  count,
  cx,
  cy,
  radius,
  rng,
  angleJitter = 0.26,
  radiusJitter = 0.18,
  startAngle = -Math.PI / 2,
  spread = TAU,
}: RadialPlacesOptions): RadialPlace[] => {
  if (count <= 0) return [];

  // A full ring wraps, so N items occupy N slots. A partial fan does not, so
  // N items span N-1 gaps and the last one lands exactly on the end angle.
  const wraps = Math.abs(spread - TAU) < 1e-9;
  const slot = wraps ? spread / count : spread / Math.max(1, count - 1);

  const out: RadialPlace[] = [];
  for (let i = 0; i < count; i++) {
    // Both draws happen for every item whatever the jitter values, so changing
    // a jitter amount rescales the existing layout instead of resequencing the
    // generator and reshuffling every position.
    const aDraw = rng() * 2 - 1;
    const rDraw = rng() * 2 - 1;

    const angle = startAngle + i * slot + aDraw * angleJitter * slot;
    const r = radius * (1 + rDraw * radiusJitter);

    out.push({
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      angle,
      radius: r,
      index: i,
    });
  }
  return out;
};
