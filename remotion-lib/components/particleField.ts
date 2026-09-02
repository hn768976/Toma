/**
 * An animated field of quantised particles.
 *
 * Takes positions produced by `sampleFromMask` and gives each one the
 * per-particle identity it needs to move: a twinkle cycle, a tiny closed
 * drift orbit, a brightness tier, and optionally a second home position
 * it churns between. Every cycle's period divides the composition
 * duration, so the whole field returns to its frame-0 state exactly.
 *
 * Build the field ONCE in `useMemo`; call `drawParticleField` once per
 * React render. The draw is a pure function of (field, frame).
 *
 * @example
 * const field = buildParticleField(points, {
 *   seed: "brain", originX, originY, sizeMin: 3, sizeMax: 9,
 * });
 * drawParticleField(ctx, field, {
 *   frame, duration: 600,
 *   colors: { base: "#3FD4B8", bright: "#A8FFE8", peak: "#E8FFF8" },
 * });
 */
import type { SampledPoint } from "./maskSampler";
import { closedOrbit, loopSine } from "./loopMath";
import { makeRng, pick, range, type Rng } from "./rng";

export type FieldParticle = {
  /** Home position in frame coordinates. */
  x: number;
  y: number;
  /** Second home position; equal to (x, y) when this particle never churns. */
  x2: number;
  y2: number;
  /** Offset into the churn cycle, or -1 for a particle that stays put. */
  churnPhase: number;
  size: number;
  /** Resting brightness, 0..1. */
  bright: number;
  /** 0 = body colour, 1 = the brighter minority, 2 = the brightest few. */
  tier: 0 | 1 | 2;
  twinklePeriod: number;
  twinklePhase: number;
  twinkleAmp: number;
  orbitPeriod: number;
  orbitPhase: number;
  orbitRadius: number;
  orbitAspect: number;
};

export type BuildFieldOptions = {
  seed: string;
  /** Added to every sampled position to move it into frame coordinates. */
  originX: number;
  originY: number;
  sizeMin: number;
  sizeMax: number;
  /** Multiplies every particle's resting brightness. */
  brightScale?: number;
  twinklePeriods: number[];
  twinkleMinAmp: number;
  twinkleMaxAmp: number;
  orbitPeriods: number[];
  orbitMinRadius: number;
  orbitMaxRadius: number;
  /** Share of particles that fade out and reappear at an alternate home. */
  churnFraction?: number;
  /**
   * Alternate homes for churning particles, sampled from the same domain.
   * Fewer entries than needed simply means fewer churning particles.
   */
  churnPoints?: SampledPoint[];
};

/**
 * Brightness is deliberately not uniform: most particles sit mid, a
 * scattering are near-white, and some are very dim. That spread is what
 * stops a dense grid reading as a flat slab.
 */
const brightnessTier = (rng: Rng): { bright: number; tier: 0 | 1 | 2 } => {
  const r = rng();
  if (r < 0.09) return { bright: range(rng, 0.13, 0.3), tier: 0 };
  if (r < 0.85) return { bright: range(rng, 0.37, 0.66), tier: 0 };
  if (r < 0.965) return { bright: range(rng, 0.68, 0.88), tier: 1 };
  return { bright: range(rng, 0.9, 1), tier: 2 };
};

export const buildParticleField = (
  points: SampledPoint[],
  opts: BuildFieldOptions,
): FieldParticle[] => {
  const rng = makeRng(opts.seed + ":field");
  const brightScale = opts.brightScale ?? 1;
  const churnCount = Math.round(points.length * (opts.churnFraction ?? 0));
  const churnPoints = opts.churnPoints ?? [];

  const out: FieldParticle[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const { bright, tier } = brightnessTier(rng);
    // Particles that landed on a feature (outline or gyral guide) are
    // both larger and brighter — that is what makes the folds legible
    // without ever drawing them.
    const sizeT = Math.min(1, p.weight * range(rng, 0.55, 1.25));
    const churns = i < churnCount && i < churnPoints.length;
    const alt = churns ? churnPoints[i] : p;
    out.push({
      x: p.x + opts.originX,
      y: p.y + opts.originY,
      x2: alt.x + opts.originX,
      y2: alt.y + opts.originY,
      churnPhase: churns ? rng() : -1,
      size: opts.sizeMin + (opts.sizeMax - opts.sizeMin) * sizeT,
      bright: Math.min(1, bright * (0.72 + 0.42 * p.weight) * brightScale),
      tier,
      twinklePeriod: pick(rng, opts.twinklePeriods),
      twinklePhase: rng(),
      twinkleAmp: range(rng, opts.twinkleMinAmp, opts.twinkleMaxAmp),
      orbitPeriod: pick(rng, opts.orbitPeriods),
      orbitPhase: rng(),
      orbitRadius: range(rng, opts.orbitMinRadius, opts.orbitMaxRadius),
      orbitAspect: range(rng, 0.45, 1),
    });
  }
  return out;
};

/** Filled by `PulseFn`; reused across particles so the draw allocates nothing. */
export type PulseOut = { b: number; dx: number; dy: number };
export type PulseFn = (x: number, y: number, out: PulseOut) => void;

