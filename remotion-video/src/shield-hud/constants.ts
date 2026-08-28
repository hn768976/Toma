// Design space is the 4K composition itself: every coordinate in this
// project is a device pixel of the 3840x2160 canvas backing store.
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION_IN_FRAMES = 330;

// The plane the whole HUD sits on. One affine transform, applied via
// ctx.setTransform() — rotation plus a shear that lifts the right-hand
// side away from camera, plus a vertical compression that stands in for
// the ~7% foreshortening. Parallel lines stay parallel by design.
export const TILT = {
  rotationDeg: -12,
  skewYDeg: -6,
  compressY: 0.93,
};

// Depth-of-field buckets. Each buffer is blurred exactly once, when it is
// composited onto the frame. `scale` is the buffer's resolution relative
// to the 4K frame — a heavily blurred buffer carries no detail worth
// storing at full resolution, and the saving is what makes 4K tractable.
export const DEPTH = {
  far: { scale: 0.25, blur: 34 },
  mid: { scale: 0.5, blur: 16 },
  near: { scale: 0.5, blur: 6 },
  accent: { scale: 0.5, blur: 7 },
} as const;

export type DepthKey = keyof typeof DEPTH;

// Bloom applied to the glyph buffer before the sharp copy lands on top.
export const GLYPH_BLOOM = [
  { blur: 90, alpha: 0.42 },
  { blur: 34, alpha: 0.46 },
];

export const ACCENT_BLOOM = { blur: 26, alpha: 0.33 };

export const VIGNETTE_STRENGTH = 0.22;
export const GRAIN_ALPHA = 0.04;

// The glyph's glow breathes on a sine whose period divides 330, so the
// loop closes.
export const BREATH_PERIOD = 110;
export const BREATH_DEPTH = 0.1;

// Ambient drift of the whole plane: a closed Lissajous figure, +/-14px,
// back at its start on frame 330.
export const DRIFT_AMPLITUDE = 14;
