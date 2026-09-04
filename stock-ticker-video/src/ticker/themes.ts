import type { SeriesConfig } from "./series";
import { SESSION_POINTS } from "./constants";

export type Palette = {
  background: string;
  panel: string;
  grid: string;
  gridStrong: string;
  text: string;
  textDim: string;
  price: string;
  accent: string;
  /** The stretch of series the playhead has not reached yet. */
  accentDim: string;
  fillTop: string;
  fillBottom: string;
  /** A light screen would show a bloom as a rendering error, so V3 opts out. */
  glow: boolean;
  vignette: number;
};

export type TickerVariant = {
  palette: Palette;
  series: SeriesConfig;
};

const DARK_BASE = {
  background: "#0a0a0c",
  panel: "#0e0e12",
  grid: "rgba(255, 255, 255, 0.06)",
  gridStrong: "rgba(255, 255, 255, 0.13)",
  text: "#8b8b93",
  textDim: "#5c5c65",
  price: "#ffffff",
  glow: true,
  vignette: 0.46,
};

/** V1 — the reference match: a red intraday decline on a dark terminal. */
export const V1_DECLINE_DARK: TickerVariant = {
  palette: {
    ...DARK_BASE,
    accent: "#e02033",
    accentDim: "rgba(224, 32, 51, 0.3)",
    fillTop: "rgba(224, 32, 51, 0.35)",
    fillBottom: "rgba(224, 32, 51, 0)",
  },
  series: {
    seed: 20271113,
    points: SESSION_POINTS,
    prevClose: 214.86,
    openGap: -0.0018,
    drift: -0.0135,
    vol: 0.0021,
    shocks: [
      { at: 0.16, span: 22, pct: -0.012 },
      { at: 0.3, span: 14, pct: -0.009 },
      // The deep trough, then its partial recovery.
      { at: 0.42, span: 18, pct: -0.023 },
      { at: 0.5, span: 44, pct: 0.011 },
      { at: 0.68, span: 22, pct: -0.008 },
      { at: 0.85, span: 42, pct: -0.006 },
    ],
  },
};

/** V2 — the same build inverted: an upward session with one sharp dip. */
export const V2_RALLY_DARK: TickerVariant = {
  palette: {
    ...DARK_BASE,
    accent: "#16c784",
    accentDim: "rgba(22, 199, 132, 0.3)",
    fillTop: "rgba(22, 199, 132, 0.35)",
    fillBottom: "rgba(22, 199, 132, 0)",
  },
  series: {
    seed: 71104,
    points: SESSION_POINTS,
    prevClose: 214.86,
    openGap: 0.0062,
    drift: 0.0148,
    vol: 0.0021,
    shocks: [
      { at: 0.12, span: 24, pct: 0.011 },
      { at: 0.29, span: 16, pct: 0.009 },
      // The one sharp dip, then its recovery.
      { at: 0.44, span: 16, pct: -0.0105 },
      { at: 0.51, span: 44, pct: 0.015 },
      { at: 0.7, span: 22, pct: 0.009 },
      { at: 0.86, span: 42, pct: 0.008 },
    ],
  },
};

/** V3 — V1's session and accent on a white broadcast/corporate terminal. */
export const V3_DECLINE_LIGHT: TickerVariant = {
  palette: {
    background: "#ffffff",
    panel: "#f6f7f9",
    grid: "#e1e4e8",
    gridStrong: "#ced4da",
    text: "#57606a",
    textDim: "#8c959f",
    price: "#111111",
    accent: "#e02033",
    accentDim: "rgba(224, 32, 51, 0.28)",
    fillTop: "rgba(224, 32, 51, 0.3)",
    fillBottom: "rgba(224, 32, 51, 0)",
    glow: false,
    vignette: 0.18,
  },
  series: V1_DECLINE_DARK.series,
};
