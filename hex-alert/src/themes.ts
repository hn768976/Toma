export type Theme = {
  background: string;
  /** The dim texture layer — deliberately low contrast. */
  base: string;
  /** Third tier of emphasis: brighter, still unfilled. */
  bright: string;
  primary: { bg: string; fg: string };
  secondary: { bg: string; fg: string };
  /** Colour of the soft screen-glow lift in the upper third. */
  glow: string;
};

export const CYAN_THEME: Theme = {
  background: "#050505",
  base: "rgba(226, 232, 240, 0.45)",
  bright: "rgba(244, 248, 252, 0.92)",
  primary: { bg: "#22d3ee", fg: "#04141a" },
  secondary: { bg: "#facc15", fg: "#1a1400" },
  glow: "34, 211, 238",
};

export const GREEN_THEME: Theme = {
  background: "#040705",
  base: "rgba(150, 255, 178, 0.45)",
  bright: "rgba(214, 255, 226, 0.92)",
  primary: { bg: "#4ade80", fg: "#03150a" },
  secondary: { bg: "#facc15", fg: "#1a1400" },
  glow: "74, 222, 128",
};
