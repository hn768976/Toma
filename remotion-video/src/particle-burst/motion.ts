import { interpolate } from "remotion";
import type { Keyframe, TravelCurve, VariantConfig } from "./config";
import type { Particle } from "./particles";

/**
 * Fraction of its span a particle has covered after `t` frames of travel.
 * Always in 0..1 and always non-negative — the sign of the motion lives in
 * `radialDirection`, never here.
 */
export const travelFraction = (curve: TravelCurve, t: number): number => {
  if (t <= 0) return 0;
  if (curve.kind === "drag") {
    // Decelerating: fastest at t=0, easing out. A detonation.
    return 1 - Math.exp(-t / curve.tauFrames);
  }
  // Accelerating: slowest at t=0, easing in. A collapse.
  const u = Math.min(1, t / curve.rampFrames);
  return (Math.exp(curve.k * u) - 1) / (Math.exp(curve.k) - 1);
};

export const travelSpanOf = (cfg: VariantConfig, p: Particle): number =>
  cfg.travelSpanPx + cfg.travelSpanFromStartRadius * p.startRadius;

/** Distance covered along the radial axis by `frame`. Never negative. */
export const travelAt = (
  cfg: VariantConfig,
  p: Particle,
  frame: number,
): number =>
  travelSpanOf(cfg, p) *
  travelFraction(
    cfg.travelCurve,
    frame - cfg.travelStartFrame - p.startDelay,
  ) *
  p.speedMul;

/**
 * The one place radial position is decided:
 *
 *     radius = startRadius + radialDirection * distanceTravelled
 *
 * radialDirection is +1 for the burst and -1 for the implosion. Nothing else
 * in the project encodes "outward" or "inward".
 */
export const radiusAt = (
  cfg: VariantConfig,
  p: Particle,
  frame: number,
): number =>
  Math.max(0, p.startRadius + cfg.radialDirection * travelAt(cfg, p, frame));

/**
 * Angle at `frame`: the ideal evenly-spaced angle, plus scatter that the
 * variant's envelope either opens (the burst's ring going ragged) or closes
 * (the implosion gathering into a clean ring), plus a small tangential drift
 * so paths curve instead of running dead radial. The drift is signed by
 * radialDirection too, so the swirl handedness mirrors between the two.
 */
export const angleAt = (
  cfg: VariantConfig,
  p: Particle,
  frame: number,
  travelFrac: number,
): number => {
  const jitterEnvelope = interpolate(
    frame,
    [cfg.angleJitterFrom.frame, cfg.angleJitterTo.frame],
    [cfg.angleJitterFrom.value, cfg.angleJitterTo.value],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return (
    p.angle +
    p.angleJitter * jitterEnvelope +
    cfg.radialDirection * p.curl * travelFrac
  );
};

/** Linear interpolation through a keyframe list, clamped at both ends. */
export const sampleCurve = (curve: Keyframe[], frame: number): number => {
  if (frame <= curve[0].frame) return curve[0].value;
  const last = curve[curve.length - 1];
  if (frame >= last.frame) return last.value;
  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i];
    const b = curve[i + 1];
    if (frame >= a.frame && frame <= b.frame) {
      const t = (frame - a.frame) / (b.frame - a.frame || 1);
      return a.value + (b.value - a.value) * t;
    }
  }
  return last.value;
};

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/**
 * Per-particle alpha: appearance ramp, decay across its life, staggered death,
 * twinkle, and — where the variant enables it — extinction at the centre.
 */
export const alphaAt = (
  cfg: VariantConfig,
  p: Particle,
  frame: number,
  radius: number,
): number => {
  if (frame < p.appearFrame || frame >= p.deathFrame) return 0;

  const fadeIn = Math.min(1, (frame - p.appearFrame) / cfg.fadeInFrames);
  const fadeOut = Math.min(1, (p.deathFrame - frame) / p.fadeOutFrames);

  const lifeSpan = Math.max(1, p.deathFrame - p.appearFrame);
  const lifeProgress = Math.min(1, (frame - p.appearFrame) / lifeSpan);
  const decay = 1 - cfg.lifeDecay * lifeProgress;

  const twinkle =
    1 +
    cfg.twinkleAmplitude *
      Math.sin(frame * p.twinkleFreq + p.twinklePhase);

  const centreFade =
    cfg.centreFadePx > 0
      ? smoothstep(cfg.centreFadePx * 0.2, cfg.centreFadePx, radius)
      : 1;

  return p.brightness * fadeIn * fadeOut * decay * twinkle * centreFade;
};

/**
 * Multi-draw motion blur passes for this frame. Strength is 1 at the variant's
 * peak-speed frame and 0 by the frame where the swarm has slowed enough that
 * the extra draws are pure cost.
 */
export const motionBlurPasses = (cfg: VariantConfig, frame: number): number => {
  const { maxPasses, peakFrame, zeroFrame } = cfg.motionBlur;
  // peakFrame may sit either side of zeroFrame: the burst's blur ramps down
  // from the detonation, the implosion's ramps up into the collapse.
  const span = peakFrame - zeroFrame;
  const strength =
    span === 0 ? 1 : Math.max(0, Math.min(1, (frame - zeroFrame) / span));
  return 1 + Math.round(strength * (maxPasses - 1));
};
