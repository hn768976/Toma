/**
 * Corner falloff. `strength` is the alpha reached at the far corners, so
 * `0.24` darkens them by roughly 24%.
 */
export const vignettePass = (
  ctx: CanvasRenderingContext2D,
  opts: {
    width: number;
    height: number;
    strength: number;
    /** Fraction of the corner distance at which darkening starts. */
    inner?: number;
    color?: string;
  },
): void => {
  const { width, height, strength } = opts;
  const inner = opts.inner ?? 0.42;
  const color = opts.color ?? "0, 0, 0";
  const cx = width / 2;
  const cy = height / 2;
  const outer = Math.hypot(cx, cy);
  const g = ctx.createRadialGradient(cx, cy, outer * inner, cx, cy, outer);
  g.addColorStop(0, `rgba(${color}, 0)`);
  g.addColorStop(0.55, `rgba(${color}, ${(strength * 0.22).toFixed(4)})`);
  g.addColorStop(0.82, `rgba(${color}, ${(strength * 0.62).toFixed(4)})`);
  g.addColorStop(1, `rgba(${color}, ${strength.toFixed(4)})`);
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
};
