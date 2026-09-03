/**
 * bloomPass — additive two-radius glow from a low-resolution bright-pass
 * buffer.
 *
 * The caller draws only the things that should glow into a small offscreen
 * buffer (typically 1/6 of the destination), then hands it here. Compositing
 * it back at two blur radii — one wide and soft, one tight and bright — gives
 * a generous filmic bloom for the cost of two drawImage() calls, and the
 * upscale from the small buffer is part of what makes the glow wide.
 *
 * Palette-agnostic: colour comes entirely from what the caller drew.
 */
import { resetContext } from "./canvas";

export type BloomOptions = {
  /** Blur radius of the wide, soft pass, in destination pixels. */
  wideRadius: number;
  /** Blur radius of the tighter, brighter pass, in destination pixels. */
  tightRadius: number;
  /** Opacity of the wide pass. */
  wideStrength: number;
  /** Opacity of the tight pass. */
  tightStrength: number;
};

export const bloomPass = (
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  width: number,
  height: number,
  options: BloomOptions,
) => {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  ctx.filter = `blur(${options.wideRadius}px)`;
  ctx.globalAlpha = options.wideStrength;
  ctx.drawImage(source, 0, 0, width, height);

  ctx.filter = `blur(${options.tightRadius}px)`;
  ctx.globalAlpha = options.tightStrength;
  ctx.drawImage(source, 0, 0, width, height);

  ctx.restore();
  resetContext(ctx);
};
