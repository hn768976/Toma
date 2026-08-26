/**
 * The two looks the composition ships in.
 *
 * Almost everything about a defocused, out-of-focus screen inverts between
 * light and dark, so the theme carries more than a palette: it decides which
 * way blurred content washes, whether highlights bloom outward or clip toward
 * white, and which way the grain is composited. It also carries the two
 * content flags that separate the dark cut from the light one.
 */

export type Theme = {
  id: 'light' | 'dark';

  /** Frame background, and the colour defocused content washes toward. */
  bg: string;
  /** RGB triple of `bg`, for building the washes and gradients. */
  bgRgb: [number, number, number];
  /** Sidebar fill. Null leaves the panel the same value as the chart. */
  panel: string | null;

  green: string;
  red: string;
  blue: string;
  /** Axis labels and headings. */
  text: string;
  /** Grid rules and panel dividers. */
  rule: string;
  /** Secondary UI text. */
  mid: string;
  /** Text inside the price tag. */
  tagText: string;
  /** Alpha of the volume histogram — secondary information, low contrast. */
  volumeAlpha: number;

  /** How far each depth-of-field layer washes toward `bg` before it is blurred. */
  dofWash: [number, number, number];
  /** Composite opacity of each layer. */
  dofAlpha: [number, number, number];

  /** Opacity of the haze that swallows the far upper-left corner, at its
   *  three inner gradient stops. */
  hazeStops: [number, number, number];
  /**
   * `out`  — a blurred copy composited with `lighten`, so highlights clip
   *          gently toward white. Correct on a white screen; additive glow
   *          there would be wrong.
   * `add`  — a real additive bloom. On a dark screen the UI is emissive and
   *          genuinely does spill light into its surroundings.
   */
  bloom: 'out' | 'add';
  /** Vignette tint at the corners, and its strength. */
  vignette: {mid: string; outer: string; alpha: number};
  /**
   * `multiply` darkens with near-white noise — the only polarity that reads on
   * a white ground. `lighter` adds near-black noise, which is how grain sits in
   * the shadows of a dark frame.
   */
  grainMode: 'multiply' | 'lighter';
  grainAlpha: number;

  /** The candle chart peeking out from behind the sidebar. */
  showSecondaryChart: boolean;
  /** The oversized cropped axis numerals that slide down the far right. */
  showFarAxis: boolean;
};

/** Print-like and muted. Nothing here is emissive; the screen is paper-white. */
export const LIGHT: Theme = {
  id: 'light',
  bg: '#FFFFFF',
  bgRgb: [255, 255, 255],
  panel: null,
  green: '#26A66A',
  red: '#D9455C',
  blue: '#2D6FD9',
  text: '#3A4048',
  rule: '#E4E7EB',
  mid: '#9AA3AE',
  tagText: '#FFFFFF',
  volumeAlpha: 0.3,
  dofWash: [0, 0.16, 0.46],
  dofAlpha: [1, 0.97, 0.86],
  hazeStops: [0.92, 0.42, 0.06],
  bloom: 'out',
  vignette: {mid: 'rgba(250,245,239,0.22)', outer: 'rgba(236,225,212,0.85)', alpha: 0.34},
  grainMode: 'multiply',
  grainAlpha: 0.3,
  showSecondaryChart: true,
  showFarAxis: true,
};

/**
 * The dark cut. Colours are luminous rather than muted — on a dark ground the
 * print-like palette would sit too close to the background to read.
 *
 * The right-hand third is deliberately quiet here: no candles bleeding across
 * the sidebar, no oversized numerals sliding down the frame. The sidebar takes
 * the room they leave and carries a third column instead.
 */
export const DARK: Theme = {
  id: 'dark',
  bg: '#0A0D13',
  bgRgb: [10, 13, 19],
  panel: '#111621',
  green: '#2BD98A',
  red: '#FF4D6A',
  blue: '#4C8DFF',
  text: '#D5DCE6',
  rule: '#1E2635',
  mid: '#77839A',
  tagText: '#0A0D13',
  volumeAlpha: 0.38,
  dofWash: [0, 0.12, 0.38],
  dofAlpha: [1, 0.98, 0.9],
  hazeStops: [0.88, 0.4, 0.06],
  bloom: 'add',
  vignette: {mid: 'rgba(120,132,158,0.16)', outer: 'rgba(16,22,34,0.9)', alpha: 0.55},
  grainMode: 'lighter',
  grainAlpha: 0.34,
  showSecondaryChart: false,
  showFarAxis: false,
};
