/**
 * vignettePass — darkens the frame toward its corners.
 *
 * WHAT: Paints a radial gradient over the frame, transparent at the centre and
 * opaque at the edge. Appears in 55 of the source projects.
 *
 * WHY: it holds the eye in the middle of the frame. Without it, bright content
 * near a corner competes with the subject and the composition leaks outward.
 * It also hides the hard frame edge, which otherwise reads as a screenshot.
 *
 * WHY AN ELLIPTICAL GRADIENT: `createRadialGradient` produces a circle. On a
 * 16:9 frame a circular vignette darkens the left and right edges far more than
 * the top and bottom, which looks like a lens fault rather than a grade. This
 * implementation scales the context so the gradient becomes an ellipse matching
 * the frame aspect — the falloff is then even all the way round.
 *
 * PARAMETERS
 *   ctx, width, height  Destination and frame size.
 *   color     Colour of the darkening. Required — nothing baked in. Usually
 *             your background colour, or black.
 *   strength  Alpha at the extreme corner, 0..1. Default 0.55.
 *   inner     Normalised radius where darkening starts. 0 darkens from the
 *             centre out; higher values keep more of the middle clean.
 *             Default 0.45.
 *   outer     Normalised radius where `strength` is reached. Default 1.0,
 *             which puts full strength at the corners.
 *   composite Default 'source-over'. Pass 'multiply' to deepen existing colour
 *             rather than lay a flat wash over it.
 *
 * GOTCHA: apply this LAST, after grain and bloom. A vignette under a bloom pass
 * gets brightened back up at the edges and does nothing.
 *
 * EXAMPLE
 *   vignettePass({ ctx, width, height, color: '#000000', strength: 0.6 });
 */
import type { Ctx } from '../types';

export type VignettePassOptions = {
  ctx: Ctx;
  width: number;
  height: number;
  color: string;
  strength?: number;
  inner?: number;
  outer?: number;
  composite?: GlobalCompositeOperation;
};

export const vignettePass = ({
  ctx,
  width,
  height,
  color,
  strength = 0.55,
  inner = 0.45,
  outer = 1.0,
  composite = 'source-over',
}: VignettePassOptions): void => {
  if (strength <= 0) return;

  const cx = width / 2;
  const cy = height / 2;
  // Half-diagonal: the distance to a corner. Using it as the gradient radius
  // means `outer: 1` puts full strength exactly at the corners.
  const radius = Math.hypot(cx, cy);

  ctx.save();
  ctx.globalCompositeOperation = composite;

  // Squash to an ellipse matching the frame aspect, so the falloff is even on
  // all four edges rather than pinching the short axis.
  const aspect = width / height;
  ctx.translate(cx, cy);
  ctx.scale(aspect, 1);
  ctx.translate(-cx, -cy);

  const r0 = radius * Math.max(0, Math.min(inner, outer));
  const r1 = radius * Math.max(outer, r0 / radius + 1e-6);

  const gradient = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1);
  gradient.addColorStop(0, withAlpha(color, 0));
  gradient.addColorStop(1, withAlpha(color, strength));

  ctx.fillStyle = gradient;
  // The ellipse scaling widens the painted area, so overdraw generously.
  ctx.fillRect(-width, -height, width * 3, height * 3);
  ctx.restore();
};

/**
 * Applies an alpha to a CSS colour string.
 *
 * Handles #rgb, #rrggbb, #rrggbbaa and rgb()/rgba(). Anything else is returned
 * unchanged, which degrades to a fully opaque vignette rather than throwing
 * mid-render.
 */
const withAlpha = (color: string, alpha: number): string => {
  const c = color.trim();

  if (c.startsWith('#')) {
    const hex = c.slice(1);
    const expand = (s: string): number => parseInt(s.length === 1 ? s + s : s, 16);
    if (hex.length === 3 || hex.length === 4) {
      const r = expand(hex[0]);
      const g = expand(hex[1]);
      const b = expand(hex[2]);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }

  const m = c.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const parts = m[1].split(',').map((s) => s.trim());
    if (parts.length >= 3) {
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
    }
  }

  return c;
};

export { withAlpha };
