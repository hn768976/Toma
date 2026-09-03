/**
 * Scan position over time. Both modes are driven from `VariantConfig.scan`, so
 * changing the mode changes the piece — there is no second implementation.
 */
import type { ScanConfig, ScanStep } from "../variants";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smoothstep = (v: number) => v * v * (3 - 2 * v);

/**
 * Piecewise progress through the keyframe table. Each segment is eased
 * independently, so the travel visibly steps and stalls instead of gliding.
 */
export const steppedProgress = (steps: ScanStep[], t: number): number => {
  const tt = clamp01(t);
  for (let i = 0; i < steps.length - 1; i++) {
    const a = steps[i];
    const b = steps[i + 1];
    if (tt >= a.t && tt <= b.t) {
      if (b.t === a.t) return b.p;
      const local = (tt - a.t) / (b.t - a.t);
      return a.p + (b.p - a.p) * smoothstep(local);
    }
  }
  return steps[steps.length - 1].p;
};

export type ScanState = {
  /** Is a line on screen at all this frame? */
  active: boolean;
  /** 0..1 down the print, in travel order for the mode. */
  progress: number;
  /** 0..1 from the print's top edge — what the reveal and the line both use. */
  y: number;
  /** Same, `trailFrames` ago. The trail spans y..yTrail and fades. */
  yTrail: number;
  /** Brightness multiplier for this pass. */
  gain: number;
  /** Highest y ever reached, so an acquire reveal never un-reveals. */
  revealed: number;
};

/** Where the line sits at `frame`, as a fraction from the print's TOP edge. */
const rawY = (scan: ScanConfig, frame: number): { y: number; gain: number; active: boolean } => {
  if (scan.mode === "acquire") {
    const t = (frame - scan.startFrame) / (scan.endFrame - scan.startFrame);
    const p = steppedProgress(scan.steps, t);
    return {
      y: p, // travels downward, so progress is already distance from the top
      gain: 1,
      active: frame >= scan.startFrame && frame <= scan.endFrame,
    };
  }
  for (const pass of scan.passes) {
    if (frame >= pass.start && frame <= pass.end) {
      const p = clamp01((frame - pass.start) / (pass.end - pass.start));
      return { y: 1 - p, gain: pass.gain, active: true }; // upward
    }
  }
  return { y: 0, gain: 0, active: false };
};

export const scanState = (scan: ScanConfig, frame: number): ScanState => {
  const now = rawY(scan, frame);
  const then = rawY(scan, Math.max(0, frame - scan.trailFrames));
  const progress =
    scan.mode === "acquire"
      ? steppedProgress(scan.steps, (frame - scan.startFrame) / (scan.endFrame - scan.startFrame))
      : 1 - now.y;
  return {
    active: now.active,
    progress: clamp01(progress),
    y: clamp01(now.y),
    yTrail: clamp01(then.active && then.gain === now.gain ? then.y : now.y),
    gain: now.gain,
    revealed:
      scan.mode === "acquire"
        ? clamp01(frame >= scan.endFrame ? 1 : now.y)
        : 1,
  };
};

/** Which pass index is running (or has last run) at `frame`. -1 before the first. */
export const passIndexAt = (scan: ScanConfig, frame: number): number => {
  if (scan.mode !== "verify") return -1;
  let idx = -1;
  scan.passes.forEach((p, i) => {
    if (frame >= p.start) idx = i;
  });
  return idx;
};

/** 0..1 progress through pass `n` (0 before it starts, 1 once finished). */
export const passProgress = (scan: ScanConfig, n: number, frame: number): number => {
  if (scan.mode !== "verify" || n >= scan.passes.length) return 0;
  const p = scan.passes[n];
  return clamp01((frame - p.start) / (p.end - p.start));
};