export type DrawFieldOptions = {
  frame: number;
  duration: number;
  colors: { base: string; bright: string; peak: string };
  /** Raised brightness from travelling signal pulses. */
  pulseAt?: PulseFn;
  /** Multiplies every particle's final alpha. */
  alphaScale?: number;
  /** Skip particles dimmer than this — used to draw a bloom source pass. */
  minBrightness?: number;
  /** Multiplies every particle's drawn size — used by the bloom pass. */
  sizeScale?: number;
};

const parseHex = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/**
 * Colours are quantised into a small cache before being turned into
 * rgba() strings: at 5000+ particles a frame, building a fresh string per
 * particle is the single most expensive thing the draw does.
 */
const ALPHA_STEPS = 24;
const PULSE_STEPS = 6;

const makeColorCache = (colors: { base: string; bright: string; peak: string }) => {
  const rgb = [parseHex(colors.base), parseHex(colors.bright), parseHex(colors.peak)];
  const peak = rgb[2];
  const cache: (string | undefined)[] = [];
  return (tier: number, pulseStep: number, alphaStep: number): string => {
    const key = (tier * (PULSE_STEPS + 1) + pulseStep) * (ALPHA_STEPS + 1) + alphaStep;
    const hit = cache[key];
    if (hit !== undefined) return hit;
    const t = (pulseStep / PULSE_STEPS) * 0.85;
    const c = rgb[tier];
    const s = `rgba(${Math.round(c[0] + (peak[0] - c[0]) * t)}, ${Math.round(
      c[1] + (peak[1] - c[1]) * t,
    )}, ${Math.round(c[2] + (peak[2] - c[2]) * t)}, ${(alphaStep / ALPHA_STEPS).toFixed(3)})`;
    cache[key] = s;
    return s;
  };
};

const cacheByColors = new Map<string, ReturnType<typeof makeColorCache>>();

const getColorCache = (colors: { base: string; bright: string; peak: string }) => {
  const key = colors.base + colors.bright + colors.peak;
  let c = cacheByColors.get(key);
  if (!c) {
    c = makeColorCache(colors);
    cacheByColors.set(key, c);
  }
  return c;
};

/**
 * Churn: a particle fades to nothing, swaps to its alternate home, and
 * fades back. Two swaps per loop, both centred inside a fade window, so
 * the jump itself is never visible and the cycle closes at `duration`.
 */
const churnAlpha = (phase: number): { alpha: number; useAlt: boolean } => {
  const w = 0.05;
  const d1 = Math.abs(phase - 0.25);
  const d2 = Math.abs(phase - 0.75);
  const d = Math.min(d1, d2);
  return { alpha: d < w ? d / w : 1, useAlt: phase >= 0.25 && phase < 0.75 };
};

export const drawParticleField = (
  ctx: CanvasRenderingContext2D,
  field: FieldParticle[],
  opts: DrawFieldOptions,
): void => {
  const { frame, duration } = opts;
  const color = getColorCache(opts.colors);
  const alphaScale = opts.alphaScale ?? 1;
  const minBrightness = opts.minBrightness ?? 0;
  const sizeScale = opts.sizeScale ?? 1;
  const pulse: PulseOut = { b: 0, dx: 0, dy: 0 };

  for (let i = 0; i < field.length; i++) {
    const p = field[i];

    let alpha = 1;
    let hx = p.x;
    let hy = p.y;
    if (p.churnPhase >= 0) {
      const phase = ((frame / duration + p.churnPhase) % 1 + 1) % 1;
      const c = churnAlpha(phase);
      alpha = c.alpha;
      if (alpha <= 0.001) continue;
      if (c.useAlt) {
        hx = p.x2;
        hy = p.y2;
      }
    }

    const orbit = closedOrbit(frame, p.orbitPeriod, p.orbitRadius, p.orbitAspect, p.orbitPhase);
    let x = hx + orbit.dx;
    let y = hy + orbit.dy;

    let b = p.bright * (1 + p.twinkleAmp * loopSine(frame, p.twinklePeriod, p.twinklePhase));

    let pulseStep = 0;
    if (opts.pulseAt) {
      pulse.b = 0;
      pulse.dx = 0;
      pulse.dy = 0;
      opts.pulseAt(x, y, pulse);
      if (pulse.b > 0) {
        b += pulse.b * (1.05 - p.bright * 0.35);
        x += pulse.dx;
        y += pulse.dy;
        pulseStep = Math.min(PULSE_STEPS, Math.round(pulse.b * PULSE_STEPS));
      }
    }

    if (b < minBrightness) continue;

    const a = Math.max(0, Math.min(1, b)) * alpha * alphaScale;
    const alphaStep = Math.round(a * ALPHA_STEPS);
    if (alphaStep <= 0) continue;

    const size = p.size * sizeScale;
    ctx.fillStyle = color(p.tier, pulseStep, alphaStep);
    ctx.fillRect(x - size * 0.5, y - size * 0.5, size, size);
  }
};
