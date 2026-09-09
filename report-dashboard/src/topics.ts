import type { StyleName } from "./theme";

/**
 * Accent colours. Everything that carries subject identity lives here rather
 * than in the component, so a new topic is a data entry, not a code change.
 * `halo` is an "r,g,b" triple because the marker halo needs it at several
 * alpha stops.
 */
export type Accent = {
  /** The chart curve. */
  line: string;
  /** Cluster marker dot. */
  marker: string;
  /** Marker halo, as "r,g,b". */
  halo: string;
  /** Positive delta text. */
  positive: string;
  /** Negative delta text. */
  negative: string;
  badgeBg: string;
  badgeText: string;
};

export type Stat = {
  label: string;
  /** The target the value counts up to. */
  value: number;
  decimals: number;
  /** Group thousands with a comma. */
  thousands?: boolean;
  prefix?: string;
  suffix?: string;
  /** Rendered verbatim beside the value; a leading "-" colours it negative. */
  delta: string;
};

export type Point = { x: number; y: number };

export type Topic = {
  category: string;
  title: string;
  subtitle: string;
  chartLabel: string;
  /** Normalised 0..1, x left-to-right, y bottom-to-top. */
  chartData: Point[];
  stats: Stat[];
  footnote: string;
  accent: Accent;
  accentDark: Accent;
  /** Seeds the cluster marker scatter; change it to reshuffle the layout. */
  markerSeed: number;
  markerCount: number;
};

/** A gentle S: slow, steep through the middle, levelling off. */
export const S_CURVE: Point[] = [
  { x: 0, y: 0.08 },
  { x: 0.14, y: 0.11 },
  { x: 0.28, y: 0.17 },
  { x: 0.42, y: 0.29 },
  { x: 0.54, y: 0.44 },
  { x: 0.68, y: 0.63 },
  { x: 0.84, y: 0.79 },
  { x: 1, y: 0.88 },
];

export const HEALTH: Topic = {
  category: "PUBLIC HEALTH",
  title: "Disease Spread Analysis",
  subtitle: "Case growth and regional transmission across a monitored population",
  chartLabel: "TRANSMISSION CLUSTERS",
  chartData: S_CURVE,
  stats: [
    { label: "REPORTED CASES", value: 18420, decimals: 0, thousands: true, delta: "+9.4%" },
    { label: "TRANSMISSION RATE", value: 1.34, decimals: 2, delta: "+0.18" },
    { label: "REGIONS AFFECTED", value: 12, decimals: 0, delta: "+3" },
    { label: "RECOVERY RATE", value: 91, decimals: 0, suffix: "%", delta: "+1.2%" },
  ],
  // Every figure above is invented. This footnote is not decoration: it is what
  // stops a generic graphic being read as a record of a real outbreak.
  footnote: "Illustrative epidemiological model — not real outbreak data",
  accent: {
    line: "#2a8a8a",
    marker: "#e04a3a",
    halo: "224,74,58",
    positive: "#2a8a8a",
    negative: "#e04a3a",
    badgeBg: "#e2efee",
    badgeText: "#2a8a8a",
  },
  accentDark: {
    line: "#39a8a4",
    marker: "#f0604e",
    halo: "240,96,78",
    positive: "#39a8a4",
    negative: "#f0604e",
    badgeBg: "#17302f",
    badgeText: "#4fbdb8",
  },
  markerSeed: 4390,
  markerCount: 10,
};

export const CLIMATE: Topic = {
  category: "CLIMATE MONITORING",
  title: "Regional Climate Monitoring",
  subtitle: "Temperature anomaly and station coverage across a modelled region",
  chartLabel: "ANOMALY CLUSTERS",
  chartData: S_CURVE,
  stats: [
    { label: "MEAN ANOMALY", value: 1.42, decimals: 2, prefix: "+", suffix: "°", delta: "+0.21" },
    { label: "STATIONS REPORTING", value: 2480, decimals: 0, thousands: true, delta: "+140" },
    { label: "ALERT ZONES", value: 7, decimals: 0, delta: "+2" },
    { label: "DATA COVERAGE", value: 94, decimals: 0, suffix: "%", delta: "+0.8%" },
  ],
  footnote: "Illustrative climate model — not real monitoring data",
  accent: {
    line: "#2a7a9a",
    marker: "#d99022",
    halo: "217,144,34",
    positive: "#2a7a9a",
    negative: "#d99022",
    badgeBg: "#e2ecf1",
    badgeText: "#2a7a9a",
  },
  accentDark: {
    line: "#3a9cc0",
    marker: "#eda838",
    halo: "237,168,56",
    positive: "#3a9cc0",
    negative: "#eda838",
    badgeBg: "#152a34",
    badgeText: "#4fb0d4",
  },
  markerSeed: 3298,
  markerCount: 10,
};

export const accentFor = (topic: Topic, style: StyleName): Accent =>
  style === "dark" ? topic.accentDark : topic.accent;
