export type ThemeName = "light" | "dark";

export type Theme = {
  page: string;
  altRow: string;
  divider: string;
  /** Search field chrome: border, magnifier, placeholder. */
  chrome: string;
  /**
   * Outline icons -- toolbar trash / overflow dots and the per-row checkbox
   * and star. The references draw these noticeably darker than the search
   * field chrome, so they follow the flag-label colour rather than `chrome`.
   */
  icon: string;
  flag: string;
  subject: string;
  searchBg: string;
  searchBorder: string;
  vignette: string;
};

const AMBER = "#f2c14e";
const AMBER_EDGE = "#d9a72f";
const AMBER_FOLD = "#fff8e6";
const ALERT_RED = "#e0342b";

export const ENVELOPE_COLORS = {
  fill: AMBER,
  edge: AMBER_EDGE,
  fold: AMBER_FOLD,
  alert: ALERT_RED,
};

export const THEMES: Record<ThemeName, Theme> = {
  light: {
    page: "#ffffff",
    altRow: "#fafafa",
    divider: "#eaeaea",
    chrome: "#9aa0a6",
    icon: "#3c4043",
    flag: "#3c4043",
    subject: "#202124",
    searchBg: "#f1f3f4",
    searchBorder: "#e0e0e0",
    vignette: "rgba(0, 0, 0, 0.20)",
  },
  dark: {
    page: "#131417",
    altRow: "#17181c",
    divider: "#26282d",
    chrome: "#8b8f96",
    icon: "#c8ccd2",
    flag: "#c8ccd2",
    subject: "#e8eaed",
    searchBg: "#1e2025",
    searchBorder: "#2a2d33",
    vignette: "rgba(0, 0, 0, 0.34)",
  },
};
