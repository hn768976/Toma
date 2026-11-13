export type DashPalette = {
  name: string;
  /** clear colour / far background (linear-ish display values 0..1) */
  bg: [number, number, number];
  gridLine: string;
  panelTop: string;
  panelBottom: string;
  panelBorder: string;
  panelGlow: string;
  text: string;
  textDim: string;
  textFaint: string;
  donut: [string, string, string];
  donutGlow: string;
  barLight: string;
  barStrong: string;
  barDot: string;
  legend: string[];
  strip: string;
  stripText: string;
  areas: string[];
  revenueArea: [string, string];
  revenueLine: string;
  lineChart: string;
  negative: string;
  statusDots: [string, string, string];
  hudLine: string;
  accentNum: [string, string];
  /** final colour grade */
  gain: [number, number, number];
  lift: [number, number, number];
  saturation: number;
};

/** Version 1 — matches the reference: charcoal glass, violet / peach / teal accents. */
export const REFERENCE_PALETTE: DashPalette = {
  name: "reference",
  bg: [0.03, 0.031, 0.037],
  gridLine: "rgba(150,155,170,0.10)",
  panelTop: "rgba(62,64,72,0.70)",
  panelBottom: "rgba(36,37,43,0.66)",
  panelBorder: "rgba(205,210,225,0.42)",
  panelGlow: "rgba(190,200,230,0.10)",
  text: "#f2f3f7",
  textDim: "rgba(205,208,218,0.78)",
  textFaint: "rgba(170,175,190,0.45)",
  donut: ["#b764f2", "#f2a774", "#ea4450"],
  donutGlow: "rgba(185,100,245,0.45)",
  barLight: "#cfd0f0",
  barStrong: "#6b5cf4",
  barDot: "#e9e23c",
  legend: ["#e8d93e", "#9a62f2", "#e8d93e", "#f0a24e", "#e8d93e", "#e2e04a"],
  strip: "#43c6c4",
  stripText: "rgba(10,40,40,0.85)",
  areas: ["#ef6a3e", "#c9cf3e", "#e65a8c", "#f08a3a", "#c9cf3e", "#ef6a3e"],
  revenueArea: ["#1f4fd8", "#5f9cff"],
  revenueLine: "#e34848",
  lineChart: "#a453e6",
  negative: "#ea5250",
  statusDots: ["#e9d93a", "#ea4a4a", "#5aa0f0"],
  hudLine: "rgba(225,230,245,0.55)",
  accentNum: ["#f0a040", "#e9d93a"],
  gain: [1.0, 1.0, 1.04],
  lift: [0.0, 0.0, 0.004],
  saturation: 1.0,
};

/**
 * Version 2 — alternative colour palette: "Emerald & Gold".
 * Deep teal-black glass, emerald / gold / coral data, warm amber highlights.
 */
export const EMERALD_PALETTE: DashPalette = {
  name: "emerald",
  bg: [0.006, 0.03, 0.03],
  gridLine: "rgba(120,200,180,0.10)",
  panelTop: "rgba(22,62,58,0.70)",
  panelBottom: "rgba(8,34,34,0.66)",
  panelBorder: "rgba(150,235,205,0.45)",
  panelGlow: "rgba(120,240,200,0.10)",
  text: "#f4f1e4",
  textDim: "rgba(206,226,214,0.8)",
  textFaint: "rgba(160,200,185,0.45)",
  donut: ["#22d38f", "#f4c54a", "#ff6f61"],
  donutGlow: "rgba(40,220,150,0.45)",
  barLight: "#f6e3a6",
  barStrong: "#19b884",
  barDot: "#ffd34a",
  legend: ["#ffd34a", "#22d38f", "#ffd34a", "#ff8f5a", "#ffd34a", "#9ee86a"],
  strip: "#f2b33a",
  stripText: "rgba(50,30,0,0.85)",
  areas: ["#f4c54a", "#22d38f", "#ff6f61", "#9ee86a", "#f4c54a", "#22d38f"],
  revenueArea: ["#0e8f6a", "#4cf0b4"],
  revenueLine: "#ffb347",
  lineChart: "#f4c54a",
  negative: "#ff7a6b",
  statusDots: ["#ffd34a", "#ff6f61", "#22d38f"],
  hudLine: "rgba(220,250,235,0.55)",
  accentNum: ["#ffb347", "#ffd34a"],
  gain: [1.0, 1.02, 0.98],
  lift: [0.0, 0.004, 0.002],
  saturation: 1.05,
};
