export type ThemeName = "dark" | "light";

export type Theme = {
  background: string;
  /** Ink used for axes, grid and text — alpha is applied per element. */
  ink: string;
  series: string;
  /** Glow reads as a rendering artifact on a light ground, so V4 drops it. */
  glow: boolean;
  alpha: {
    axis: number;
    gridVertical: number;
    gridHorizontal: number;
    title: number;
    subtitle: number;
    yLabel: number;
    xLabel: number;
  };
};

const CYAN = "#22d3ee";

export const THEMES: Record<ThemeName, Theme> = {
  dark: {
    background: "#050505",
    ink: "#ffffff",
    series: CYAN,
    glow: true,
    alpha: {
      axis: 0.85,
      gridVertical: 0.2,
      gridHorizontal: 0.1,
      title: 1,
      subtitle: 0.7,
      yLabel: 0.75,
      xLabel: 0.6,
    },
  },
  light: {
    background: "#f5f6f8",
    ink: "#1a1a1a",
    series: CYAN,
    glow: false,
    alpha: {
      axis: 0.8,
      gridVertical: 0.12,
      gridHorizontal: 0.08,
      title: 1,
      subtitle: 0.65,
      yLabel: 0.75,
      xLabel: 0.6,
    },
  },
};

/** Text ink for the light theme is #111111 rather than the grid's #1a1a1a. */
export const textInk = (theme: ThemeName) =>
  theme === "light" ? "#111111" : "#ffffff";

export const FONT_FAMILY =
  '"Inter", "Helvetica Neue", Helvetica, Arial, sans-serif';
