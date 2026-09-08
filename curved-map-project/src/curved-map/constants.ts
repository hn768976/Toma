/**
 * Composition-wide constants: video format, the cylindrical screen geometry
 * that the flat composite is warped onto, and the two colour palettes.
 */

export const VIDEO_WIDTH = 3840;
export const VIDEO_HEIGHT = 2160;
export const FPS = 30;
export const DURATION_IN_FRAMES = 450;

/**
 * The display is a cylinder with a vertical axis, seen head on: horizontal
 * lines bow toward the centre at the left and right edges and the surface
 * foreshortens there.
 *
 * THETA_MAX is the half sweep of the visible surface in radians, CAM_DISTANCE
 * the camera distance from the cylinder axis measured in cylinder radii.
 */
export const THETA_MAX = 0.88;
export const CAM_DISTANCE = 2.15;

/** Projected half-width of the surface, in units of the focal length. */
export const P_MAX =
  Math.sin(THETA_MAX) / (CAM_DISTANCE - Math.cos(THETA_MAX));

/**
 * How much taller the flat composite has to be than the frame: the corners
 * pull texture from beyond the frame's own vertical extent.
 */
export const OVERSCAN =
  (CAM_DISTANCE - Math.cos(THETA_MAX)) / (CAM_DISTANCE - 1);

/**
 * Flat composite size. FLAT_WIDTH is chosen so the warp samples the texture
 * 1:1 at the centre of the frame — no magnification, so dots stay crisp.
 * At a 1080p preview render the same texture is 2x supersampled.
 */
export const FLAT_WIDTH = Math.round(
  (VIDEO_WIDTH * THETA_MAX) / ((CAM_DISTANCE - 1) * P_MAX),
);
export const FLAT_HEIGHT = Math.round(VIDEO_HEIGHT * OVERSCAN);

/**
 * The vertical band of the flat composite that is actually visible at the
 * centre of the frame. Everything outside it is the overscan the corners pull
 * from, so anything meant to be seen has to be placed inside it.
 */
export const VISIBLE_Y = (FLAT_HEIGHT - VIDEO_HEIGHT) / 2;

/** Flat y for a fraction of the visible height, 0 at the top of the frame. */
export const visibleY = (fraction: number): number =>
  VISIBLE_Y + fraction * VIDEO_HEIGHT;

/** Geographic extent of the plotted map. Poles are cropped, as in the reference. */
export const MAP_LAT_TOP = 72;
export const MAP_LAT_BOTTOM = -54;

/** The map rectangle inside the flat composite, in flat pixels. */
export const MAP_WIDTH = Math.round(FLAT_WIDTH * 0.97);
export const MAP_HEIGHT = Math.round(
  (MAP_WIDTH / 2) * ((MAP_LAT_TOP - MAP_LAT_BOTTOM) / 180),
);
export const MAP_X = Math.round((FLAT_WIDTH - MAP_WIDTH) / 2);
export const MAP_Y = Math.round(
  VISIBLE_Y + (VIDEO_HEIGHT - MAP_HEIGHT) / 2 - VIDEO_HEIGHT * 0.012,
);

/** Spacing of the dot matrix, in flat pixels. */
export const DOT_STEP = 7;

export type Palette = {
  readonly id: string;
  /** Background, corner to behind-the-map. */
  readonly bgOuter: string;
  readonly bgInner: string;
  readonly grid: string;
  readonly gridAlpha: number;
  readonly dot: string;
  readonly dotAccent: string;
  readonly regionGlow: string;
  readonly chart: string;
  readonly chartGlow: string;
  readonly label: string;
  readonly arc: string;
  readonly arcNode: string;
  readonly bar: string;
  readonly barHighlight: string;
  readonly uiTexture: string;
};

export const PALETTE_BLUE: Palette = {
  id: "blue",
  bgOuter: "#020814",
  bgInner: "#0a2038",
  grid: "#1a4a7a",
  gridAlpha: 0.44,
  dot: "#4a9fe8",
  dotAccent: "#c8e8ff",
  regionGlow: "#2a72c0",
  chart: "#f0f6ff",
  chartGlow: "#9fd0ff",
  label: "#8fc0ea",
  arc: "#a8d4ff",
  arcNode: "#eaf6ff",
  bar: "#2f8ae0",
  barHighlight: "#d4ecff",
  uiTexture: "#3f7fb8",
};

export const PALETTE_AMBER: Palette = {
  id: "amber",
  bgOuter: "#0a0602",
  bgInner: "#241404",
  grid: "#6a4a10",
  gridAlpha: 0.44,
  dot: "#e0a040",
  dotAccent: "#ffe8b0",
  regionGlow: "#a06818",
  chart: "#fff4e0",
  chartGlow: "#ffcf82",
  label: "#d5a86a",
  arc: "#ffd090",
  arcNode: "#fff6e4",
  bar: "#d08a20",
  barHighlight: "#ffe9c0",
  uiTexture: "#a9762a",
};

/** Build timing, in frames. */
export const TIMING = {
  charts: [
    { start: 40, end: 150 },
    { start: 160, end: 280 },
    { start: 200, end: 300 },
  ],
  arcsStart: 100,
  arcsEnd: 220,
  barsStart: 240,
  barsEnd: 340,
} as const;
