// Timing, camera and geometry config for the global market dot-map.
//
// The reference clip this matches is 12.017s of 60fps footage; we deliver
// 12.000s at 30fps (360 frames), which is 17ms shorter - imperceptible, and
// 360 factorises cleanly (2^3 * 3^2 * 5) so every periodic motion below can
// be given a period that divides the clip exactly and the whole thing loops
// seamlessly.
//
// Everything here is authored at 1x (1080p) and derived for other
// resolutions through computeGeometry(), so the 1080p and 4K compositions
// stay visually identical.

export const FPS = 30;
export const DURATION_IN_FRAMES = 360; // 12.000s

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

// --- Camera -------------------------------------------------------------
// Horizontal field of view. Narrow enough that the perspective reads as a
// long lens looking at a tilted plane rather than a wide-angle fisheye.
export const FOV_DEG = 42;

// The map is a flat plane MAP_WORLD_WIDTH units wide, held at
// CAMERA_DISTANCE units in front of the camera. At 42 degrees FOV that
// puts the map slightly wider than the frame, so the continents run off
// both edges the way they do in the reference.
export const MAP_WORLD_WIDTH = 2.3;
export const CAMERA_DISTANCE = 2.15;

// Plane attitude, in degrees. Pitch tilts the far (northern) edge away
// from the camera, which is what puts the vanishing point above frame
// centre and foreshortens the top of the map.
export const PITCH_BASE_DEG = 28;
export const PITCH_AMP_DEG = 3.5;
export const YAW_BASE_DEG = -3;
export const YAW_AMP_DEG = 9;
export const ROLL_AMP_DEG = 1.4;

// Slow drift of the camera across and along the plane.
export const PAN_X_AMP = 0.1;
export const PAN_Y_AMP = 0.05;
export const DOLLY_AMP = 0.14;

// Motion periods, in frames. Each divides DURATION_IN_FRAMES so frame 0
// and frame 360 line up and the clip loops.
export const YAW_PERIOD = 360;
export const PITCH_PERIOD = 360;
export const ROLL_PERIOD = 180;
export const DOLLY_PERIOD = 360;
export const PAN_PERIOD = 360;

// --- Map dots -----------------------------------------------------------
// Dot radius at nominal depth, in px at 1x. Actual radius is this times
// the per-dot perspective scale, so near dots are fatter than far ones.
export const BASE_DOT_RADIUS = 2;
export const DOT_SHIMMER_PERIOD = 45;
export const DOT_WAVE_PERIOD = 180; // slow brightness wave sweeping the map

// --- Ground grid --------------------------------------------------------
// Authored directly in plane units rather than in degrees: it is a grid
// ruled on the plane the map sits on, not a graticule on a globe, and it
// has to run past the edges of the continents.
//
// The bounds are cut to what the camera can actually see. At this focal
// length and pitch the plane leaves the top of frame around v = 0.63 and
// the bottom around v = -0.75 (the vanishing point is ~5600px above frame
// centre, so there is no horizon in shot - same as the reference), and the
// extra margin here just covers the camera's drift.
export const GRID_U_MIN = -1.8;
export const GRID_U_MAX = 1.8;
export const GRID_V_MIN = -1.15;
export const GRID_V_MAX = 0.95;
export const GRID_LINE_SPACING = 0.15;
// Spacing of the dots along each grid line. Stepped in plane space and
// then projected, so the dots tighten towards the vanishing point on their
// own instead of being faked in screen space.
export const GRID_DOT_SPACING = 0.045;
export const BASE_GRID_DOT_RADIUS = 1.05;

// --- Background candlestick series --------------------------------------
// A faint candlestick chart laid on the same plane, behind the dot map:
// it is what makes a still frame read as "market", and it is the element
// that flips direction between the bearish and bullish cuts.
export const CANDLE_COUNT = 72;
// Half-widths, in plane units. The body must stay clearly narrower than
// the per-candle spacing ((CANDLE_U_MAX - CANDLE_U_MIN) / CANDLE_COUNT) or
// adjacent bodies touch and the series fuses into one solid band.
export const CANDLE_BODY_WIDTH = 0.0098;
export const CANDLE_WICK_WIDTH = 0.0018;
// Extent of the series across the plane, and the band the price axis is
// mapped into, both in plane units.
export const CANDLE_U_MIN = -1.15;
export const CANDLE_U_MAX = 1.15;
export const CANDLE_V_MIN = -0.38;
export const CANDLE_V_MAX = 0.46;

// --- Data streaks -------------------------------------------------------
// Vertical light shafts that rake down the plane (bearish) or up it
// (bullish), standing in for falling / rising prices.
export const STREAK_COUNT = 26;
export const STREAK_PERIOD = 90;
export const BASE_STREAK_WIDTH = 2.1;

// --- Tickers ------------------------------------------------------------
export const TICKER_COUNT = 56;
export const TICKER_PERIOD = 90;
export const BASE_TICKER_FONT_SIZE = 23;
// Some tickers re-roll their value every few frames so the frame always
// has a couple of digits actively churning.
export const TICKER_FAST_TICK_FRAMES = 8;
// Period of the gentle float tickers ride on. Divides the clip length so
// the motion loops with everything else.
export const TICKER_BOB_PERIOD = 120;

// --- Atmosphere ---------------------------------------------------------
export const HAZE_BLOB_COUNT = 7;
export const HAZE_PERIOD = 360;
export const BASE_BLUR_PX = 15; // glow-layer CSS blur radius, at 1x

export type MapGeometry = {
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  focal: number;
  sizeScale: number;
  dotRadius: number;
  gridDotRadius: number;
  streakWidth: number;
  tickerFontSize: number;
  blurPx: number;
};

// Derives render geometry for a resolution multiple (1 = 1080p, 2 = 4K).
//
// Note this deliberately differs from the particle-ring module: there,
// particle COUNTS scale with resolution because the ring is a cloud with
// no fixed identity. Here the dot lattice is fixed geometry - the map has
// a specific number of LEDs - so counts stay constant at every resolution
// and only sizes scale. Otherwise 4K would render a denser, different map.
export const computeGeometry = (resolutionScale: number): MapGeometry => {
  const width = BASE_WIDTH * resolutionScale;
  const height = BASE_HEIGHT * resolutionScale;
  return {
    width,
    height,
    centerX: width / 2,
    centerY: height / 2,
    // Focal length in px for the configured FOV. Derived from width so the
    // framing is identical at every output resolution.
    focal: width / 2 / Math.tan((FOV_DEG * Math.PI) / 360),
    sizeScale: resolutionScale,
    dotRadius: BASE_DOT_RADIUS * resolutionScale,
    gridDotRadius: BASE_GRID_DOT_RADIUS * resolutionScale,
    streakWidth: BASE_STREAK_WIDTH * resolutionScale,
    tickerFontSize: BASE_TICKER_FONT_SIZE * resolutionScale,
    blurPx: BASE_BLUR_PX * resolutionScale,
  };
};
