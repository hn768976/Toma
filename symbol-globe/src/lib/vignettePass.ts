/**
 * Radial vignette drawn straight over the frame.
 *
 * `strength` is the alpha the darkening reaches in the corners; the centre is
 * left untouched. Takes a `#rrggbb` colour so the shade can be the scene's own
 * deep background rather than a generic black, which keeps the corners from
 * going muddy on a strongly tinted palette.
 */
import { withAlpha } from "./color";

export type VignetteOptions = {
  color: string;
  strength?: number;
  /** Fraction of the corner radius at which darkening starts. */
  innerStop?: number;
};

export const vignettePass = (
  ctx: CanvasRenderingContext2D,
  options: VignetteOptions,
): void => {
  const { color, strength = 0.22, innerStop = 0.42 } = options;
  const { width, height } = ctx.canvas;
  const cx = width / 2;
  const cy = height / 2;
  const outer = Math.hypot(cx, cy);

  const gradient = ctx.createRadialGradient(
    cx,
    cy,
    outer * innerStop,
    cx,
    cy,
    outer,
  );
  gradient.addColorStop(0, withAlpha(color, 0));
  gradient.addColorStop(0.65, withAlpha(color, strength * 0.4));
  gradient.addColorStop(1, withAlpha(color, strength));

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
};
