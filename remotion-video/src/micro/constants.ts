// Master format for the microbiology set.
//
// Everything is authored at 4K (3840x2160). The 1080p deliverables are the
// same compositions rendered with `--scale 0.5`, so the framing, motion and
// timing are bit-for-bit identical between master and delivery.

export const FPS = 30;

export const MASTER_WIDTH = 3840;
export const MASTER_HEIGHT = 2160;

export const PREVIEW_WIDTH = 1920;
export const PREVIEW_HEIGHT = 1080;

/**
 * Durations are matched to the source references, converted from their native
 * frame rates to our 30fps timeline (rounded to the nearest whole frame).
 */
export const VERSION_DURATIONS = {
  // 9.040s @ 25fps
  v1: 271,
  // 13.960s @ 25fps
  v2: 419,
  // 19.053s @ 29.97fps
  v3: 572,
  // 10.010s @ 29.97fps
  v4: 300,
  // 10.010s @ 29.97fps
  v5: 300,
  // 8.342s @ 23.976fps
  v6: 250,
} as const;

export type VersionId = keyof typeof VERSION_DURATIONS;
