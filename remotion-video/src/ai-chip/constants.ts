/** Reference clip is 20.00s at 30fps, 16:9. */
export const FPS = 30;
export const DURATION_IN_FRAMES = 600;

export const WIDTH_4K = 3840;
export const HEIGHT_4K = 2160;

export const WIDTH_1080 = 1920;
export const HEIGHT_1080 = 1080;

/** World units. The chip package is the size reference for everything else. */
export const CHIP_SIZE = 1.62;
export const CHIP_HEIGHT = 0.3;
export const CHIP_CORNER_RADIUS = 0.085;

/** Traces sit a hair above the substrate so they never z-fight with it. */
export const TRACE_Y = 0.006;
export const BOARD_EXTENT = 78;

/** Routes stop being drawn past this radius, so the horizon falls to black. */
export const TRACE_FADE_START = 16;
export const TRACE_FADE_END = 38;

export const PALETTE = {
  /** Resting colour of every conductor. */
  traceBlue: "#2569c6",
  /** Signal running along a net; a minority of nets run warm instead. */
  pulseBlue: "#a8dcff",
  pulseRed: "#ff3a1e",
  chipBody: "#040507",
  /** Neutral grey silhouette edge. The package is solid, so it never glows. */
  chipEdge: "#9aa0a8",
} as const;
