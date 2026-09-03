/**
 * Fitting text to a canvas.
 *
 * Both helpers exist because canvas text is unforgiving in ways CSS is
 * not: an unquoted multi-word family is silently dropped, and there is
 * no `cap-height` unit, so a design spec given in cap heights has to be
 * turned into a px size by measuring.
 */
/**
 * Build a canvas `font` shorthand. The family is quoted: "Roboto Mono"
 * contains a space, and an unquoted multi-word family is silently
 * ignored by the canvas font parser (falling back to 10px sans-serif).
 */
export const cssFont = (
  weight: number,
  sizePx: number,
  family: string,
): string => `${weight} ${sizePx}px "${family}"`;

/**
 * Derive the px font size that yields a given cap height, by measuring
 * a capital at a probe size. Deterministic, and avoids hard-coding a
 * per-family cap-height ratio.
 */
export const fontSizeForCapHeight = (
  ctx: CanvasRenderingContext2D,
  family: string,
  weight: number,
  capHeight: number,
): number => {
  const probe = 200;
  ctx.font = cssFont(weight, probe, family);
  const ascent = ctx.measureText("H").actualBoundingBoxAscent;
  const ratio = ascent > 0 ? ascent / probe : 0.72;
  return capHeight / ratio;
};
