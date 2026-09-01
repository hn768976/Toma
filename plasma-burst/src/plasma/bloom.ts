import { BLOOM } from "./config";
import { clear2d, getScratch } from "./scratch";

/**
 * Generous bloom, scaled by the intensity curve so the ignition frames blow out
 * and the afterglow does not.
 *
 * Computed at 1/4 resolution: bloom is low-frequency by definition, and both
 * the bright-pass and the blurs then cost a sixteenth of what they would at 4K.
 * The bright-pass is a self-multiply — squaring the composited frame strongly
 * favours what is already hot, so the cloud does not smear into a haze.
 */
export const applyBloom = (
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  width: number,
  height: number,
  scale: number,
  energy: number,
): void => {
  const strength = BLOOM.strength * energy;
  if (strength <= 0.002) {
    return;
  }

  const divisor = BLOOM.resolutionDivisor;
  const w = Math.max(1, Math.round(width / divisor));
  const h = Math.max(1, Math.round(height / divisor));

  const down = clear2d(getScratch("bloom-down", w, h));
  down.imageSmoothingEnabled = true;
  down.imageSmoothingQuality = "high";
  down.drawImage(source, 0, 0, width, height, 0, 0, w, h);

  // Bright-pass: value squared.
  const bright = clear2d(getScratch("bloom-bright", w, h));
  bright.drawImage(down.canvas, 0, 0);
  bright.globalCompositeOperation = "multiply";
  bright.drawImage(down.canvas, 0, 0);
  bright.globalCompositeOperation = "source-over";

  const blurred = getScratch("bloom-blur", w, h);

  const pass = (radius: number, alpha: number) => {
    const bctx = clear2d(blurred);
    bctx.filter = `blur(${(radius * scale) / divisor}px)`;
    bctx.drawImage(bright.canvas, 0, 0);
    // A little of the un-squared frame mixed back in, so the cloud blooms too
    // and not only the filament cores.
    bctx.globalCompositeOperation = "lighter";
    bctx.globalAlpha = BLOOM.linearMix;
    bctx.drawImage(down.canvas, 0, 0);
    bctx.globalAlpha = 1;
    bctx.filter = "none";

    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = Math.min(1, alpha * strength);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(blurred, 0, 0, w, h, 0, 0, width, height);
  };

  pass(BLOOM.tightRadius, BLOOM.tightAlpha);
  pass(BLOOM.wideRadius, BLOOM.wideAlpha);

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
};
