/**
 * Every number in the dashboard is invented and every random value comes from
 * Remotion's `random()` with a stable string seed, so the series are byte-for-
 * byte identical on every render, on every machine, in every variant.
 *
 * Nothing here reproduces a real analytics product, its metric naming, its
 * layout or its branding, and the ticker carries invented instruments with
 * fictional values rather than real commodities or real prices.
 */

import { random } from "remotion";

/** Number of x positions in the line chart. */
export const SERIES_POINTS = 24;

/** Top of the y axis. Labelled 0 / 1K / 2K, with headroom above 2K. */
export const Y_AXIS_MAX = 2500;

export type SeriesKey = "a" | "b" | "c";

export type Series = {
  key: SeriesKey;
  label: string;
  /** Stroke width in design units — A heaviest, C thinnest. */
  weight: number;
  values: number[];
};

/**
 * A random walk pinned to a rising trend line. `volatility` is the size of the
 * per-point deviation, so Platform A reads as the noisiest of the three.
 */
const buildSeries = (
  key: SeriesKey,
  label: string,
  weight: number,
  start: number,
  end: number,
  volatility: number,
): Series => {
  const values: number[] = [];
  let carry = 0;
  for (let i = 0; i < SERIES_POINTS; i++) {
    const t = i / (SERIES_POINTS - 1);
    const trend = start + (end - start) * t;
    // Carry half of the previous deviation so the walk has a little momentum
    // instead of alternating point to point.
    const kick = (random(`${key}-walk-${i}`) - 0.5) * 2 * volatility;
    carry = carry * 0.45 + kick;
    values.push(Math.max(24, trend + carry));
  }
  return { key, label, weight, values };
};

export const SERIES: Series[] = [
  buildSeries("a", "Platform A", 13, 210, 2230, 300),
  buildSeries("b", "Platform B", 8.5, 150, 1780, 155),
  buildSeries("c", "Platform C", 5, 96, 1490, 62),
];

/** Column bars sit behind the lines, one per x position. */
export const BAR_VALUES: number[] = Array.from({ length: SERIES_POINTS }, (_, i) => {
  const mean = SERIES.reduce((sum, s) => sum + s.values[i], 0) / SERIES.length;
  return mean * (0.72 + random(`bar-${i}`) * 0.3);
});

/** x-axis tick labels; only every third position is labelled. */
export const X_LABELS: (string | null)[] = Array.from({ length: SERIES_POINTS }, (_, i) =>
  i % 3 === 0 ? `${i + 1} Jan` : null,
);

export type CounterSpec = {
  key: string;
  label: string;
  /** Value at the end of the climb. */
  target: number;
  /** How the number is written out. */
  format: "integer" | "percent" | "decimal";
};

export const COUNTERS: CounterSpec[] = [
  { key: "users", label: "Users", target: 2417, format: "integer" },
  { key: "new-users", label: "New Users", target: 31684, format: "integer" },
  { key: "sessions", label: "Sessions", target: 58902, format: "integer" },
  { key: "bounce", label: "Bounce", target: 38.4, format: "percent" },
  { key: "pages", label: "Pages / Session", target: 4.18, format: "decimal" },
];

export type DonutSegment = { label: string; share: number; tone: "accent" | "blue" | "pale" };

/** Accent-coloured majority segment, as specified. */
export const DONUT_SEGMENTS: DonutSegment[] = [
  { label: "Channel A", share: 0.615, tone: "accent" },
  { label: "Channel B", share: 0.253, tone: "blue" },
  { label: "Channel C", share: 0.132, tone: "pale" },
];

export type SidePanelSpec = { title: string; rows: { label: string; value: string; fill: number }[] };

export const SIDE_PANELS: SidePanelSpec[] = [
  {
    title: "Segments",
    rows: [
      { label: "Returning", value: "54.2%", fill: 0.542 },
      { label: "First visit", value: "31.7%", fill: 0.317 },
      { label: "Referred", value: "14.1%", fill: 0.141 },
    ],
  },
  {
    title: "Entry Points",
    rows: [
      { label: "Direct", value: "12,480", fill: 0.68 },
      { label: "Campaign", value: "6,215", fill: 0.34 },
      { label: "Syndicated", value: "2,904", fill: 0.16 },
    ],
  },
];

export type TickerItem = { name: string; value: string; unit: string; change: number };

/**
 * Invented instruments with fictional values — deliberately not real
 * commodities and not real prices.
 */
export const TICKER_ITEMS: TickerItem[] = [
  { name: "VERANITE", value: "4.82", unit: "USD", change: 0.41 },
  { name: "CALDRUM", value: "118.30", unit: "USD", change: -0.77 },
  { name: "OBSIDIAN IX", value: "2,904.5", unit: "IDX", change: 1.24 },
  { name: "TESSERINE", value: "61.09", unit: "USD", change: 0.08 },
  { name: "HALCYON-7", value: "990.6", unit: "IDX", change: -0.31 },
  { name: "NORDLUM", value: "21.88", unit: "USD", change: 0.62 },
  { name: "PYRACLAST", value: "3,015.2", unit: "IDX", change: -0.19 },
  { name: "VITRIUM", value: "47.55", unit: "USD", change: 0.93 },
  { name: "STELLAGRAIN", value: "812.4", unit: "IDX", change: 0.27 },
  { name: "CINDERALLOY", value: "15.72", unit: "USD", change: -0.54 },
  { name: "AURELIX", value: "236.71", unit: "USD", change: 0.15 },
  { name: "MERIDIAN-4", value: "1,447.9", unit: "IDX", change: -0.86 },
];

/**
 * The world map is a dot matrix sampled against a handful of ellipses in
 * normalised map space (x: 0 = 180W, 1 = 180E; y: 0 = 90N, 1 = 90S). It only
 * has to read as land at low contrast, so blobs beat a real coastline here.
 */
export const MAP_BLOBS: { x: number; y: number; rx: number; ry: number }[] = [
  { x: 0.19, y: 0.24, rx: 0.105, ry: 0.115 }, // North America
  { x: 0.25, y: 0.36, rx: 0.05, ry: 0.06 },
  { x: 0.285, y: 0.44, rx: 0.028, ry: 0.042 }, // Central America
  { x: 0.325, y: 0.6, rx: 0.05, ry: 0.085 }, // South America
  { x: 0.305, y: 0.72, rx: 0.032, ry: 0.062 },
  { x: 0.375, y: 0.135, rx: 0.045, ry: 0.045 }, // Greenland
  { x: 0.52, y: 0.245, rx: 0.052, ry: 0.055 }, // Europe
  { x: 0.545, y: 0.52, rx: 0.062, ry: 0.09 }, // Africa
  { x: 0.53, y: 0.63, rx: 0.04, ry: 0.06 },
  { x: 0.68, y: 0.27, rx: 0.14, ry: 0.105 }, // Asia
  { x: 0.7, y: 0.42, rx: 0.036, ry: 0.052 }, // India
  { x: 0.765, y: 0.44, rx: 0.05, ry: 0.045 }, // South-east Asia
  { x: 0.855, y: 0.66, rx: 0.058, ry: 0.05 }, // Australia
];

/** A few regions lit in the accent colour. */
export const MAP_HIGHLIGHTS: { x: number; y: number; label: string }[] = [
  { x: 0.2, y: 0.27, label: "NA" },
  { x: 0.525, y: 0.25, label: "EU" },
  { x: 0.735, y: 0.33, label: "AP" },
];
