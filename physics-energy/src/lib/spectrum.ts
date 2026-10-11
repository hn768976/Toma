// Wavelength (nm) -> linear sRGB, from the analytic CIE 1931 colour-matching
// fit of Wyman, Sloan & Shirley (2013), then XYZ -> linear sRGB.
const g = (x: number, mu: number, s1: number, s2: number) => {
  const t = (x - mu) / (x < mu ? s1 : s2);
  return Math.exp(-0.5 * t * t);
};

export const cieXYZ = (l: number): [number, number, number] => [
  1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2),
  0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1),
  1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8),
];

export const wavelengthToLinearRGB = (l: number): [number, number, number] => {
  const [X, Y, Z] = cieXYZ(l);
  let r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  let gg = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  let b = 0.0557 * X - 0.204 * Y + 1.057 * Z;
  // out-of-gamut spectral colours: desaturate toward white just enough
  const m = Math.min(r, gg, b);
  if (m < 0) { r -= m; gg -= m; b -= m; }
  return [r, gg, b];
};

/**
 * n samples from 400 to 700 nm, scaled per channel so the sum is white (1,1,1):
 * where all wavelengths overlap the beam is white, where they fan out each
 * band shows its own hue.
 */
export const spectrumSamples = (n: number) => {
  const lambdas = Array.from({ length: n }, (_, i) => 400 + (300 * (i + 0.5)) / n);
  const cols = lambdas.map(wavelengthToLinearRGB);
  const sum = cols.reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]], [0, 0, 0]);
  return lambdas.map((l, i) => ({ lambda: l, rgb: [cols[i][0] / sum[0], cols[i][1] / sum[1], cols[i][2] / sum[2]] as [number, number, number] }));
};

/** Cauchy n(lambda) = A + B / lambda^2 (lambda in micrometres). */
export const CAUCHY_A = 1.5;
/** ~5x the B of crown glass (BK7: 0.0042 um^2): exaggerated dispersion. */
export const CAUCHY_B = 0.021;
export const ior = (lambdaNm: number) => CAUCHY_A + CAUCHY_B / (lambdaNm / 1000) ** 2;
