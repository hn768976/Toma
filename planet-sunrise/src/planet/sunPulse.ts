/**
 * Sun brightness pulse, fitted (least squares, 3 harmonics) to the
 * reference clip's measured luminance around the sun: period 87.75 frames.
 * Returns roughly [-1, 1].
 */
const P = 87.75;
const C = [8.059, -6.468, -2.612, -7.096, 4.882, 6.517];

export const sunPulse = (frame: number): number => {
  const w = (2 * Math.PI * frame) / P;
  const v =
    C[0] * Math.cos(w) +
    C[1] * Math.sin(w) +
    C[2] * Math.cos(2 * w) +
    C[3] * Math.sin(2 * w) +
    C[4] * Math.cos(3 * w) +
    C[5] * Math.sin(3 * w);
  return v / 16;
};
