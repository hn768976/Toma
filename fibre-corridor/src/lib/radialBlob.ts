// Vendored from remotion-lib (see its CATALOG.md). Keep in sync with
// the library copy; this project ships standalone, so the file lives here.
import type { Ctx } from "./canvas";
import { rgba, type Rgb } from "./colour";

/**
 * A soft radial disc: opaque-ish at the centre, falling to nothing at the
 * rim. The building block for points of light, defocused highlights and
 * bloom centres.
 *
 * @param stops  where the mid colour sits, 0..1 of the radius. Lower values
 *               give a tighter hot core; higher values a flatter disc.
 */
export const radialBlob = (
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  inner: Rgb,
  outer: Rgb,
  alpha: number,
  stops = 0.42,
) => {
  if (r <= 0.4 || alpha <= 0.002) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(inner, alpha));
  g.addColorStop(stops, rgba(outer, alpha * 0.34));
  g.addColorStop(1, rgba(outer, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
};
