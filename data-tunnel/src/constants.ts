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
export const NZ = 100;
export const DZ = Z_TOTAL / NZ; // 1.5

// Rectangular cross-section: half-width / half-height of the four walls.
export const X_HALF = 9;
export const Y_HALF = 5.2;

// Base grid spacing on the wall planes, world units.
export const WALL_SPACING_X = 0.41;
export const WALL_SPACING_Y = 0.4;

export type WallShell = {
  /** Offset outward from the nominal wall plane, world units. */
  readonly offset: number;
  /** Grid spacing multiplier - outer shells are coarser. */
  readonly step: number;
  readonly bright: number;
};

// Wall shells, innermost first. The first two are the visible walls of the
// corridor. The outer three are a sparser, dimmer mantle carrying the field
// out past the frame edges: a ray toward the frame corner leaves the inner
// box about ten units out, and without anything beyond it the shot sits in
// a rectangle in the middle of the frame instead of filling it.
// The mantle falls off steeply in both density and brightness, so the step
// at the wall plane still reads as a wall - a mantle carried at anything
// like the wall's own weight flattens the corridor back into a plain radial
// burst.
export const WALL_SHELLS: readonly WallShell[] = [
  { offset: -0.5, step: 1, bright: 1.5 },
  { offset: 0, step: 1, bright: 1.5 },
  // A deliberate gap before the mantle starts. The dark band just outside
  // the wall plane is what lets the wall read as a wall now that there is
  // material beyond it.
  { offset: 3, step: 2.4, bright: 0.34 },
  { offset: 6.5, step: 4, bright: 0.2 },
  { offset: 11.5, step: 6, bright: 0.13 },
  { offset: 18, step: 10, bright: 0.09 },
];

// Sparser interior scatter filling the space between the walls.
export const NX_FILL = 12;
export const NY_FILL = 7;
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

// Projected length cap, in px at REFERENCE_HEIGHT. Without it a dash close
// to the camera sweeps most of the way across the frame.
export const DASH_MAX_LEN_PX = 12;

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

// Vanishing point offset from frame centre, in normalised device coords
// (-1..1). Slightly above and left, as in the reference: the asymmetry is
// what stops the shot reading as a screensaver.
export const VP_OFFSET_X = -0.08;
export const VP_OFFSET_Y = 0.08;

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

// ---------------------------------------------------------------------------
// Grain
// ---------------------------------------------------------------------------

export const GRAIN_TILE = 256; // px, generated once from a seeded PRNG
export const GRAIN_CELL = 2; // composition px per grain pixel
export const GRAIN_OPACITY = 0.02;
