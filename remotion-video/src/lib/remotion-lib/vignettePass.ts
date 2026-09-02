/**
 * Darkens the frame toward its corners.
 *
 * `strength` is the fraction of light removed at the corners; the centre is
 * untouched and the falloff only begins past the mid-radius, so the subject
 * keeps its full contrast.
 */

export const vignettePass = (
  ctx: CanvasRenderingContext2D,
  strength: number,
): void => {
  const { width, height } = ctx.canvas;
  const cx = width / 2;
  const cy = height / 2;
  const outer = Math.sqrt(cx * cx + cy * cy);
  const gradient = ctx.createRadialGradient(cx, cy, outer * 0.32, cx, cy, outer);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(0.6, `rgba(0, 0, 0, ${strength * 0.18})`);
  gradient.addColorStop(0.85, `rgba(0, 0, 0, ${strength * 0.58})`);
  gradient.addColorStop(1, `rgba(0, 0, 0, ${strength})`);

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
};
