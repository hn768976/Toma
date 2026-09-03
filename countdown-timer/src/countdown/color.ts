import { PALETTE } from "./theme";

type Rgb = { r: number; g: number; b: number };

const parseHex = (hex: string): Rgb => ({
  r: parseInt(hex.slice(1, 3), 16),
  g: parseInt(hex.slice(3, 5), 16),
  b: parseInt(hex.slice(5, 7), 16),
});

/**
 * The sweep, as a CYCLIC list of stops: cyan -> blue -> violet ->
 * magenta and back to cyan, completing exactly once around the circle.
 * Closing the loop back to cyan is what keeps the ring from showing a
 * hard seam where the gradient's end meets its start.
 */
const STOPS: { t: number; rgb: Rgb }[] = [
  { t: 0, rgb: parseHex(PALETTE.barCyan) },
  { t: 0.25, rgb: parseHex(PALETTE.barBlue) },
  { t: 0.5, rgb: parseHex(PALETTE.barViolet) },
  { t: 0.75, rgb: parseHex(PALETTE.barMagenta) },
  { t: 1, rgb: parseHex(PALETTE.barCyan) },
];

/** Samples the sweep at `t` (0-1, wrapping) as a canvas rgb() string. */
export const sweepColorAt = (t: number): string => {
  const wrapped = ((t % 1) + 1) % 1;
  let lower = STOPS[0];
  let upper = STOPS[STOPS.length - 1];
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (wrapped >= STOPS[i].t && wrapped <= STOPS[i + 1].t) {
      lower = STOPS[i];
      upper = STOPS[i + 1];
      break;
    }
  }
  const span = upper.t - lower.t || 1;
  const local = (wrapped - lower.t) / span;
  const mix = (a: number, b: number) => Math.round(a + (b - a) * local);
  return `rgb(${mix(lower.rgb.r, upper.rgb.r)}, ${mix(lower.rgb.g, upper.rgb.g)}, ${mix(
    lower.rgb.b,
    upper.rgb.b,
  )})`;
};
