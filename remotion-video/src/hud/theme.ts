/**
 * Colour systems for the HUD dashboard.
 *
 * Every panel reads its colours from a `HudTheme`, so a whole variant is a
 * palette swap plus a layout swap - no component knows which version it is in.
 */

export type HudTheme = {
  /** Deepest background, behind the tilted console plane. */
  void: string;
  /** The console surface itself. */
  surface: string;
  /** Slightly lifted surface used for panel fills. */
  surfaceRaised: string;
  /** Hairline grid and panel borders. */
  hairline: string;
  /** Structural strokes: axes, frames, dividers. */
  line: string;
  /** Body data: bars, plotted lines, dot fields. */
  mid: string;
  /** Emphasis: highlighted series, active segments, labels. */
  bright: string;
  /** Peak accent: readouts, cursors, the globe's landmass. */
  hot: string;
  /** Colour of the bloom that lifts the console off the background. */
  glow: string;
  /** Secondary accent, used sparingly for warnings and deltas. */
  warn: string;
};

export const GREEN_THEME: HudTheme = {
  void: "#02120e",
  surface: "#052a21",
  surfaceRaised: "#083a2d",
  hairline: "#106b50",
  line: "#189c73",
  mid: "#22cf90",
  bright: "#4df2b0",
  hot: "#8effd2",
  glow: "#14a878",
  warn: "#c9f56b",
};

export const BLUE_THEME: HudTheme = {
  void: "#030b1f",
  surface: "#0a1c3d",
  surfaceRaised: "#102a55",
  hairline: "#1a4a8e",
  line: "#2566bd",
  mid: "#3d92e8",
  bright: "#74bcff",
  hot: "#b6ddff",
  glow: "#2166bd",
  warn: "#7ce0e8",
};
