// Cold blue-white on black. No other hue lives in this piece except the two
// chromatic-aberration fringes on the title.
export const PALETTE = {
  background: '#000000',
  codeBright: '#E8F2FF',
  codeMid: '#A8C8E8',
  codeDim: '#3A5878',
  tunnelLine: '#1A2C44',
  titleWhite: '#FFFFFF',
  fringeRed: '#E02040',
  fringeCyan: '#20D0E0',
} as const;

export type Rgb = [number, number, number];

export const hexToRgb = (hex: string): Rgb => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const rgba = ([r, g, b]: Rgb, a: number) =>
  `rgba(${r}, ${g}, ${b}, ${a})`;

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [
  Math.round(mix(a[0], b[0], t)),
  Math.round(mix(a[1], b[1], t)),
  Math.round(mix(a[2], b[2], t)),
];

const DIM = hexToRgb(PALETTE.codeDim);
const MID = hexToRgb(PALETTE.codeMid);
const BRIGHT = hexToRgb(PALETTE.codeBright);

/**
 * Depth ramp: distant code is `codeDim`, mid-corridor code is `codeMid`,
 * code about to pass the camera is `codeBright`.
 * `t` runs 0 (far, near the vanishing point) -> 1 (near camera).
 */
export const depthColor = (t: number): Rgb =>
  t < 0.5 ? mixRgb(DIM, MID, t / 0.5) : mixRgb(MID, BRIGHT, (t - 0.5) / 0.5);
