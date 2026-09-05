// Ring/dot layout. Generated ONCE at module level: per frame only
// rotation, brightness and scale change.
//
// ---------------------------------------------------------------------
// Why the loop closes exactly
// ---------------------------------------------------------------------
// Each ring holds `count` dots at even angular spacing 2*PI/count. Over
// one loop the ring is rotated by `rotation = 2*PI*steps/count` — a whole
// number of its own dot spacings. So at the final frame every dot sits
// exactly where another dot of the same ring sat at frame 0.
//
// That alone is not enough: the dots also have to *look* the same. So no
// per-dot attribute is baked onto the dot. Brightness, sparkle, twinkle
// phase and angular jitter are all sampled from frame-fixed world fields
// (fields.ts) at the dot's current position, and size/radius/fade are
// constant along a ring, hence rotation-invariant. Frame 300 is therefore
// frame 0 with the dots relabelled — pixel identical.
//
// This per-ring formulation is what buys the differential rotation the
// brief asks for: each ring may turn at its own rate and still land on
// itself, so inner rings can outrun outer ones without breaking the loop.

import {
  ANGULAR_JITTER,
  ANGULAR_SPACING_RATIO,
  DOT_SIZE_MAX,
  DOT_SIZE_MIN,
  DOT_SIZE_RING_VARIATION,
  HOLE_RADIUS,
  MAIN_RADIUS,
  MAIN_RINGS,
  RADIAL_JITTER,
  ROTATION_INNER,
  ROTATION_OUTER,
  SCATTER_RADIUS,
  SCATTER_RINGS,
  SCATTER_THINNING,
  SEED_RING,
  SPARKLE_FRACTION,
  SPIRAL_TWIST,
  TAU,
} from "./constants";
import { mulberry32 } from "./random";
import { sparkleField } from "./fields";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep01 = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};

type Ring = {
  radius: number; // fraction of frame height
  count: number;
  phase: number; // base angular offset
  rotation: number; // radians turned over one full loop
  size: number; // px at 2160p
  fade: number; // brightness multiplier from the radial profile
  angularSpacing: number;
};

const MAIN_RING_SPACING = (MAIN_RADIUS - HOLE_RADIUS) / MAIN_RINGS;
const MAIN_ANGULAR_SPACING = MAIN_RING_SPACING * ANGULAR_SPACING_RATIO;

// Dot size peaks at mid-radius and tapers both inward and outward, so the
// disc fades at its rim rather than ending abruptly.
const sizeProfile = (radius: number) => {
  const u = (radius - HOLE_RADIUS) / (MAIN_RADIUS - HOLE_RADIUS);
  const rampIn = smoothstep01(u / 0.22);
  const rampOut = 1 / (1 + Math.pow(Math.max(0, u) / 0.62, 2.6));
  return rampIn * rampOut;
};

// Brightness multiplier by radius: a crisp inner edge at the hole, then a
// long decay that leaves a small residual so isolated dots carry on well
// past the disc instead of stopping dead at the rim.
const fadeProfile = (radius: number) => {
  const inner = smoothstep01((radius - HOLE_RADIUS) / 0.025);
  const outer = Math.pow(
    1 - clamp01((radius - MAIN_RADIUS * 0.58) / (SCATTER_RADIUS - MAIN_RADIUS * 0.58)),
    1.7,
  );
  return inner * (0.06 + 0.94 * outer);
};

