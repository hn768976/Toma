// Timing, geometry and palette for the "Infinite Zodiac Tunnel".
//
// The whole clip is a Droste construction: ONE wheel drawing, stamped at
// a run of scales that each halve the previous one. Over the loop a
// single zoom factor travels from 1x to 2x, so by the last frame every
// copy has grown into exactly the slot its larger neighbour occupied on
// frame 0 -- frame 450 is frame 0 again, with no cross-fade.
//
// Everything a copy looks like (size, rotation, opacity, blur, which mip
// it samples) is expressed as a pure function of its DEPTH, never of its
// array index. That is what makes the seam disappear: see depth() below.

export const FPS = 30;

// 15s. The zoom doubles exactly once across this span.
export const DURATION_IN_FRAMES = 450;

export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

export const SECTOR_COUNT = 12;
export const DEG_PER_SECTOR = 360 / SECTOR_COUNT; // 30 -- the loop's rotation

// How many nested stamps we draw. Depth runs 0..COPY_COUNT-1 on frame 0
// and slides down to -1..COPY_COUNT-2 by the last frame, so the opacity
// ramp has to be zero at BOTH ends (see opacityForDepth).
export const COPY_COUNT = 8;

// Outer radius of the depth-0 wheel, as a multiple of half the frame
// height. Above 1 so the widest wheel runs off the edges and only its
// glyphs and name band show in the corners, like the reference.
export const OUTER_RADIUS_FRACTION = 1.62;

// Each step inward loses this much brightness, measured from depth 0.5
// so the widest two copies already separate. 0.52^2.5 ~ 0.19 puts the
// third wheel in around the spec's innermost #3a3834, and everything
// past it walks down to black.
export const DEPTH_DIM_FACTOR = 0.52;

// Where the recession is cut off entirely. Without this the nested
// copies never stop -- they just pile denser and denser line work into
// the middle, and the tunnel reads as a flat mandala instead of a hole.
export const INNER_FADE_START = 4;
export const INNER_FADE_END = COPY_COUNT - 1;

// Depth at which blur reaches its maximum, and that maximum in 1x pixels.
export const BLUR_START_DEPTH = 1.2;
export const BLUR_FULL_DEPTH = 4.5;
export const BASE_MAX_BLUR_PX = 2.4;

// Master wheel bitmap edge length at 1x, doubled for 4K. A mip chain is
// derived from it by repeated halving so that no stamp ever samples an
// image less than half its own size -- that, not a shimmer hack, is what
// keeps the sub-pixel inner copies from crawling.
export const BASE_MASTER_SIZE = 2048;

// Wheel geometry, as fractions of the wheel's outer radius. The
// innermost ring sits just outside 0.5 because the NEXT copy's outer
// circle lands exactly on 0.5 -- the two read as one ring cluster.
export const WHEEL = {
  outerCircle: 1.0,
  nameRingInner: 0.855,
  nameBaseline: 0.9,
  glyphRingInner: 0.6,
  glyphCenter: 0.727,
  glyphSize: 0.212,
  tickOuter: 0.6,
  tickMinorInner: 0.572,
  tickMajorInner: 0.552,
  ringA: 0.548,
  ringB: 0.515,
  chordRadius: 0.515,
  dividerInner: 0.515,
  // {12/5} star polygon across the interior.
  chordStep: 5,
};

// Stroke weights, as fractions of the wheel's outer radius.
export const STROKE = {
  outerCircle: 0.0034,
  ring: 0.0026,
  divider: 0.0024,
  tickMinor: 0.0016,
  tickMajor: 0.0026,
  chord: 0.0015,
  glyph: 0.0102,
  text: 0.0036,
};

// Starfield. Twinkle periods all divide 450 evenly so the field is
// identical on the first and last frame.
export const STAR_COUNT = 1400;
export const STAR_TWINKLE_PERIODS = [90, 150, 225];

export type ZodiacTheme = {
  id: string;
  background: string;
  // Colour of the brightest (outermost) line work. Every dimmer copy is
  // this colour composited over the background at a lower alpha, which
  // is exactly how chalk dust thins out.
  lineColor: string;
  starColor: string;
  vignetteColor: string;
  grainOpacity: number;
};

export const CHALK_THEME: ZodiacTheme = {
  id: "chalk",
  background: "#000000",
  lineColor: "#e8e4dc",
  starColor: "#dcd8d0",
  vignetteColor: "rgba(0, 0, 0, 0.72)",
  grainOpacity: 0.02,
};

export const GOLD_THEME: ZodiacTheme = {
  id: "gold",
  background: "#060a18",
  lineColor: "#e0b850",
  starColor: "#ffe4b0",
  vignetteColor: "rgba(2, 4, 12, 0.74)",
  grainOpacity: 0.022,
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

// Depth of copy `index` at loop position `t` (0..1). At t = 1 copy k has
// slid to the depth copy k-1 held at t = 0, which is the entire trick.
export const depthOf = (index: number, t: number) => index - t;

export const radiusForDepth = (depth: number, outerRadius: number) =>
  outerRadius * Math.pow(2, -depth);

export const rotationForDepth = (depth: number) => -DEG_PER_SECTOR * depth;

// Zero at depth -1 (a copy that has grown past the frame) and zero again
// at depth COPY_COUNT-1 (a copy still too small to resolve). Both ends
// must vanish or the loop shows a seam.
export const opacityForDepth = (depth: number) => {
  const outerFade = smoothstep(-1, 0.1, depth);
  const falloff = Math.pow(DEPTH_DIM_FACTOR, Math.max(0, depth - 0.5));
  const innerTail = 1 - smoothstep(INNER_FADE_START, INNER_FADE_END, depth);
  return outerFade * falloff * innerTail;
};

export const blurForDepth = (depth: number, resolutionScale: number) =>
  BASE_MAX_BLUR_PX *
  resolutionScale *
  smoothstep(BLUR_START_DEPTH, BLUR_FULL_DEPTH, depth);
