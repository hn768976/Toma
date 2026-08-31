/**
 * The particle system shared by both families.
 *
 * The set is generated once per variant (seeded, memoised by the layer) and
 * reused on every frame. Regenerating it per frame would make the field boil
 * and would dominate the render cost, so nothing in here is allowed to depend
 * on the frame number — motion belongs in the draw pass.
 *
 * `mode` on the variant decides how a particle is *drawn* and *moved*, not how
 * it is built: a streak particle and a point particle come out of the same
 * generator with the same seeds.
 */

import { random } from "remotion";
import { TAU, clamp, lerp, pickWeightedIndex } from "./lib/math";
import type { BandConfig, Variant } from "./variants";

export type Particle = {
  /** Base position, normalised to the frame. Used directly in point mode. */
  readonly bx: number;
  readonly by: number;
  /**
   * Direction of travel for each traversal of the loop (streak mode). A
   * particle that reaches the edge recycles to the next angle in this list, so
   * with `cycles` whole traversals per loop the sequence repeats exactly.
   */
  readonly angles: readonly number[];
  /** Whole traversals completed per loop. Integer. */
  readonly cycles: number;
  /** Offset into its own traversal at frame 0, 0..1. */
  readonly phase: number;

  readonly size: number;
  readonly brightness: number;
  readonly colorIndex: number;

  /** Frames. Divides the loop length. */
  readonly twinklePeriod: number;
  readonly twinklePhase: number;

  /** Per-particle closed drift path (point mode). Integer frequencies. */
  readonly driftFx: number;
  readonly driftFy: number;
  readonly driftPx: number;
  readonly driftPy: number;
  readonly driftAmp: number;

  /** Arm length of a four-point diffraction spike; 0 for ordinary stars. */
  readonly spikeLength: number;
};

export type DustBlob = {
  readonly x: number;
  readonly y: number;
  /** Fraction of frame width. */
  readonly radius: number;
  readonly alpha: number;
  readonly colorIndex: number;
  /** Lissajous drift: integer frequencies keep the path closed over the loop. */
  readonly fx: number;
  readonly fy: number;
  readonly px: number;
  readonly py: number;
  readonly ax: number;
  readonly ay: number;
  readonly breathFreq: number;
  readonly breathPhase: number;
};

/** A sector of the field flashing for a handful of frames (warpViolet). */
export type Burst = {
  readonly start: number;
  readonly duration: number;
  readonly angle: number;
  readonly halfWidth: number;
  readonly gain: number;
};

/** A single star twinkling noticeably brighter for a few frames. */
export type Flare = {
  readonly index: number;
  readonly start: number;
  readonly duration: number;
  readonly gain: number;
};

/* ── band geometry ──────────────────────────────────────────────────── */

/**
 * Perpendicular distance from a normalised point to a band's centre line,
 * measured in units of frame height so the band's visual angle is honest at
 * 16:9 rather than skewed by the normalised coordinate space.
 */
export const bandDistance = (
  band: BandConfig,
  x: number,
  y: number,
  aspect: number,
) => {
  const theta = (band.angleDeg * Math.PI) / 180;
  const nx = -Math.sin(theta);
  const ny = Math.cos(theta);
  const u = (x - 0.5) * aspect;
  const v = y - 0.5;
  return u * nx + v * ny - band.offset;
};

/* ── particles ──────────────────────────────────────────────────────── */

const brightnessFor = (variant: Variant, r: number, rWithin: number) => {
  let cursor = r;
  for (const tier of variant.brightness) {
    if (cursor < tier.share) {
      return lerp(tier.range[0], tier.range[1], rWithin);
    }
    cursor -= tier.share;
  }
  const last = variant.brightness[variant.brightness.length - 1];
  return lerp(last.range[0], last.range[1], rWithin);
};

