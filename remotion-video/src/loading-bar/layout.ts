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

export const computeLayout = (
  width: number,
  height: number,
  capHeightRatio: number,
): Layout => {
  const barWidth = width * 0.62;
  const barHeight = barWidth * 0.09;
  const barLeft = width * 0.205;
  const barTop = height * 0.6 - barHeight / 2;
  const capHeight = height * capHeightRatio;

  return {
    // Everything authored against a 1920-wide reference, so stroke
    // weights and blur radii scale with the frame.
    scale: width / 1920,
    barLeft,
    barTop,
    barWidth,
    barHeight,
    barSkew: barHeight * 0.24,
    barRadius: barHeight * 0.28,
    capHeight,
    // The word sits upper-left of centre; the bar beneath and slightly
    // right of it, so the two read as one hand-placed unit.
    wordLeft: width * 0.155,
    wordBaseline: barTop - height * 0.055,
    glowCenterX: width * 0.47,
    glowCenterY: height * 0.5,
    glowRadiusX: width * 0.52,
    glowRadiusY: height * 0.46,
  };
};
