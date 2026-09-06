// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------
// The composition is authored at 4K so it can be rendered at full size later;
// the preview here is produced with `--scale=0.5`. Everything below is
// expressed in "reference pixels" at REF_WIDTH and multiplied by
// `width / REF_WIDTH` at draw time, so the look is identical at any output
// size (see `scaleOf()` in draw.ts).
export const REF_WIDTH = 3840;
export const REF_HEIGHT = 2160;

export const WIDTH = REF_WIDTH;
export const HEIGHT = REF_HEIGHT;
export const FPS = 30;

// 18s. Every node orbit has a period that divides this exactly, so frame 540
// is bit-identical to frame 0 and the clip loops seamlessly.
export const DURATION_IN_FRAMES = 540;

// ---------------------------------------------------------------------------
// The field
// ---------------------------------------------------------------------------
export const NODE_COUNT = 260;

// The volume extends past the frame on all sides so the field never shows an
// edge: nodes drifting off one side keep feeding connections back in.
export const FIELD_MARGIN_X = 0.24; // fraction of width, each side
export const FIELD_MARGIN_Y = 0.24; // fraction of height, each side

// Depth extent of the volume, in reference px, so that a `z` difference is
// directly comparable with an x/y difference in the 3D distance test below.
export const DEPTH_SPAN = 0.34 * REF_WIDTH;

// Two nodes are connected when their *3D* separation is under this (reference
// px). Screen-space distance would join nodes at wildly different depths,
// which reads as wrong immediately.
export const LINK_RADIUS = 0.215 * REF_WIDTH;

// A few dense knots against open space, rather than a uniform scatter. The
// knot centres sit on a jittered grid rather than at random: purely random
// centres clump, which leaves whole quadrants of the frame empty.
export const CLUSTER_COLS = 5;
export const CLUSTER_ROWS = 3;
export const CLUSTER_JITTER = 0.45; // of a cell, each way
export const CLUSTER_SHARE = 0.55; // fraction of nodes attached to a knot
export const CLUSTER_SIGMA_XY = 0.055; // fraction of the volume extent
// Deliberately wide: a knot whose nodes all share a depth reads as one flat
// patch of a single grey. Spreading depth within a knot is what interleaves
// near-black and pale hairlines the way the reference does.
export const CLUSTER_SIGMA_Z = 0.22;

// ---------------------------------------------------------------------------
// Depth -> appearance
// ---------------------------------------------------------------------------
// `zn` runs 0 (far) .. 1 (near) throughout. Tone is a gamma-shaped version of
// it: depth is distributed uniformly, but a linear ramp puts every in-focus
// node and line at a washed-out mid grey. Pulling tone up makes the sharp slab
// read genuinely dark, the way the near material does in the reference, while
// the far end still fades to almost nothing.
export const TONE_GAMMA = 0.66;

export const NODE_RADIUS_FAR = 2;
export const NODE_RADIUS_NEAR = 7.5;

export const NODE_GREY_FAR = [0xc8, 0xc8, 0xc8] as const;
export const NODE_GREY_NEAR = [0x1a, 0x1a, 0x1a] as const;
export const NODE_BLUE_FAR = [0xa8, 0xc8, 0xf0] as const;
export const NODE_BLUE_NEAR = [0x1f, 0x6f, 0xeb] as const;

// Lines never carry hue, in either version.
export const LINE_GREY_FAR = [0xd8, 0xd8, 0xd8] as const;
export const LINE_GREY_NEAR = [0x2a, 0x2a, 0x2a] as const;

export const LINE_WIDTH_FAR = 1;
export const LINE_WIDTH_NEAR = 2.5;

// Peak alpha of a connection at zero separation, by depth.
export const LINE_ALPHA_FAR = 0.26;
export const LINE_ALPHA_NEAR = 1;

export const ACCENT_SHARE = 0.2; // V2 only
// Accent nodes are drawn a touch larger. At the same radius a saturated blue
// dot on white reads as a stray pixel rather than a deliberate accent.
export const ACCENT_RADIUS_BOOST = 1.15;

// ---------------------------------------------------------------------------
// Depth of field
// ---------------------------------------------------------------------------
// Six depth buckets drawn far -> near, each with its own blur radius (in
// reference px). The sharp slab deliberately sits just behind the near plane
// rather than at the exact middle: that is where the dark, readable structure
// lives, and only the closest sixth blows out into soft blobs. A single global
// blur would flatten the field.
export const DEPTH_BUCKETS = 6;
export const BUCKET_BLUR = [10, 4.2, 1.1, 0, 0, 7] as const;

// Blurred buckets are rendered to a half-size scratch canvas — they are blurred
// anyway, so the lost resolution is invisible and the blur costs a quarter as
// much. The scratch canvas is oversized by this fraction so the blur has real
// content to pull from at the frame edges instead of fading into transparency.
export const SCRATCH_SCALE = 0.5;
export const SCRATCH_MARGIN = 0.05; // fraction of width

// ---------------------------------------------------------------------------
// Grain
// ---------------------------------------------------------------------------
// A trace only — white fields don't band, this just stops the flat white
// looking digitally sterile. Six tiles cycled by frame (540 % 6 === 0, so the
// grain loops with everything else).
export const GRAIN_TILES = 6;
export const GRAIN_TILE_SIZE = 512;
export const GRAIN_PIXEL_SCALE = 2; // reference px per grain pixel
export const GRAIN_ALPHA = 0.022;
export const GRAIN_RGB = [60, 60, 60] as const;

export const BACKGROUND = "#ffffff";