export const buildParticles = (variant: Variant, aspect: number): Particle[] => {
  const seed = variant.id;
  const particles: Particle[] = new Array(variant.density);
  const colorWeights = variant.colors.map((c) => c.weight);
  const spikeCount = variant.spikes ? variant.spikes.count : 0;

  for (let i = 0; i < variant.density; i++) {
    // Position. In point mode the star band, when present, biases placement
    // by rejection sampling so density follows the dust.
    let bx = 0;
    let by = 0;
    for (let attempt = 0; attempt < 8; attempt++) {
      bx = lerp(-0.03, 1.03, random(`${seed}-x-${i}-${attempt}`));
      by = lerp(-0.03, 1.03, random(`${seed}-y-${i}-${attempt}`));
      if (!variant.starBand) {
        break;
      }
      const d = bandDistance(variant.starBand, bx, by, aspect);
      const density =
        variant.starBand.floor +
        (1 - variant.starBand.floor) *
          Math.exp(-(d * d) / (variant.starBand.width * variant.starBand.width));
      if (random(`${seed}-accept-${i}-${attempt}`) < density) {
        break;
      }
    }

    const cycles =
      variant.streak === null
        ? 1
        : variant.streak.cycles[
            pickWeightedIndex(
              variant.streak.cycleWeights,
              random(`${seed}-cycles-${i}`),
            )
          ];

    const angles: number[] = new Array(cycles);
    for (let c = 0; c < cycles; c++) {
      angles[c] = random(`${seed}-angle-${i}-${c}`) * TAU;
    }

    const brightness = brightnessFor(
      variant,
      random(`${seed}-bright-${i}`),
      random(`${seed}-bright-within-${i}`),
    );

    // Size is mostly its own roll but leans on brightness, so the bright
    // minority also tends to be the large minority. Fully independent rolls
    // scatter the bright stars across every size and the field loses the
    // near/far reading that the brightness spread is there to create.
    const sizeRoll = clamp(
      random(`${seed}-size-${i}`) * 0.68 + brightness * 0.32,
      0,
      1,
    );
    const size = lerp(
      variant.size[0],
      variant.size[1],
      Math.pow(sizeRoll, variant.sizeBias),
    );

    // Every palette is ordered dominant hue -> accent -> pale -> white, so
    // nudging the colour roll up with brightness draws the bright minority
    // from the pale end without flattening the weighting of the field.
    const colorIndex = pickWeightedIndex(
      colorWeights,
      clamp(random(`${seed}-color-${i}`) * 0.72 + brightness * 0.28, 0, 0.999),
    );

    const periods = variant.twinkle.periods;
    const twinklePeriod =
      periods[Math.floor(random(`${seed}-tp-${i}`) * periods.length) % periods.length];

    const driftAmp = variant.drift
      ? variant.drift.particleAmp * (0.3 + 0.7 * random(`${seed}-damp-${i}`))
      : 0;

    const isSpiked = i < spikeCount && variant.spikes !== null;

    particles[i] = {
      bx,
      by,
      angles,
      cycles,
      phase: random(`${seed}-phase-${i}`),
      size: isSpiked
        ? lerp(
            variant.spikes!.size[0],
            variant.spikes!.size[1],
            random(`${seed}-spike-size-${i}`),
          )
        : size,
      brightness: isSpiked
        ? lerp(0.82, 1, random(`${seed}-spike-bright-${i}`))
        : brightness,
      // Spiked stars come from the top of the palette so they read as the
      // brightest thing in the frame.
      colorIndex: isSpiked
        ? variant.colors.length - (random(`${seed}-spike-color-${i}`) < 0.6 ? 1 : 2)
        : colorIndex,
      twinklePeriod,
      twinklePhase: random(`${seed}-tphase-${i}`),
      driftFx: 1 + Math.floor(random(`${seed}-dfx-${i}`) * 3),
      driftFy: 1 + Math.floor(random(`${seed}-dfy-${i}`) * 3),
      driftPx: random(`${seed}-dpx-${i}`),
      driftPy: random(`${seed}-dpy-${i}`),
      driftAmp,
      spikeLength: isSpiked
        ? lerp(
            variant.spikes!.length[0],
            variant.spikes!.length[1],
            random(`${seed}-spike-len-${i}`),
          )
        : 0,
    };
  }

  return particles;
};

/* ── dust ───────────────────────────────────────────────────────────── */

