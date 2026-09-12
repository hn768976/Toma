/**
 * Palettes for the LED equaliser.
 *
 * The key property, measured off the reference clip, is that the colour ramp is
 * *absolute*: a segment's colour depends on how high it sits on the canvas, not
 * on how tall its own bar is. Two bars of different heights share the same
 * colour at the same row. The only per-bar colour is the peak cap.
 */

export type Rgb = readonly [number, number, number];

/** A colour stop positioned by `at`: 0 = bottom row, 1 = top row. */
export type Stop = { readonly at: number; readonly color: Rgb };

export type Theme = {
  readonly background: string;
  /** Bottom-to-top colour ramp shared by every bar. */
  readonly ramp: readonly Stop[];
  /** Brightness of an unlit segment, as a fraction of the ramp colour. */
  readonly unlit: number;
  /** How far the peak cap is blended toward white: `base + slope × height`. */
  readonly cap: { readonly base: number; readonly slope: number };
};

/**
 * Traced from the reference clip. Sampling the lit segments gives a ramp that is
 * linear per channel with two knees, where blue then green hit 255:
 *
 *   R = 20 + 5.20 × row      G = min(255, 114 + 6.25 × row)
 *   B = min(255, 231 + 5.00 × row)
 *
 * Expressed over a 40-row grid, the knees land at rows 4.8 and 22.6 — the two
 * middle stops below. CSS interpolates linearly between stops, so these four
 * reproduce the measured ramp channel-for-channel.
 */
export const BLUE_THEME: Theme = {
  background: "#000000",
  ramp: [
    { at: 0, color: [20, 114, 231] },
    { at: 4.8 / 39, color: [45, 144, 255] },
    { at: 22.56 / 39, color: [137, 255, 255] },
    { at: 1, color: [223, 255, 255] },
  ],
  unlit: 0.105,
  // Measured caps: 49% white on a 16-segment bar, 83% on a 29-segment one.
  cap: { base: 0.1, slope: 1.0 },
};

/**
 * The companion variant: same LED construction on the same black, but a denser
 * grid of smaller segments and a silver-to-white ramp instead of blue. The
 * bottom stop stays well short of white so the bars keep the vertical depth
 * that makes the blue version read as a gradient rather than a flat block.
 */
export const WHITE_THEME: Theme = {
  background: "#000000",
  ramp: [
    { at: 0, color: [88, 98, 116] },
    { at: 0.45, color: [178, 189, 205] },
    { at: 1, color: [255, 255, 255] },
  ],
  unlit: 0.075,
  // A near-white ramp leaves little headroom, so the cap starts further along
  // than the blue one's to stay readable on short bars.
  cap: { base: 0.45, slope: 0.55 },
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Colour of the ramp at `at` (0 = bottom row, 1 = top row). */
export const rampAt = (ramp: readonly Stop[], at: number): Rgb => {
  const position = clamp01(at);

  for (let i = 1; i < ramp.length; i++) {
    const previous = ramp[i - 1];
    const next = ramp[i];
    if (position > next.at && i < ramp.length - 1) continue;

    const span = next.at - previous.at || 1;
    const t = clamp01((position - previous.at) / span);
    return [
      previous.color[0] + (next.color[0] - previous.color[0]) * t,
      previous.color[1] + (next.color[1] - previous.color[1]) * t,
      previous.color[2] + (next.color[2] - previous.color[2]) * t,
    ];
  }

  return ramp[0].color;
};

export const toCss = ([r, g, b]: Rgb, alpha = 1) =>
  alpha >= 1
    ? `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
    : `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;

/**
 * The ramp as a bottom-anchored CSS gradient. Painted at full canvas height on
 * every bar and simply clipped by the bar's height, which is what keeps the
 * ramp absolute rather than per-bar.
 */
export const rampGradient = (ramp: readonly Stop[], alpha = 1) =>
  `linear-gradient(to top, ${ramp
    .map((stop) => `${toCss(stop.color, alpha)} ${(stop.at * 100).toFixed(3)}%`)
    .join(", ")})`;

/** Peak cap colour: the ramp at that row, blended toward white. */
export const capColor = (theme: Theme, at: number): Rgb => {
  const base = rampAt(theme.ramp, at);
  const whiteness = clamp01(theme.cap.base + theme.cap.slope * clamp01(at));
  return [
    base[0] + (255 - base[0]) * whiteness,
    base[1] + (255 - base[1]) * whiteness,
    base[2] + (255 - base[2]) * whiteness,
  ];
};
