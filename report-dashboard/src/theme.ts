/**
 * Two UI grounds — light and dark. Accent colours are NOT set here; they come
 * from the topic (see topics.ts) so a new subject can restyle the accents
 * without touching the theme.
 */
export type StyleName = "light" | "dark";

export type Theme = {
  page: string;
  /** Barely-there warm tint washed over the page, as a radial highlight. */
  pageTint: string;
  /** A faint settling of tone toward the bottom of the page. */
  pageShade: string;
  card: string;
  border: string;
  title: string;
  body: string;
  /** Dim letter-spaced caps: card label, stat labels, footnote. */
  label: string;
  footnote: string;
  ecg: string;
  cardShadow: string;
  statShadow: string;
  /** Film grain opacity, 0..1. */
  grain: number;
  /** Accents are brightened slightly on the dark ground. */
  accentLift: number;
};

export const THEMES: Record<StyleName, Theme> = {
  light: {
    page: "#f7f6f4",
    pageTint: "rgba(255,253,250,0.85)",
    pageShade: "rgba(226,219,207,0.5)",
    card: "#ffffff",
    border: "#e8e6e2",
    title: "#1a1a1a",
    body: "#6a6a6a",
    label: "#9a9793",
    footnote: "#a5a29d",
    ecg: "#c3c0bb",
    // Very subtle: a heavier shadow reads as a slide template, not a report.
    cardShadow: "0 2px 4px rgba(40,36,30,0.03), 0 12px 34px rgba(40,36,30,0.05)",
    statShadow: "0 1px 3px rgba(40,36,30,0.03)",
    grain: 0.005,
    accentLift: 0,
  },
  dark: {
    page: "#0e1114",
    pageTint: "rgba(30,36,42,0.75)",
    pageShade: "rgba(0,0,0,0.22)",
    card: "#171b1f",
    border: "#252b31",
    title: "#f0f2f4",
    body: "#8a9099",
    label: "#6f767e",
    footnote: "#6a7178",
    ecg: "#333b43",
    cardShadow: "0 2px 4px rgba(0,0,0,0.30), 0 14px 38px rgba(0,0,0,0.36)",
    statShadow: "0 1px 3px rgba(0,0,0,0.28)",
    grain: 0.015,
    accentLift: 1,
  },
};
