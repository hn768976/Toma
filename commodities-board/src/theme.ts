export type ThemeName = "dark" | "light";

export type Theme = {
  name: ThemeName;
  backgroundFrom: string;
  backgroundTo: string;
  gridLine: string;
  mapLand: string;
  mapLandStroke: string;
  networkLine: string;
  markerStroke: string;
  markerFill: string;
  barFrom: string;
  barTo: string;
  barHighlight: string;
  barText: string;
  barShadow: string;
  rowText: string;
  priceText: string;
  rowRule: string;
  rowBand: string;
  up: string;
  down: string;
  /** Where a ticking percentage flashes to, and how hard. */
  flashTowardWhite: boolean;
  flashAmount: number;
  flashGlow: number;
  grainOpacity: number;
  bloomOpacity: number;
  vignetteOpacity: number;
};

export const THEMES: Record<ThemeName, Theme> = {
  dark: {
    name: "dark",
    backgroundFrom: "#0a1a2e",
    backgroundTo: "#040a14",
    gridLine: "rgba(120,170,220,0.055)",
    mapLand: "rgba(30,74,122,0.30)",
    mapLandStroke: "rgba(72,140,210,0.42)",
    networkLine: "#3f8ed6",
    markerStroke: "rgba(140,200,255,0.75)",
    markerFill: "rgba(10,30,55,0.65)",
    barFrom: "#e8eaec",
    barTo: "#9aa3ac",
    barHighlight: "rgba(255,255,255,0.95)",
    barText: "#111111",
    barShadow: "rgba(0,0,0,0.55)",
    rowText: "#f0f4f8",
    priceText: "#ffffff",
    rowRule: "rgba(150,190,230,0.13)",
    rowBand: "rgba(150,195,240,0.062)",
    up: "#16c784",
    down: "#ea3943",
    flashTowardWhite: true,
    flashAmount: 0.55,
    flashGlow: 0.5,
    grainOpacity: 0.02,
    bloomOpacity: 0.22,
    vignetteOpacity: 0.62,
  },
  light: {
    name: "light",
    backgroundFrom: "#ffffff",
    backgroundTo: "#f2f4f6",
    gridLine: "rgba(30,60,95,0.05)",
    mapLand: "rgba(200,216,232,0.85)",
    mapLandStroke: "rgba(168,192,216,0.9)",
    networkLine: "#9db9d4",
    markerStroke: "rgba(120,150,180,0.8)",
    markerFill: "rgba(255,255,255,0.8)",
    barFrom: "#23272c",
    barTo: "#101317",
    barHighlight: "rgba(255,255,255,0.18)",
    barText: "#ffffff",
    barShadow: "rgba(20,30,45,0.22)",
    rowText: "#14181d",
    priceText: "#14181d",
    rowRule: "rgba(20,30,45,0.1)",
    rowBand: "rgba(20,40,70,0.05)",
    up: "#0f9d68",
    down: "#c9252f",
    // On white, flashing toward white would erase the number; go the other way.
    flashTowardWhite: false,
    flashAmount: 0.4,
    flashGlow: 0,
    grainOpacity: 0.006,
    bloomOpacity: 0,
    vignetteOpacity: 0,
  },
};
