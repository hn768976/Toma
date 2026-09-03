/**
 * Broad pools of coloured light, computed at a fraction of the output
 * resolution.
 *
 * Several overlapping radial gradients composited with `lighter` and then
 * upscaled with high-quality smoothing gives a soft, banding-free field far
 * more cheaply than blurring at full resolution. Because the pools sit at
 * different places with different hues, whatever is drawn in front of them
 * picks up a colour that varies across the frame — and drifts across the loop.
 */
import { rgba } from "./color";
import { closedDrift, randRange } from "./random";

export type GlowFieldOptions = {
  /** Accent hues, cycled across the pools. */
  hues: readonly string[];
  frame: number;
  /** Frames per loop. Pools return exactly to their start after this. */
  period: number;
  poolCount?: number;
  /** Vertical band the pools cluster around, as a fraction of the height. */
  bandCenter?: number;
  bandSpread?: number;
  /** Pool radius as a fraction of the field width. */
  radiusRatio?: number;
  /** Peak opacity at a pool's centre. */
  intensity?: number;
  seed?: string;
};

/** Paints the pool field across the whole of `ctx`, which is usually small. */
export const paintGlowField = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  {
    hues,
    frame,
    period,
    poolCount = 7,
    bandCenter = 0.5,
    bandSpread = 0.22,
    radiusRatio = 0.3,
    intensity = 0.95,
    seed = "glow-pool",
  }: GlowFieldOptions,
): void => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.filter = "none";
  ctx.clearRect(0, 0, width, height);
  ctx.globalCompositeOperation = "lighter";

  for (let i = 0; i < poolCount; i++) {
    const key = `${seed}-${i}`;
    // Spread the pools across the frame so the colour behind the word changes
    // from letter to letter rather than washing everything one hue.
    const spanT = (i + 0.5) / poolCount;
    const baseX = (0.06 + spanT * 0.88) * width;
    const baseY =
      (bandCenter + randRange(`${key}-y`, -bandSpread, bandSpread)) * height;

    // Closed Lissajous drift, so every pool is back where it started at the
    // end of the loop. Frequencies are integers for the same reason.
    const freqX = 1 + (i % 2);
    const freqY = 1 + ((i + 1) % 3);
    const amp = randRange(`${key}-amp`, 0.05, 0.13) * width;
    const drift = closedDrift(key, frame, period, amp, freqX, freqY);

    const radius =
      randRange(`${key}-r`, radiusRatio * 0.7, radiusRatio * 1.35) * width;
    const hue = hues[i % hues.length];
    const alpha = intensity * randRange(`${key}-a`, 0.55, 1);

    const cx = baseX + drift.x;
    const cy = baseY + drift.y;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, rgba(hue, alpha));
    grad.addColorStop(0.45, rgba(hue, alpha * 0.35));
    grad.addColorStop(1, rgba(hue, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.globalCompositeOperation = "source-over";
};
