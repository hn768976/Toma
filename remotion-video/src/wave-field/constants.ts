/**
 * Fixed geometry and finishing constants shared by every wave-field variant.
 * Anything a variant is allowed to change lives in `variants.ts` instead.
 */

export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;

/** 450 frames @ 30fps = 15.0s. Every periodic quantity closes over this. */
export const DURATION_IN_FRAMES = 450;

export const TAU = Math.PI * 2;

/** Bands run this far from horizontal; negative rises to the right. */
export const BAND_ANGLE_DEG = -32;
const BAND_ANGLE = (BAND_ANGLE_DEG * Math.PI) / 180;

/** Unit vector along a band, from its lower-left end to its upper-right end. */
export const ALONG_X = Math.cos(BAND_ANGLE);
export const ALONG_Y = Math.sin(BAND_ANGLE);

/** Unit vector perpendicular to a band, pointing down into its surface. */
export const DOWN_X = -ALONG_Y;
export const DOWN_Y = ALONG_X;

/**
 * Length of a band in band-local space. Bands are drawn over
 * s in [-BAND_LENGTH / 2, BAND_LENGTH / 2], which overruns the 4K frame at
 * both ends, and every wave is periodic over BAND_LENGTH so drifting
 * particles can wrap without a visible seam.
 */
export const BAND_LENGTH = 6000;

/**
 * Wave amplitude at the leading edge, as a fraction of the amplitude at the
 * band's lower fringe. The edge still clearly traces the crest, but the
 * surface below it swings wider, which is what makes a band read as a
 * surface hanging off the edge rather than as a rigid ribbon.
 */
export const EDGE_AMPLITUDE_RATIO = 0.4;

export const DEPTH_BUCKETS = ["far", "mid", "near"] as const;
export type DepthBucket = (typeof DEPTH_BUCKETS)[number];

/**
 * Depth-of-field blur applied ONCE to each depth buffer, in 4K pixels.
 * Focus sits in the middle distance, so the nearest band is the softest.
 */
export const DOF_BLUR_PX: Record<DepthBucket, number> = {
  far: 3,
  mid: 9,
  near: 22,
};

/** Downscale factor used when blurring each depth buffer, chosen per radius. */
export const DOF_DOWNSCALE: Record<DepthBucket, number> = {
  far: 1,
  mid: 2,
  near: 4,
};

/** Moderate additive glow on the brightest particles of each depth buffer. */
export const PARTICLE_BLOOM_ALPHA: Record<DepthBucket, number> = {
  far: 0.1,
  mid: 0.15,
  near: 0.08,
};
export const PARTICLE_BLOOM_BLUR_PX = 26;

/** Generous bloom on the leading-edge dots: one wide halo, one tight core. */
export const EDGE_BLOOM_WIDE_BLUR_PX = 64;
export const EDGE_BLOOM_WIDE_ALPHA = 0.55;
export const EDGE_BLOOM_TIGHT_BLUR_PX = 20;
export const EDGE_BLOOM_TIGHT_ALPHA = 0.68;

export const VIGNETTE_STRENGTH = 0.22;
export const GRAIN_ALPHA = 0.04;
export const GRAIN_TILE_SIZE = 256;
export const GRAIN_TILE_COUNT = 15;

/** The whole field drifts on a closed path of this radius, in 4K pixels. */
export const DRIFT_RADIUS_PX = 14;

/**
 * Ceiling on the surface slope used to tilt a particle dash. Dashes flex with
 * the wave, but past this they would swing toward vertical on a steep swell
 * and stop reading as running along the band.
 */
export const PARTICLE_TILT_LIMIT = 0.45;

/** Spacing between sample points along a band surface strand, in 4K pixels. */
export const STRAND_STEP_PX = 40;
