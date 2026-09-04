// Timing, geometry, depth-of-field and colour configuration for the
// "Data Tunnel Flythrough" compositions.
//
// Everything here is resolution-independent: sizes and blur radii are
// authored against a 1080-pixel-tall reference frame and scaled at render
// time by (compositionHeight / REFERENCE_HEIGHT), so the 1080p preview and
// the 4K master stay visually identical.

export const FPS = 30;

// 15s. Every periodic quantity in the animation divides evenly into this
// so that frame 450 is byte-for-byte the same picture as frame 0.
export const DURATION_IN_FRAMES = 450;

// Compositions are authored at 4K; the preview is produced with --scale=0.5.
export const COMP_WIDTH = 3840;
export const COMP_HEIGHT = 2160;

// Sizes/blur radii below are given in pixels at this frame height.
export const REFERENCE_HEIGHT = 1080;

// ---------------------------------------------------------------------------
// Tunnel volume (world units, camera at the origin looking down -Z)
// ---------------------------------------------------------------------------

// Depth of the generated volume. The camera travels exactly this far over
// DURATION_IN_FRAMES, so every element recycles exactly once per loop and
// the cloud at the last frame is identical to the cloud at frame 0.
export const Z_TOTAL = 150;

// Number of grid rows down the tunnel axis. Z_TOTAL is an exact multiple of
// the row spacing, so the rows cycle exactly as well.
export const NZ = 120;
export const DZ = Z_TOTAL / NZ; // 1.25

// Rectangular cross-section: half-width / half-height of the four walls.
export const X_HALF = 9;
export const Y_HALF = 5.2;

// Wall grid resolution (points across each wall, per shell).
export const NX_WALL = 44; // top + bottom walls, across X
export const NY_WALL = 26; // left + right walls, across Y
export const WALL_SHELLS = 2; // stacked planes per wall, staggered
export const WALL_SHELL_INSET = 0.45; // world units between shells

// Sparser interior scatter filling the space between the walls.
export const NX_FILL = 15;
export const NY_FILL = 9;
export const FILL_SETS = 2;
export const FILL_EXTENT_X = 1; // fraction of X_HALF the fill spans
export const FILL_EXTENT_Y = 1;

// Position jitter as a fraction of the local grid spacing. Keeps the rows
// and columns readable (they are what produce the moire) without looking
// mechanical.
export const JITTER = 0.15;

export const FOV = 55; // vertical field of view, degrees

// Elements fade out as they sweep past the camera and fade in at the far
// end of the volume, which is what hides the recycling seam.
export const NEAR_FADE = 1.8;
export const FOG_START = 88;
export const FOG_END = 146;

// Depth over which the near -> mid -> far colour ramp is traversed.
export const COLOR_DEPTH = 70;

// Size attenuation: apparent size scales with ATT_REF / distance + ATT_BASE,
// normalised so an element at depth 60 renders at its authored size.
export const ATT_REF = 25;
export const ATT_BASE = 0.3;
export const SIZE_MAX = 55; // px at REFERENCE_HEIGHT, near-camera clamp

// Fraction of elements rendered as dashes (short segments along the travel
// axis) rather than dots.
export const DASH_FRACTION = 0.12;

// Projected length caps, in px at REFERENCE_HEIGHT. Without these a dash
// close to the camera sweeps most of the way across the frame.
export const DASH_MAX_LEN_PX = 12;
export const STREAK_MAX_LEN_PX = 300;

// Long, bright streaks passing close to the camera. Spread evenly through
// the volume so only a handful are ever inside the near band at once.
export const STREAK_COUNT = 24;
export const STREAK_VISIBLE_FROM = 40; // fully faded by this depth
export const STREAK_VISIBLE_TO = 11; // fully lit by this depth

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

// Vanishing point offset from frame centre, in normalised device coords
// (-1..1). Slightly above and left, as in the reference: the asymmetry is
// what stops the shot reading as a screensaver.
export const VP_OFFSET_X = -0.1;
export const VP_OFFSET_Y = 0.1;

// Gentle looping float. Amplitudes are world units; at the in-focus depth
// they move the image by well under 2% of the frame.
export const DRIFT_X = 0.2;
export const DRIFT_Y = 0.15;
export const DRIFT_PERIOD_X = DURATION_IN_FRAMES;
export const DRIFT_PERIOD_Y = DURATION_IN_FRAMES;
export const DRIFT_SECONDARY = 0.06;
export const DRIFT_SECONDARY_PERIOD = DURATION_IN_FRAMES / 2;
export const ROLL_DEGREES = 0.5; // +/- 0.5deg => 1deg peak to peak
export const ROLL_PERIOD = DURATION_IN_FRAMES;

// ---------------------------------------------------------------------------
// Depth of field
// ---------------------------------------------------------------------------

// Six depth buckets, each rendered to its own WebGL layer and composited
// additively. A single global blur would flatten the volume; separate
// layers keep the near smears, the sharp mid band and the soft far field
// genuinely independent.
//
// `blur` is the CSS blur radius in px at REFERENCE_HEIGHT.
// `renderScale` shrinks the layer's backing store: a layer that is about to
// be blurred by 21px carries no detail worth rendering at full resolution,
// and this is most of what makes the 4K pass affordable.
export type DepthBucket = {
  readonly near: number;
  readonly far: number;
  readonly blur: number;
  readonly renderScale: number;
};

const BUCKET_EDGES = [0, 3.5, 7.5, 13, 30, 75, Z_TOTAL];
const BUCKET_BLUR = [30, 13, 4.5, 0, 2.4, 6];
const BUCKET_RENDER_SCALE = [0.28, 0.4, 0.75, 1, 0.85, 0.5];

// Adjacent buckets cross-fade over a feather band so an element dissolves
// from one blur radius into the next instead of popping. The two ramps at a
// shared edge are complementary, so additive compositing preserves total
// brightness right through the hand-off.
const FEATHER_RATIO = 0.3;

export const bucketFeather = (edgeIndex: number): number => {
  if (edgeIndex <= 0 || edgeIndex >= BUCKET_EDGES.length - 1) {
    return 0;
  }
  const left = BUCKET_EDGES[edgeIndex] - BUCKET_EDGES[edgeIndex - 1];
  const right = BUCKET_EDGES[edgeIndex + 1] - BUCKET_EDGES[edgeIndex];
  return FEATHER_RATIO * Math.min(left, right);
};

export const DEPTH_BUCKETS: DepthBucket[] = BUCKET_BLUR.map((blur, i) => ({
  near: BUCKET_EDGES[i],
  far: BUCKET_EDGES[i + 1],
  blur,
  renderScale: BUCKET_RENDER_SCALE[i],
}));

export const BUCKET_FEATHERS = BUCKET_BLUR.map((_, i) => ({
  near: bucketFeather(i),
  far: bucketFeather(i + 1),
}));

// Bloom is confined to the bright streaks and the vanishing-point glow.
// Blooming the whole dot grid would merge the rows into a haze and lose the
// detail that makes this read as data rather than stars.
export const BLOOM_BLUR = 26; // px at REFERENCE_HEIGHT
export const BLOOM_RENDER_SCALE = 0.3;
export const BLOOM_WIDTH_GAIN = 2.6;
export const BLOOM_OPACITY = 0.55;

// ---------------------------------------------------------------------------
// Grain
// ---------------------------------------------------------------------------

export const GRAIN_TILE = 256; // px, generated once from a seeded PRNG
export const GRAIN_CELL = 2; // composition px per grain pixel
export const GRAIN_OPACITY = 0.02;
