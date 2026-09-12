// Two palettes for the same terminal: the dark one matches the reference
// screen capture, the light one is the same UI in a light colour scheme.
//
// Both are tuned so the up/down/flat trio stays distinguishable against
// its own background and reads at a glance on a 1080p timeline.

export type ThemeName = "dark" | "light";

export type Theme = {
  name: ThemeName;

  // Surfaces
  desk: string; // shows through the bezel gap between windows
  windowBg: string;
  panelBg: string;
  divider: string;
  headerRule: string;

  // Window chrome
  tabBarFrom: string;
  tabBarTo: string;
  tabBarBorder: string;
  tabText: string;
  tabActiveBg: string;
  tabActiveText: string;
  segmentBg: string;
  segmentActiveBg: string;
  segmentText: string;
  segmentActiveText: string;
  inputBg: string;
  inputBorder: string;
  inputText: string;
  iconRing: string;
  iconFill: string;

  // Type
  text: string;
  textMuted: string;
  columnHeader: string;

  // Market semantics
  up: string;
  down: string;
  flat: string;
  volume: string;
  sideBuy: string;
  sideSell: string;
  bid: string;
  offer: string;
  bidBar: string;
  offerBar: string;

  // Row states
  rowHighlight: string;
  blockRowBg: string;
  blockRowText: string;

  // Candle chart window
  chartBg: string;
  chartGrid: string;
  chartAxisText: string;
  candleUp: string;
  candleDown: string;
  volumeBarUp: string;
  volumeBarDown: string;
  priceLine: string;
  priceTagBg: string;
  priceTagText: string;
  prevTagBg: string;
  prevTagText: string;
  badgeLowBorder: string;
  badgeHighBorder: string;

  // Intraday area chart
  areaTop: string;
  areaBottom: string;
  areaLine: string;
  refLine: string;
  sessionLine: string;

  // Buy/sell gauges
  gaugeBuy: string;
  gaugeSell: string;
  gaugeTrack: string;
  gaugeBuyText: string;
  gaugeSellText: string;

  // Screen realism
  vignette: string;
  scanlineOpacity: number;
  bloomOpacity: number;
  chartDefocusPx: number; // the chart monitor sits slightly out of focus
};

export const darkTheme: Theme = {
  name: "dark",

  desk: "#0b0b10",
  windowBg: "#000000",
  panelBg: "#000000",
  divider: "#1e1e26",
  headerRule: "#26262f",

  tabBarFrom: "#3b3747",
  tabBarTo: "#2b2833",
  tabBarBorder: "#4e4a5c",
  tabText: "#d2d0d9",
  tabActiveBg: "#dedede",
  tabActiveText: "#84848c",
  segmentBg: "#3a3a44",
  segmentActiveBg: "#8a8a94",
  segmentText: "#9d9da8",
  segmentActiveText: "#e8e8ee",
  inputBg: "#141419",
  inputBorder: "#3a3a46",
  inputText: "#5c5c68",
  iconRing: "#6b6b78",
  iconFill: "#c9c9d2",

  text: "#e6e6ec",
  textMuted: "#9b9baa",
  columnHeader: "#b9b9c6",

  up: "#00e05a",
  down: "#ff3434",
  flat: "#ffd21e",
  volume: "#ff8ad4",
  sideBuy: "#26d9ef",
  sideSell: "#f472b6",
  bid: "#ff3434",
  offer: "#00e05a",
  bidBar: "#ff3434",
  offerBar: "#26d9ef",

  rowHighlight: "rgba(255,255,255,0.14)",
  blockRowBg: "rgba(120,8,8,0.62)",
  blockRowText: "#ff5a5a",

  chartBg: "#080b14",
  chartGrid: "rgba(64,96,168,0.20)",
  chartAxisText: "#7c8aa8",
  candleUp: "#22c5a4",
  candleDown: "#f0454b",
  volumeBarUp: "rgba(34,197,164,0.45)",
  volumeBarDown: "rgba(240,69,75,0.45)",
  priceLine: "rgba(54,182,168,0.55)",
  priceTagBg: "#22c5a4",
  priceTagText: "#04120f",
  prevTagBg: "#f0454b",
  prevTagText: "#1a0405",
  badgeLowBorder: "#a3213a",
  badgeHighBorder: "#2f5fd0",

  areaTop: "rgba(0, 214, 90, 0.85)",
  areaBottom: "rgba(0, 214, 90, 0.10)",
  areaLine: "#37e07a",
  refLine: "#b9a53a",
  sessionLine: "#3a3a46",

  gaugeBuy: "#4fd8ea",
  gaugeSell: "#f9a8d4",
  gaugeTrack: "#2a2a33",
  gaugeBuyText: "#8ae6f4",
  gaugeSellText: "#f9a8d4",

  vignette:
    "radial-gradient(115% 95% at 50% 45%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.42) 100%)",
  scanlineOpacity: 0.05,
  bloomOpacity: 0.11,
  chartDefocusPx: 0.7,
};

