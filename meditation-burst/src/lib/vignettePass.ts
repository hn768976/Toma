import { withAlpha } from "./color";

/**
 * Corner falloff. `strength` is the alpha reached at the far corners, so
 * `0.24` darkens them by roughly 24%. `color` is a `#RRGGBB` string —
 * usually the composition's darkest palette entry, so a piece never has
 * to hardcode a tone here.
 */
export const vignettePass = (
  ctx: CanvasRenderingContext2D,
  opts: {
    width: number;
    height: number;
    strength: number;
    /** Fraction of the corner distance at which darkening starts. */
    inner?: number;
    color: string;
  },
): void => {
  const { width, height, strength } = opts;
  const inner = opts.inner ?? 0.42;
  const { color } = opts;
  const cx = width / 2;
  const cy = height / 2;
  const outer = Math.hypot(cx, cy);
  const g = ctx.createRadialGradient(cx, cy, outer * inner, cx, cy, outer);
  g.addColorStop(0, withAlpha(color, 0));
  g.addColorStop(0.55, withAlpha(color, strength * 0.22));
  g.addColorStop(0.82, withAlpha(color, strength * 0.62));
  g.addColorStop(1, withAlpha(color, strength));
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
};
