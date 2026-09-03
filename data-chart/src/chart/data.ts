/**
 * The dataset. Swap these three exports and the whole template re-plots —
 * every layout value downstream is derived from them.
 */

/** X axis labels. "AGO" is intentional (matches the reference / ES-PT market). */
export const MONTHS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AGO",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
] as const;

/** One value per month, in the same order as MONTHS. */
export const VALUES = [
  520, 180, 500, 330, 560, 240, 750, 600, 280, 900, 520, 790,
] as const;

/**
 * The line starts on the Y axis itself, one half-column before JAN — this is
 * that anchor value. Used by the line and area variants; the bar variant
 * ignores it and draws one bar per month.
 */
export const ORIGIN_VALUE = 200;

/** Y axis ticks: 100 … 1000. */
export const Y_TICKS = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

/**
 * Top of the plot, in data units. One step above the last label, so the grid
 * closes with a rule above "1000" the way the reference does.
 */
export const Y_MAX = 1100;

export const TITLE = "WORLD POPULATION";

/** Placeholder copy — buyers are expected to swap this. */
export const SUBTITLE_LINES = [
  "LOREM IPSUM DOLOR SIT AMET, CONSECTETUR ADIPISICING ELIT,",
  "SED DO EIUSMOD TEMPOR INCIDIDUNT UT LABORE ET DOLORE",
];