export const lightTheme: Theme = {
  name: "light",

  desk: "#c4c8d2",
  windowBg: "#ffffff",
  panelBg: "#ffffff",
  divider: "#dfe3ea",
  headerRule: "#ccd2dd",

  tabBarFrom: "#eceef3",
  tabBarTo: "#dee2ea",
  tabBarBorder: "#c2c8d4",
  tabText: "#4a5162",
  tabActiveBg: "#ffffff",
  tabActiveText: "#1f2533",
  segmentBg: "#e3e7ee",
  segmentActiveBg: "#ffffff",
  segmentText: "#6b7280",
  segmentActiveText: "#1f2533",
  inputBg: "#f4f6fa",
  inputBorder: "#ccd2dd",
  inputText: "#9aa1af",
  iconRing: "#b6bdc9",
  iconFill: "#5b6273",

  text: "#161a22",
  textMuted: "#6b7280",
  columnHeader: "#5a6270",

  up: "#0b8a3c",
  down: "#cc1f2f",
  flat: "#9a6c00",
  volume: "#8b4fa8",
  sideBuy: "#0e7490",
  sideSell: "#a3357a",
  bid: "#cc1f2f",
  offer: "#0b8a3c",
  bidBar: "#e2707a",
  offerBar: "#5cc0d4",

  rowHighlight: "rgba(20,40,90,0.10)",
  blockRowBg: "#fbe3e5",
  blockRowText: "#a81826",

  chartBg: "#ffffff",
  chartGrid: "rgba(30,60,120,0.10)",
  chartAxisText: "#77808f",
  candleUp: "#0e9f6e",
  candleDown: "#d92d3a",
  volumeBarUp: "rgba(14,159,110,0.30)",
  volumeBarDown: "rgba(217,45,58,0.30)",
  priceLine: "rgba(14,159,110,0.45)",
  priceTagBg: "#0e9f6e",
  priceTagText: "#ffffff",
  prevTagBg: "#d92d3a",
  prevTagText: "#ffffff",
  badgeLowBorder: "#d92d3a",
  badgeHighBorder: "#2f5fd0",

  areaTop: "rgba(11, 138, 60, 0.55)",
  areaBottom: "rgba(11, 138, 60, 0.05)",
  areaLine: "#0b8a3c",
  refLine: "#b08a12",
  sessionLine: "#e0e4ec",

  gaugeBuy: "#2aa4be",
  gaugeSell: "#d96fa8",
  gaugeTrack: "#e7eaf0",
  gaugeBuyText: "#1d7f95",
  gaugeSellText: "#b04b86",

  vignette:
    "radial-gradient(120% 100% at 50% 45%, rgba(0,0,0,0) 60%, rgba(30,40,60,0.10) 100%)",
  scanlineOpacity: 0.02,
  bloomOpacity: 0,
  chartDefocusPx: 0.35,
};

export const themes: Record<ThemeName, Theme> = {
  dark: darkTheme,
  light: lightTheme,
};
