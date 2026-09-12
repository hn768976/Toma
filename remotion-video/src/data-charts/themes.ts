// Two colorways for the same scene. "dark" follows the reference footage
// (hazy steel-blue dashboard); "light" is the same design on an airy,
// white-blue background with navy data marks.

export type ThemeName = "dark" | "light";

export type Theme = {
  name: ThemeName;
  // Scene background (top -> bottom vertical gradient).
  backgroundTop: string;
  backgroundBottom: string;
  // Floor grid.
  floorFill: string;
  gridLine: string;
  gridLineMajor: string;
  // Panels.
  panelFill: string;
  panelFillStrong: string;
  panelBorder: string;
  panelGlow: string;
  panelGridLine: string;
  // Data marks.
  accent: string; // primary blue
  accentSoft: string; // translucent primary
  accentAlt: string; // cyan/secondary
  highlight: string; // brightest mark (bars, key ring)
  highlightSoft: string;
  text: string;
  textDim: string;
  // Overlays.
  vignette: string;
  haze: string;
  dust: string;
  dustBlend: "screen" | "multiply";
};

export const DARK_THEME: Theme = {
  name: "dark",
  backgroundTop: "#2a3457",
  backgroundBottom: "#0c1226",
  floorFill: "rgba(38, 48, 84, 0.72)",
  gridLine: "rgba(150, 175, 235, 0.16)",
  gridLineMajor: "rgba(150, 175, 235, 0.30)",
  panelFill: "rgba(52, 66, 112, 0.42)",
  panelFillStrong: "rgba(70, 88, 140, 0.55)",
  panelBorder: "rgba(160, 185, 240, 0.40)",
  panelGlow: "rgba(90, 140, 255, 0.22)",
  panelGridLine: "rgba(160, 185, 240, 0.13)",
  accent: "#4f8dff",
  accentSoft: "rgba(79, 141, 255, 0.35)",
  accentAlt: "#8cd6ff",
  highlight: "#eef3ff",
  highlightSoft: "rgba(238, 243, 255, 0.55)",
  text: "rgba(235, 241, 255, 0.92)",
  textDim: "rgba(190, 205, 240, 0.55)",
  vignette: "rgba(6, 9, 22, 0.78)",
  haze: "rgba(140, 175, 255, 0.22)",
  dust: "rgba(190, 215, 255, 0.55)",
  dustBlend: "screen",
};

export const LIGHT_THEME: Theme = {
  name: "light",
  backgroundTop: "#f6f9ff",
  backgroundBottom: "#d6e2f5",
  floorFill: "rgba(255, 255, 255, 0.55)",
  gridLine: "rgba(60, 100, 190, 0.13)",
  gridLineMajor: "rgba(60, 100, 190, 0.24)",
  panelFill: "rgba(255, 255, 255, 0.62)",
  panelFillStrong: "rgba(255, 255, 255, 0.85)",
  panelBorder: "rgba(70, 110, 200, 0.35)",
  panelGlow: "rgba(70, 120, 230, 0.16)",
  panelGridLine: "rgba(60, 100, 190, 0.11)",
  accent: "#2f6fe8",
  accentSoft: "rgba(47, 111, 232, 0.30)",
  accentAlt: "#1fa8d8",
  highlight: "#173a8a",
  highlightSoft: "rgba(23, 58, 138, 0.55)",
  text: "rgba(20, 34, 70, 0.92)",
  textDim: "rgba(40, 62, 110, 0.55)",
  vignette: "rgba(120, 150, 210, 0.45)",
  haze: "rgba(255, 255, 255, 0.55)",
  dust: "rgba(60, 110, 220, 0.30)",
  dustBlend: "multiply",
};

export const THEMES: Record<ThemeName, Theme> = {
  dark: DARK_THEME,
  light: LIGHT_THEME,
};
