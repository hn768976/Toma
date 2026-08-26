/**
 * THEMES — the single source of every colour in this project.
 * No hex literal may appear anywhere else in `src/`.
 *
 * The bear and bull variants deliberately share an identical palette: the
 * bullish reading has to come from the *data* (more green candles, larger
 * green bodies), never from re-tinting the chart.
 */

const PALETTE = {
  /** deep, near-black page ground */
  backgroundDeep: '#050A12',
  /** slightly lifted blue-black, used for the radial ground wash */
  backgroundMid: '#0C1A26',
  /** thin, low-contrast chart rules */
  gridLine: '#14283A',
  /** the prominent horizontal price marker */
  dashedLine: '#4A6478',
  /** rising candle */
  candleGreen: '#2FD9A0',
  /** falling candle */
  candleRed: '#E8455F',
  /** order-book cells */
  ladderWhite: '#E8F0F5',
  /** dim text / the low-contrast diagonal trend line */
  textDim: '#8AA0B0',
  /** vignette + grain, kept here so no bare hex escapes this file */
  shadow: '#000000',
  grain: '#FFFFFF',
} as const;

export type Theme = typeof PALETTE;

export const THEMES: {bear: Theme; bull: Theme} = {
  bear: {...PALETTE},
  bull: {...PALETTE},
};

/** '#RRGGBB' -> [r, g, b] in 0..255. */
export const rgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

/** '#RRGGBB' -> 'rgba(r,g,b,a)', optionally scaled in brightness. */
export const rgba = (hex: string, alpha: number, gain = 1): string => {
  const [r, g, b] = rgb(hex);
  const c = (v: number) => Math.min(255, Math.round(v * gain));
  return `rgba(${c(r)},${c(g)},${c(b)},${alpha})`;
};
