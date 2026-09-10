/**
 * The depth model. Every element carries a bucket index; the bucket alone
 * decides blur, drift speed and the brightness envelope, so buckets can be
 * composited back-to-front as coherent layers. Size and colour jitter per
 * element within a bucket.
 *
 * All pixel-valued helpers take the frame height so sizes and blur radii stay
 * fractions of the frame: rendering at 1080p is a linear scale of 4K.
 */
export const BUCKETS = 8;

/** 0 = farthest, 1 = nearest. */
export const depthOf = (bucket: number) => (bucket + 0.5) / BUCKETS;

/** Relative element size. Near elements are ~6x the far ones. */
export const sizeMul = (d: number) => 0.42 + 4.1 * Math.pow(d, 1.45);

/**
 * Blur radius in px. Near elements are heavy smears, there is a sharp band
 * around d = 0.5, and the far field softens again — the classic two-sided
 * depth-of-field falloff rather than a single global blur.
 */
export const blurPx = (d: number, height: number) => {
  if (d >= 0.5) {
    const t = (d - 0.5) / 0.5;
    return height * 0.0165 * Math.pow(t, 1.7);
  }
  const t = (0.5 - d) / 0.5;
  return height * 0.0013 * Math.pow(t, 1.4);
};

/**
 * Opacity envelope: brightest through the sharp mid band, faint far away and
 * dim (never glowing) up close, so the depth cannot read inverted.
 */
export const depthAlpha = (d: number) => {
  const bell = Math.exp(-((d - 0.52) * (d - 0.52)) / (2 * 0.26 * 0.26));
  const nearDim = 1 - 0.32 * Math.max(0, d - 0.5) * 2;
  return (0.16 + 0.84 * bell) * nearDim;
};

/**
 * Lateral sway amplitude as a fraction of frame width. Near elements travel
 * several times farther per cycle than far ones — this parallax is what
 * creates the depth, since there is no camera.
 */
export const swayAmpX = (d: number) => 0.028 + 0.20 * Math.pow(d, 1.5);

/** Vertical sway is a small fraction of the lateral movement. */
export const swayAmpY = (d: number) => swayAmpX(d) * 0.26;
