// Composition ------------------------------------------------------------

export const FPS = 30;
export const DURATION_IN_FRAMES = 600; // 20s
export const COMP_WIDTH = 3840;
export const COMP_HEIGHT = 2160;

// Scene ------------------------------------------------------------------
//
// World units are arbitrary but everything below is expressed in them, so the
// scene is resolution independent: the composition renders identically at
// 1080p and 4K, only the pixel-space line width scales (see PIXEL constants).

/** Half the width of the ground plane. Wide enough that strokes run off both
 *  edges of frame at every depth. */
export const PLANE_HALF_WIDTH = 26;

/** Nearest row of strokes — behind the bottom edge of frame. */
export const Z_NEAR = 4;
/** Farthest row. The camera looks straight at (0, 0, Z_FAR), which puts the
 *  far edge of the band exactly on the vertical midpoint of the frame; the
 *  strokes have faded out well before they reach it, so the top half of the
 *  frame stays clean white. */
export const Z_FAR = -34;

export const CAMERA_POSITION: readonly [number, number, number] = [0, 2.4, 10];
export const CAMERA_TARGET: readonly [number, number, number] = [0, 0, Z_FAR];
/** Vertical field of view. Combined with the camera height this puts the
 *  viewer ~3 degrees above the mean surface at the far edge and ~16 degrees
 *  above it at the bottom of frame: the band compresses into the lower half. */
export const CAMERA_FOV = 26;

// Stroke grid ------------------------------------------------------------

/** Lines running away from the viewer, spread across PLANE_HALF_WIDTH * 2. */
export const LINE_COUNT = 560;
/** Samples along each line. Consecutive samples are joined by one quad, so a
 *  line is a continuous polyline of ROW_COUNT - 1 segments. */
export const ROW_COUNT = 190;
export const SEGMENT_COUNT = LINE_COUNT * (ROW_COUNT - 1);

// Pixel space ------------------------------------------------------------

/** Stroke width in *composition* pixels, i.e. at 3840x2160. The shader
 *  converts to device pixels through the drawing buffer size, so the stroke is
 *  the same weight relative to the frame at every render scale.
 *
 *  Worth knowing: `--scale` changes the browser's device scale factor but not
 *  the WebGL drawing buffer, which stays at 3840x2160. A 1080p preview is
 *  therefore a 2x supersample of the 4K frame, not a cheaper render of a
 *  smaller one — which is where much of its anti-aliasing quality comes
 *  from. */
export const LINE_WIDTH_PX = 1.15;
/** Half-width, in device pixels, below which the shader stops thinning a
 *  stroke and starts fading its alpha instead. A stroke that drops under a
 *  pixel and flickers on and off between frames is far worse than one that is
 *  simply faint. At the widths above this guard is dormant; it is what keeps
 *  LINE_WIDTH_PX safe to lower. */
export const MIN_HALF_WIDTH_PX = 0.45;
/** Depth-of-field: extra blur radius, in composition pixels, applied to the
 *  strokes closest to the camera. Deliberately gentle — heavy blur on a pale
 *  subject just erases it. */
export const NEAR_SOFTNESS_PX = 2.0;

// Palettes ---------------------------------------------------------------

export type Palette = {
  /** Far edge of the band, a hair off white. */
  far: string;
  /** Body of the band. */
  mid: string;
  /** Strokes on a crest. */
  dark: string;
  /** A minority of strokes on the leading crest, for definition. */
  accent: string;
};

export const PALETTE_BLUE: Palette = {
  far: "#e8f2fa",
  mid: "#a8cfe8",
  dark: "#4a90c8",
  accent: "#2a78b8",
};

export const PALETTE_GRAPHITE: Palette = {
  far: "#f2efec",
  mid: "#c8bfb4",
  dark: "#8a7a6a",
  accent: "#6d5f52",
};

export const BACKGROUND = "#ffffff";

/** Opacity of a single stroke. Low enough that the tone of a region is set by
 *  how many strokes overlap in it rather than by any one of them. */
export const BASE_ALPHA = 0.82;
