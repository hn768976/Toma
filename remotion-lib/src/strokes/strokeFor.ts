/**
 * strokeFor.ts — keep stroke weight constant under scaling.
 *
 * WHAT IT DOES
 *   Returns the strokeWidth to set so that, after an enclosing transform
 *   scales the element, the stroke still renders at the width you meant.
 *
 * WHAT IT IS FOR
 *   Icon sets. The natural way to place an icon at several sizes is to
 *   draw it once in a base box and wrap it in `transform="scale(s)"`.
 *   But scale multiplies EVERYTHING, strokes included: at s=2 a 4px
 *   outline becomes 8px, and a small icon scaled up stops reading as a
 *   line drawing and turns into a blob. Worse, a set of icons at
 *   different scales no longer looks like a set, because the one visual
 *   property that must stay constant across an icon family — stroke
 *   weight — is the one thing that changed.
 *
 * PARAMETERS
 *   scale     the enclosing transform's scale factor
 *   strokePx  the apparent width you want, in final composition px
 *
 * GOTCHA
 *   This corrects for scale only. It cannot help with `vector-effect:
 *   non-scaling-stroke`, which solves the same problem in the renderer
 *   but is all-or-nothing (it ignores scale ENTIRELY, so an icon
 *   deliberately scaled 4x for a hero shot keeps a hairline outline).
 *   Use this when you want proportional control, that when you want none.
 *
 * GOTCHA 2
 *   Nested scales multiply. If a scaled icon sits inside a scaled camera
 *   group, pass the product, not just the inner scale.
 *
 * USAGE
 *   <g transform={`translate(${x} ${y}) scale(${s})`}
 *      strokeWidth={strokeFor(s, 4)}>
 *     ...icon paths...
 *   </g>
 */

/**
 * Counter-scales a stroke width. Guards against scale 0, which would
 * otherwise return Infinity and blank the icon.
 */
export const strokeFor = (scale: number, strokePx: number): number => {
  if (!Number.isFinite(scale) || scale === 0) return strokePx;
  return strokePx / Math.abs(scale);
};

/**
 * The same correction expressed in sizes rather than a ratio, for when
 * you think in "this icon is drawn in a 60px box and placed at 24px".
 */
export const strokeForSize = (
  renderedSize: number,
  baseSize: number,
  strokePx: number,
): number => strokeFor(renderedSize / baseSize, strokePx);

/** The scale factor that fits a base box into a rendered size. */
export const scaleFor = (renderedSize: number, baseSize: number): number =>
  baseSize === 0 ? 1 : renderedSize / baseSize;
