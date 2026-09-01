/**
 * theme.ts — the DEMO's palette.
 *
 * This file exists in the demo, not in the library, and that is the
 * point: every colour below is passed INTO library components as a
 * parameter. Nothing in remotion-lib/src contains a colour. Swap these
 * values and every panel re-skins with no library change.
 */
export const THEME = {
  background: "#070911",
  panel: "#0c1020",
  ink: "#e8edff",
  inkDim: "#8a93b8",
  grid: "rgba(150, 170, 255, 0.10)",

  accent: "#4a7dff",
  accentSoft: "#a9c2ff",
  hot: "#eaf3ff",
  warm: "#ff9d4a",
  cool: "#38e2d0",
  magenta: "#e35ad4",
  land: "#2f6fed",
  coast: "#7fe9ff",

  vignette: "rgba(2, 3, 8, 0.62)",
} as const;

export const FONT =
  '"SF Mono", "JetBrains Mono", "Fira Code", ui-monospace, monospace';