export const buildDust = (variant: Variant, aspect: number): DustBlob[] => {
  const dust = variant.dust;
  if (!dust) {
    return [];
  }
  const seed = `${variant.id}-dust`;
  const blobs: DustBlob[] = new Array(dust.count);
  const colorWeights = dust.colors.map((c) => c.weight);

  // Knot centres give the scattered layouts their dense clumps and empty
  // regions; the banded layout ignores them and strings blobs along the plane.
  const knots: { x: number; y: number }[] = [];
  for (let k = 0; k < dust.knots; k++) {
    knots.push({
      x: lerp(0.08, 0.92, random(`${seed}-knot-x-${k}`)),
      y: lerp(0.08, 0.92, random(`${seed}-knot-y-${k}`)),
    });
  }

  for (let i = 0; i < dust.count; i++) {
    let x: number;
    let y: number;
    const scatter = random(`${seed}-scatter-${i}`) < dust.scatterShare;

    if (dust.band && !scatter) {
      // Walk along the band axis and offset perpendicular to it, in the same
      // height-relative screen space `bandDistance` measures in, so the blobs
      // land on exactly the line the star density is biased toward.
      const theta = (dust.band.angleDeg * Math.PI) / 180;
      const along = lerp(-0.75, 0.75, random(`${seed}-along-${i}`));
      // Two rolls summed give a soft centre-weighted spread across the band.
      const across =
        dust.band.width *
        (random(`${seed}-across-a-${i}`) + random(`${seed}-across-b-${i}`) - 1) *
        1.6;
      const offset = across + dust.band.offset;
      const u = along * Math.cos(theta) - offset * Math.sin(theta);
      const v = along * Math.sin(theta) + offset * Math.cos(theta);
      x = 0.5 + u / aspect;
      y = 0.5 + v;
    } else if (!scatter && knots.length > 0) {
      const knot =
        knots[Math.floor(random(`${seed}-pick-${i}`) * knots.length) % knots.length];
      x =
        knot.x +
        (random(`${seed}-kx-${i}`) - 0.5) * 2 * dust.knotSpread;
      y =
        knot.y +
        (random(`${seed}-ky-${i}`) - 0.5) * 2 * dust.knotSpread * aspect;
    } else {
      x = lerp(-0.1, 1.1, random(`${seed}-fx-${i}`));
      y = lerp(-0.1, 1.1, random(`${seed}-fy-${i}`));
    }

    blobs[i] = {
      x,
      y,
      radius: lerp(dust.radius[0], dust.radius[1], random(`${seed}-r-${i}`)),
      alpha: lerp(dust.alpha[0], dust.alpha[1], random(`${seed}-a-${i}`)),
      colorIndex: pickWeightedIndex(colorWeights, random(`${seed}-c-${i}`)),
      fx: 1 + Math.floor(random(`${seed}-fxf-${i}`) * 3),
      fy: 1 + Math.floor(random(`${seed}-fyf-${i}`) * 3),
      px: random(`${seed}-pxp-${i}`),
      py: random(`${seed}-pyp-${i}`),
      ax: lerp(0.01, 0.045, random(`${seed}-ax-${i}`)),
      ay: lerp(0.01, 0.045, random(`${seed}-ay-${i}`)),
      breathFreq: 1 + Math.floor(random(`${seed}-bf-${i}`) * 3),
      breathPhase: random(`${seed}-bp-${i}`),
    };
  }

  return blobs;
};

/* ── timed events ───────────────────────────────────────────────────── */

export const buildBursts = (variant: Variant): Burst[] => {
  const config = variant.bursts;
  if (!config) {
    return [];
  }
  const seed = `${variant.id}-burst`;
  const bursts: Burst[] = [];
  // Sector width is derived from how many particles should be caught in it.
  let cursor = random(`${seed}-offset`) * config.intervalRange[0];
  let n = 0;
  while (cursor < variant.loopLength) {
    const target = lerp(
      config.countRange[0],
      config.countRange[1],
      random(`${seed}-count-${n}`),
    );
    bursts.push({
      start: Math.round(cursor),
      duration: Math.round(
        lerp(
          config.durationRange[0],
          config.durationRange[1],
          random(`${seed}-dur-${n}`),
        ),
      ),
      angle: random(`${seed}-angle-${n}`) * TAU,
      halfWidth: (TAU * target) / (2 * variant.density),
      gain: config.gain,
    });
    cursor += lerp(
      config.intervalRange[0],
      config.intervalRange[1],
      random(`${seed}-gap-${n}`),
    );
    n++;
  }
  return bursts;
};

export const buildFlares = (variant: Variant): Flare[] => {
  const config = variant.flares;
  if (!config) {
    return [];
  }
  const seed = `${variant.id}-flare`;
  const flares: Flare[] = new Array(config.perLoop);
  for (let i = 0; i < config.perLoop; i++) {
    flares[i] = {
      index: Math.floor(random(`${seed}-idx-${i}`) * variant.density),
      start: Math.floor(random(`${seed}-start-${i}`) * variant.loopLength),
      duration: Math.round(
        lerp(
          config.durationRange[0],
          config.durationRange[1],
          random(`${seed}-dur-${i}`),
        ),
      ),
      gain: config.gain,
    };
  }
  return flares;
};

/**
 * Envelope for a timed event, wrapped so an event straddling the loop
 * boundary behaves identically on either side of it.
 */
export const eventEnvelope = (
  frame: number,
  start: number,
  duration: number,
  loopLength: number,
) => {
  const since = (((frame - start) % loopLength) + loopLength) % loopLength;
  if (since >= duration) {
    return 0;
  }
  const t = since / duration;
  return clamp(Math.sin(Math.PI * t), 0, 1);
};
