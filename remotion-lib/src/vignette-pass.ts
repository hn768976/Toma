/**
 * vignettePass — corner falloff over a finished frame.
 *
 * Takes the colour to pull the corners towards rather than assuming black: on
 * a pale ground a dark vignette reads as dirt, and lightening the corners with
 * the ground's own light tone is what actually looks like falloff. Pass a dark
 * colour for the conventional effect.
 */
import type { Ctx } from "./canvas2d";
import { withAlpha } from "./color";

export interface VignettePassOptions {
  width: number;
  height: number;
  /** The colour the corners are pulled towards. */
  color: string;
  /** Opacity at the very corners, e.g. 0.08. */
  strength: number;
  /** Fraction of the half-diagonal left untouched. Defaults to 0.34. */
  innerRadius?: number;
}

export const vignettePass = (ctx: Ctx, o: VignettePassOptions): void => {
  const cx = o.width / 2;
  const cy = o.height / 2;
  const radius = Math.hypot(cx, cy);
  const gradient = ctx.createRadialGradient(
    cx,
    cy,
    radius * (o.innerRadius ?? 0.34),
    cx,
    cy,
    radius,
  );
  gradient.addColorStop(0, withAlpha(o.color, 0));
  gradient.addColorStop(0.6, withAlpha(o.color, o.strength * 0.28));
  gradient.addColorStop(1, withAlpha(o.color, o.strength));
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, o.width, o.height);
  ctx.restore();
};
