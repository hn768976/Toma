export type Pt = [number, number];

/** Border edges, as fractions of the composition width / height. */
const L = 0.05; // left inset  (~4% of frame width plus room for furniture)
const R = 0.95;
const T_HI = 0.058; // main top edge
const T_LO = 0.1; // the lower top edge over the left third
const B_HI = 0.9; // the higher bottom edge over the left half
const B_LO = 0.942; // main bottom edge
const TOP_STEP_X = 0.235; // where the top edge steps up, going right
const BOTTOM_STEP_X = 0.522; // where the bottom edge steps down, going right

/** Chamfer lengths, as a fraction of width so the cut stays 45 degrees. */
const CH_TL = 0.012;
const CH_TR = 0.011;
const CH_BL = 0.03;
const CH_BR = 0.026;

export type Frame = {
  W: number;
  H: number;
  left: number;
  right: number;
  topHi: number;
  topLo: number;
  botHi: number;
  botLo: number;
  topStepX: number;
  bottomStepX: number;
  points: Pt[];
};

/** Vertices of the border, clockwise, starting below the top-left chamfer. */
export const buildFrame = (W: number, H: number): Frame => {
  const left = L * W;
  const right = R * W;
  const topHi = T_HI * H;
  const topLo = T_LO * H;
  const botHi = B_HI * H;
  const botLo = B_LO * H;
  const topStepX = TOP_STEP_X * W;
  const bottomStepX = BOTTOM_STEP_X * W;
  // Chamfers are equal in x and y so the cut sits at 45 degrees on screen.
  const cTL = CH_TL * W;
  const cTR = CH_TR * W;
  const cBL = CH_BL * W;
  const cBR = CH_BR * W;
  // The steps are 45 degrees too, so their run equals their rise.
  const topRise = topLo - topHi;
  const botRise = botLo - botHi;

  const points: Pt[] = [
    [left + cTL, topLo], // top-left chamfer, upper end
    [topStepX, topLo], // low top edge runs right
    [topStepX + topRise, topHi], // steps up
    [right - cTR, topHi], // main top edge
    [right, topHi + cTR], // top-right chamfer
    [right, botLo - cBR],
    [right - cBR, botLo], // bottom-right chamfer
    [bottomStepX, botLo], // main bottom edge runs left
    [bottomStepX - botRise, botHi], // steps up
    [left + cBL, botHi], // high bottom edge
    [left, botHi - cBL], // bottom-left chamfer
    [left, topLo + cTL], // left edge
  ];

  return {
    W,
    H,
    left,
    right,
    topHi,
    topLo,
    botHi,
    botLo,
    topStepX,
    bottomStepX,
    points,
  };
};

const intersect = (
  p: Pt,
  dp: Pt,
  q: Pt,
  dq: Pt,
  fallback: Pt,
): Pt => {
  const den = dp[0] * dq[1] - dp[1] * dq[0];
  if (Math.abs(den) < 1e-9) return fallback;
  const t = ((q[0] - p[0]) * dq[1] - (q[1] - p[1]) * dq[0]) / den;
  return [p[0] + dp[0] * t, p[1] + dp[1] * t];
};

/**
 * Offset a closed clockwise polygon inward by `d` px. Each edge is pushed along
 * its inward normal and consecutive edges re-intersected, so 45 degree chamfers
 * stay 45 degrees instead of being scaled toward a centroid.
 */
export const offsetPolygon = (pts: Pt[], d: number): Pt[] => {
  const n = pts.length;
  const moved = pts.map((p, i) => {
    const q = pts[(i + 1) % n];
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const len = Math.hypot(dx, dy) || 1;
    // Clockwise winding in a y-down system: inward normal is (-dy, dx)/len.
    const nx = (-dy / len) * d;
    const ny = (dx / len) * d;
    return {
      p: [p[0] + nx, p[1] + ny] as Pt,
      dir: [dx, dy] as Pt,
    };
  });
  return pts.map((orig, i) => {
    const prev = moved[(i - 1 + n) % n];
    const cur = moved[i];
    return intersect(prev.p, prev.dir, cur.p, cur.dir, orig);
  });
};

export const toPath = (pts: Pt[]): string =>
  pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ") + " Z";

/** Perimeter, used only for sanity checks; the draw-on uses SVG pathLength. */
export const perimeter = (pts: Pt[]): number =>
  pts.reduce((acc, p, i) => {
    const q = pts[(i + 1) % pts.length];
    return acc + Math.hypot(q[0] - p[0], q[1] - p[1]);
  }, 0);
