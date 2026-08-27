import type {RetractParams, VariantConfig} from './variants';

/** Loop length in frames. Every period in the project must divide this. */
export const DUR = 375;

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/** Loop-safe sine: freq must be an integer so frame 0 === frame DUR. */
export const lsin = (t01: number, freq: number, phase: number): number =>
  Math.sin(Math.PI * 2 * (freq * t01 + phase));

export const smoothstep = (x: number): number => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

const easeOutCubic = (x: number): number => {
  const t = clamp01(x);
  return 1 - Math.pow(1 - t, 3);
};

/**
 * How far the filaments have travelled along their retraction, 0..1.
 * 0 at frames 0 and 375 (loop closure), 1 during the bright hold.
 */
export const retractionProfile = (frame: number, r: RetractParams): number => {
  if (frame <= r.retractEnd) {
    return smoothstep(frame / r.retractEnd);
  }
  if (frame <= r.holdEnd) {
    return 1;
  }
  // Rapid re-extension - reads as a pulse, not a rewind.
  return 1 - easeOutCubic((frame - r.holdEnd) / (DUR - r.holdEnd));
};

/**
 * Core energy envelope, 0..1: rises to a peak at peakFrame, holds, then
 * releases during the re-extension. 0 at both loop ends.
 */
export const energyProfile = (frame: number, r: RetractParams): number => {
  if (frame <= r.peakFrame) {
    return Math.pow(smoothstep(frame / r.peakFrame), 1.3);
  }
  if (frame <= r.holdEnd) {
    return 1;
  }
  return 1 - easeOutCubic((frame - r.holdEnd) / (DUR - r.holdEnd));
};

/**
 * Filament extension 0..1 for the current frame. The signed
 * growthDirection from config decides which way the endpoints travel:
 * -1 pulls tips back toward the node as the profile rises, +1 pushes
 * them outward. In non-retract modes filaments stay fully grown.
 */
export const extensionAt = (frame: number, cfg: VariantConfig): number => {
  if (cfg.motionMode !== 'retract' || !cfg.retract) {
    return 1;
  }
  const travel = retractionProfile(frame, cfg.retract);
  const span = 1 - cfg.retract.residual;
  return cfg.filament.growthDirection === -1
    ? 1 - travel * span
    : cfg.retract.residual + travel * span;
};

export const fract = (x: number): number => x - Math.floor(x);
