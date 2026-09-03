/**
 * vignettePass — radial corner darkening.
 *
 * Drawn as a multi-stop radial gradient of black so it composites correctly
 * on an otherwise transparent overlay canvas (canvas blend modes do not reach
 * across separate stacked canvases, so this deliberately uses plain alpha).
 */
export const vignettePass = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  /** Alpha of the black at the extreme corners. 0.22 = a ~22% vignette. */
  strength: number,
  /** 0-1: the radius fraction at which darkening starts. */
  inner = 0.42,
  /** Falloff exponent. Higher keeps the centre clear for longer. */
  falloff = 2.1,
) => {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.hypot(cx, cy);
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  const STEPS = 12;
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const eased = t <= inner ? 0 : Math.pow((t - inner) / (1 - inner), falloff);
    gradient.addColorStop(t, `rgba(0, 0, 0, ${eased * strength})`);
  }
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
};
