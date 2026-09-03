import { DEFAULT_TILT, tiltPoint, untiltVector, type Tilt } from "./lib/tilt";

/**
 * Geometry for the group, in untilted frame coordinates. The tilt is
 * applied at draw time (see lib/tilt.ts) so every layer agrees on where
 * things are without having to bake rotation into the numbers here.
 *
 * All values are fractions of the frame, so the composition is
 * resolution-independent even though it is authored for 3840x2160.
 */
export type Layout = {
  scale: number;
  barLeft: number;
  barTop: number;
  barWidth: number;
  barHeight: number;
  barSkew: number;
  barRadius: number;
  capHeight: number;
  wordLeft: number;
  wordBaseline: number;
  glowCenterX: number;
  glowCenterY: number;
  glowRadiusX: number;
  glowRadiusY: number;
};

/**
 * Clear air between the word's baseline and the bar's top edge. The
 * word carries a wide glow, so a gap that merely avoids the letterforms
 * still reads as the word sitting on the bar rather than above it.
 */
const WORD_GAP_RATIO = 0.09;

export const computeLayout = (
  width: number,
  height: number,
  capHeightRatio: number,
  tilt: Tilt = DEFAULT_TILT,
): Layout => {
  const barWidth = width * 0.62;
  const barHeight = barWidth * 0.09;
  const barSkew = barHeight * 0.24;
  const capHeight = height * capHeightRatio;

  // Nominal placement: the word directly above the bar, sharing its
  // left edge, so the two read as one deliberately set unit. The bar's
  // left edge is vertical (only its right edge leans), so a single x
  // aligns the word's first glyph with the whole left side of the box.
  const nominalBarLeft = width * 0.205;
  const nominalBarTop = height * 0.6 - barHeight / 2;
  const nominalWordLeft = nominalBarLeft;
  const nominalWordBaseline = nominalBarTop - height * WORD_GAP_RATIO;

  // The tilt rotates the group about the frame centre, which drags the
  // left-hand extremes down and lifts the right-hand ones — so a group
  // that is centred on paper lands low and slightly left on screen.
  // Measure the tilted bounding box and cancel the difference.
  //
  // Only four corners can be extreme: the word's cap-top-left is the
  // highest and (sharing x with the bar but sitting higher, so rotated
  // further left) the leftmost point, the bar's bottom-left the lowest,
  // and the bar's top-right the rightmost — every word is narrower than
  // the bar, so the word's right edge never wins. That keeps this
  // independent of text metrics, which are not known until draw time.
  const corners = [
    { x: nominalWordLeft, y: nominalWordBaseline - capHeight },
    { x: nominalBarLeft, y: nominalBarTop + barHeight },
    { x: nominalBarLeft + barWidth + barSkew, y: nominalBarTop },
    { x: nominalBarLeft + barWidth, y: nominalBarTop + barHeight },
  ].map((c) => tiltPoint(c.x, c.y, width, height, tilt));

  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const shift = untiltVector(
    width / 2 - (Math.min(...xs) + Math.max(...xs)) / 2,
    height / 2 - (Math.min(...ys) + Math.max(...ys)) / 2,
    tilt,
  );

  const barLeft = nominalBarLeft + shift.x;
  const barTop = nominalBarTop + shift.y;

  return {
    // Everything authored against a 1920-wide reference, so stroke
    // weights and blur radii scale with the frame.
    scale: width / 1920,
    barLeft,
    barTop,
    barWidth,
    barHeight,
    barSkew,
    barRadius: barHeight * 0.28,
    capHeight,
    wordLeft: nominalWordLeft + shift.x,
    wordBaseline: nominalWordBaseline + shift.y,
    // The lit region sits on the group, which is now centred.
    glowCenterX: width / 2,
    glowCenterY: height / 2,
    glowRadiusX: width * 0.52,
    glowRadiusY: height * 0.46,
  };
};
