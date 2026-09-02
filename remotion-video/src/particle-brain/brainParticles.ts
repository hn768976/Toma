/**
 * Sampling the brain, and the signal pulses that cross it.
 *
 * Density is weighted by two things at once: proximity to the outer
 * silhouette, and proximity to the gyral guide curves. That dual
 * weighting is what makes the folds readable — the flat sheets between
 * convolutions thin out to a floor density while the outline and the
 * folds crowd, so the structure appears without a single line being
 * drawn. The same weight also drives particle size and brightness, which
 * roughly doubles the contrast the folds get.
 */
import type { SampledPoint } from "../lib/maskSampler";
import { sampleFromMask } from "../lib/maskSampler";
import { buildParticleField, type FieldParticle, type PulseFn } from "../lib/particleField";
import { pulseBand } from "../lib/loopMath";
import type { BrainGeometry } from "./brainShape";
import {
  BRAIN_GRID,
  BRAIN_PARTICLE_COUNT,
  BRAIN_PARTICLE_MAX_SIZE,
  BRAIN_PARTICLE_MIN_SIZE,
  CHURN_FRACTION,
  EDGE_FALLOFF,
  EDGE_WEIGHT,
  FLAT_WEIGHT,
  FREE_PARTICLE_FRACTION,
  FREE_PARTICLE_REACH,
  GYRI_WEIGHT,
  ORBIT_MAX_RADIUS,
  ORBIT_MIN_RADIUS,
  ORBIT_PERIODS,
  PULSES,
  PULSE_DISPLACEMENT,
  PULSE_TAIL,
  TWINKLE_MAX_AMP,
  TWINKLE_MIN_AMP,
  TWINKLE_PERIODS,
} from "./config";

/** Acceptance weight inside the silhouette: outline + gyri, over a floor. */
const interiorWeight = (g: BrainGeometry) => (_x: number, _y: number, i: number): number => {
  // distIn is already in frame pixels, so EDGE_FALLOFF is used as-is.
  const edge = Math.exp(-g.distIn[i] / EDGE_FALLOFF);
  return Math.min(1, FLAT_WEIGHT + EDGE_WEIGHT * edge + GYRI_WEIGHT * g.gyriField[i]);
};

/** The ~3% that sit just outside the silhouette, drifting free. */
const exteriorWeight = (g: BrainGeometry) => (_x: number, _y: number, i: number): number => {
  const d = g.distOut[i];
  if (d <= 0 || d > FREE_PARTICLE_REACH) return 0;
  return 0.85 * Math.exp(-d / (FREE_PARTICLE_REACH * 0.42));
};

const samplePoints = (
  g: BrainGeometry,
  count: number,
  seed: string,
  inside: boolean,
): SampledPoint[] =>
  sampleFromMask({
    mask: g.mask,
    count,
    grid: BRAIN_GRID,
    seed,
    inside,
    weightAt: inside ? interiorWeight(g) : exteriorWeight(g),
    maxAttempts: count * 90,
  });

export const buildBrainField = (g: BrainGeometry, seed: string): FieldParticle[] => {
  const freeCount = Math.round(BRAIN_PARTICLE_COUNT * FREE_PARTICLE_FRACTION);
  const bodyCount = BRAIN_PARTICLE_COUNT - freeCount;

  const body = samplePoints(g, bodyCount, seed + ":body", true);
  const free = samplePoints(g, freeCount, seed + ":free", false);
  // Alternate homes for the churning minority, drawn from the same domain.
  const churn = samplePoints(
    g,
    Math.ceil(bodyCount * CHURN_FRACTION) + 8,
    seed + ":churn",
    true,
  );

  const common = {
    originX: g.originX,
    originY: g.originY,
    twinklePeriods: TWINKLE_PERIODS,
    twinkleMinAmp: TWINKLE_MIN_AMP,
    twinkleMaxAmp: TWINKLE_MAX_AMP,
    orbitPeriods: ORBIT_PERIODS,
  };

  const bodyField = buildParticleField(body, {
    ...common,
    seed: seed + ":body",
    sizeMin: BRAIN_PARTICLE_MIN_SIZE,
    sizeMax: BRAIN_PARTICLE_MAX_SIZE,
    orbitMinRadius: ORBIT_MIN_RADIUS,
    orbitMaxRadius: ORBIT_MAX_RADIUS,
    churnFraction: CHURN_FRACTION,
    churnPoints: churn,
  });

  // Free particles are dimmer, smaller and wander further — they read as
  // material shedding off the silhouette rather than part of it.
  const freeField = buildParticleField(free, {
    ...common,
    seed: seed + ":free",
    sizeMin: BRAIN_PARTICLE_MIN_SIZE,
    sizeMax: BRAIN_PARTICLE_MIN_SIZE + 2.5,
    brightScale: 0.62,
    orbitMinRadius: ORBIT_MAX_RADIUS * 0.8,
    orbitMaxRadius: ORBIT_MAX_RADIUS * 1.9,
  });

  return bodyField.concat(freeField);
};

type ActivePulse = {
  cos: number;
  sin: number;
  invExtent: number;
  progress: number;
  width: number;
  strength: number;
};

/**
 * Builds the pulse lookup for one frame.
 *
 * Each pulse is a narrow band travelling along its own direction; a
 * particle's boost depends on where it sits when projected onto that
 * direction, so the brightness moves across the field as a wave rather
 * than lifting the whole brain at once. The band also nudges particles a
 * few pixels along its heading, which is what sells it as something
 * passing through rather than a light turning on.
 *
 * Returns undefined when no pulse is active, so the draw skips the work.
 */
export const makeBrainPulse = (g: BrainGeometry, frame: number): PulseFn | undefined => {
  const active: ActivePulse[] = [];
  for (let i = 0; i < PULSES.length; i++) {
    const p = PULSES[i];
    const progress = (frame - p.start) / p.duration;
    if (progress < 0 || progress > 1) continue;
    const cos = Math.cos(p.angle);
    const sin = Math.sin(p.angle);
    const extent = (Math.abs(cos) * g.width + Math.abs(sin) * g.height) * 0.5;
    active.push({
      cos,
      sin,
      invExtent: 1 / extent,
      progress,
      width: p.width,
      strength: p.strength,
    });
  }
  if (active.length === 0) return undefined;

  const cx = g.centerX;
  const cy = g.centerY;
  return (x, y, out) => {
    for (let i = 0; i < active.length; i++) {
      const a = active[i];
      const s = ((x - cx) * a.cos + (y - cy) * a.sin) * a.invExtent;
      const b = pulseBand(s, a.progress, a.width, PULSE_TAIL) * a.strength;
      if (b <= 0.002) continue;
      out.b += b;
      out.dx += a.cos * PULSE_DISPLACEMENT * b;
      out.dy += a.sin * PULSE_DISPLACEMENT * b;
    }
    if (out.b > 1) out.b = 1;
  };
};