const buildRings = (): Ring[] => {
  const rand = mulberry32(SEED_RING);
  const rings: Ring[] = [];

  const radii: number[] = [];
  for (let k = 0; k < MAIN_RINGS; k++) {
    radii.push(HOLE_RADIUS + (k + 0.5) * MAIN_RING_SPACING);
  }
  // Past the main rim the rings spread apart, thinning the field out.
  let r = MAIN_RADIUS;
  for (let j = 0; j < SCATTER_RINGS; j++) {
    const t = j / Math.max(1, SCATTER_RINGS - 1);
    r += MAIN_RING_SPACING * (1.4 + (5.1 - 1.4) * t);
    radii.push(r);
  }

  // Normalise the size profile so its peak lands exactly on DOT_SIZE_MAX.
  let peak = 0;
  for (const radius of radii) {
    peak = Math.max(peak, sizeProfile(radius));
  }

  for (let k = 0; k < radii.length; k++) {
    const baseRadius = radii[k];
    const span = clamp01(
      (baseRadius - HOLE_RADIUS) / (SCATTER_RADIUS - HOLE_RADIUS),
    );

    // Per-ring radial offset. Constant along the ring, so it is rotation
    // invariant and cannot disturb the loop, while still breaking the
    // regular radial spacing that causes moire at 4K.
    const radius =
      baseRadius + (rand() - 0.5) * 2 * RADIAL_JITTER * MAIN_RING_SPACING;

    // Angular spacing stays roughly even through the main disc, then
    // stretches across the scatter band.
    const thinning =
      baseRadius <= MAIN_RADIUS
        ? 1
        : 1 +
          (SCATTER_THINNING - 1) *
            clamp01(
              (baseRadius - MAIN_RADIUS) / (SCATTER_RADIUS - MAIN_RADIUS),
            );
    const angularSpacing = MAIN_ANGULAR_SPACING * thinning;
    const count = Math.max(24, Math.round((TAU * radius) / angularSpacing));

    // Progressive phase offset with radius: the dots line up into faint
    // spiral arms instead of perfect radial spokes.
    const phase = SPIRAL_TWIST * span + rand() * TAU;

    // Snap this ring's rotation to a whole number of its own dot
    // spacings — the loop-closure condition.
    const target = ROTATION_INNER + (ROTATION_OUTER - ROTATION_INNER) * span;
    const steps = Math.max(1, Math.round((target * count) / TAU));
    const rotation = (TAU * steps) / count;

    const sizeVariation =
      1 + (rand() - 0.5) * 2 * DOT_SIZE_RING_VARIATION;
    const size =
      (DOT_SIZE_MIN +
        (DOT_SIZE_MAX - DOT_SIZE_MIN) * Math.pow(sizeProfile(radius) / peak, 0.55)) *
      sizeVariation;

    rings.push({
      radius,
      count,
      phase,
      rotation,
      size,
      fade: fadeProfile(radius),
      angularSpacing: TAU / count,
    });
  }

  return rings;
};

export type DotLayout = {
  count: number;
  /** Base angle before rotation. */
  angle: Float32Array;
  /** Radius as a fraction of frame height. */
  radius: Float32Array;
  /** Normalised radius, for sampling the world fields. */
  radiusNorm: Float32Array;
  /** Radians this dot turns over one full loop. */
  rotation: Float32Array;
  /** Dot side length in px at 2160p. */
  size: Float32Array;
  /** Radial brightness profile multiplier. */
  fade: Float32Array;
  /** Peak angular jitter for this dot, in radians. */
  jitter: Float32Array;
  /** Field value above which a dot carries a sparkle. */
  sparkleThreshold: number;
};

const buildLayout = (): DotLayout => {
  const rings = buildRings();
  let total = 0;
  for (const ring of rings) {
    total += ring.count;
  }

  const angle = new Float32Array(total);
  const radius = new Float32Array(total);
  const radiusNorm = new Float32Array(total);
  const rotation = new Float32Array(total);
  const size = new Float32Array(total);
  const fade = new Float32Array(total);
  const jitter = new Float32Array(total);

  let i = 0;
  for (const ring of rings) {
    const rn = clamp01(
      (ring.radius - HOLE_RADIUS) / (SCATTER_RADIUS - HOLE_RADIUS),
    );
    const jitterAmount = ANGULAR_JITTER * ring.angularSpacing;
    for (let j = 0; j < ring.count; j++) {
      angle[i] = ring.phase + j * ring.angularSpacing;
      radius[i] = ring.radius;
      radiusNorm[i] = rn;
      rotation[i] = ring.rotation;
      size[i] = ring.size;
      fade[i] = ring.fade;
      jitter[i] = jitterAmount;
      i++;
    }
  }

  // Pick the sparkle threshold from the actual dot population rather than
  // guessing a constant, so the sparse 2.5% holds whatever the layout.
  const samples = new Float64Array(total);
  for (let k = 0; k < total; k++) {
    samples[k] = sparkleField.sample(radiusNorm[k], angle[k]);
  }
  samples.sort();
  const sparkleThreshold =
    samples[Math.min(total - 1, Math.floor(total * (1 - SPARKLE_FRACTION)))];

  return {
    count: total,
    angle,
    radius,
    radiusNorm,
    rotation,
    size,
    fade,
    jitter,
    sparkleThreshold,
  };
};

export const LAYOUT = buildLayout();
