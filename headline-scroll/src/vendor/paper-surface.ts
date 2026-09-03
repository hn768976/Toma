// Vendored from @studio/remotion-lib (src/paper-surface.ts). Do not edit here —
// edit the library and re-run `node scripts/sync-lib.mjs`.
/**
 * Deterministic paper mottling.
 *
 * A very low resolution field of tones, scaled up with smoothing, giving soft
 * irregular tonal drift rather than grain. Every tone is a straight JS mix
 * between the card colour and a slightly shaded version of it, so the surface
 * is painted rather than blended: routing this through `multiply` (or through
 * per-pixel alpha) puts it at the mercy of canvas's premultiply round-trip,
 * which turns near-transparent pixels into rounding noise and prints as
 * coloured blotches instead of tonal variation.
 */
import { makeCanvas, context2d, releaseCanvas } from "./canvas2d";
import type { Ctx } from "./canvas2d";
import { mix } from "./color";
import { rand } from "./seeded-random";

/**
 * Paints `width` x `height` with `base`, mottled towards `shade`.
 * `strength` is how far the darkest patch travels towards `shade`, e.g. 0.04.
 */
export const paperSurface = (
  ctx: Ctx,
  seed: string,
  width: number,
  height: number,
  base: string,
  shade: string,
  strength: number,
): void => {
  const nw = 128;
  const nh = Math.max(16, Math.round((128 * height) / width));

  // Pre-mix the tone ramp once; the field only indexes into it.
  const STEPS = 24;
  const ramp: string[] = [];
  for (let i = 0; i < STEPS; i += 1) {
    ramp.push(mix(base, shade, (i / (STEPS - 1)) * strength));
  }

  const field = makeCanvas(nw, nh);
  const fctx = context2d(field);
  for (let y = 0; y < nh; y += 1) {
    for (let x = 0; x < nw; x += 1) {
      const n = rand(`${seed}-t${y * nw + x}`) ** 0.75;
      fctx.fillStyle = ramp[Math.min(STEPS - 1, Math.floor(n * STEPS))];
      fctx.fillRect(x, y, 1, 1);
    }
  }

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(field, 0, 0, width, height);
  ctx.restore();
  releaseCanvas(field);
};
