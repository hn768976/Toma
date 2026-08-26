/**
 * Top-level tuning constants.
 *
 * Everything here is intentionally variant-agnostic: the three country
 * versions differ only by their entry in `VARIANTS` (see variants.ts).
 * If a number is likely to be nudged by eye, it lives here.
 */

export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const DURATION_IN_FRAMES = 474;

export const CONFIG = {
  /* ── the tilted plane ───────────────────────────────────────────── */
  tiltDeg: -12, // rotation of the whole plane (negative = recedes up-right)
  shearX: -0.3, // horizontal shear; pushes the top of vertical lines right
  squeezeX: 0.92, // ~8% horizontal compression, sells the recession
  planeMargin: 470, // how far the plane extends past the frame, in px

  /* ── grid ───────────────────────────────────────────────────────── */
  gridPitch: 180, // cell pitch at 4K
  gridLineWidth: 3,
  gridAccentEvery: 4, // every Nth line is a touch brighter
  gridMarkerSize: 11, // intersection marker, px
  gridBrightMarkerChance: 0.16,

  /* ── country silhouette ─────────────────────────────────────────── */
  countryAlpha: 0.55,
  hatchSpacing: 15, // diagonal hatch pitch, px
  hatchWidth: 2.4,
  hatchAngleDeg: 45,
  countryEdgeSoftness: 4, // blur radius baked into the fill, px

  /* ── the curve ──────────────────────────────────────────────────── */
  curveWidth: 7,
  curveSteepness: 1.0, // >1 exaggerates the exponential bend
  curveGlow: 34, // shadowBlur on the stroke
  nodeCount: 8,
  nodeDiameter: 22,
  nodeRingWidth: 4,
  nodeBunching: 1.45, // >1 packs nodes toward the steep end
  valueLabelSize: 52,

  /* ── counters ───────────────────────────────────────────────────── */
  counterX: 0.2, // normalised frame coords, upper-left over the country
  counterY: 0.135,
  counterBaseSize: 46,
  counterGrowth: 1.28, // each line is this much larger than the one above

  /* ── particles ──────────────────────────────────────────────────── */
  particleCount: 60,
  particleAmberShare: 0.2,
  particleDriftPerFrame: 1.5, // px along the plane, per frame, at speed 1
  particleFlashesPerSecond: 2.5,

  /* ── depth of field ─────────────────────────────────────────────── */
  blurCeiling: 28, // max blur at 4K
  blurFar: 26,
  blurMid: 15,
  bufferScale: 0.5, // far/mid buffers render at half res, then upscale
  focusRadiusX: 0.62, // radial focus band, fraction of frame
  focusRadiusY: 0.42,
  focusFalloffStart: 0.3, // where the edge softening begins, 0..1 of the radius
  focusFalloffEnd: 0.86, // where it reaches full strength

  /* ── camera ─────────────────────────────────────────────────────── */
  pushFrom: 1.0,
  pushTo: 1.12,
  driftAmplitude: 12,
  parallax: { far: 0.45, mid: 0.72, sharp: 1.0, near: 1.22 },

  /* ── finish ─────────────────────────────────────────────────────── */
  bloomAmount: 0.42,
  bloomBlur: 9,
  vignette: 0.18,
  grainAlpha: 0.04,
  grainTiles: 5,
  grainTileSize: 384,

  /* ── timing ─────────────────────────────────────────────────────── */
  curveDrawStart: 30,
  curveDrawEnd: 450,
  nodePopFrames: 11,
  nodeFlashFrames: 7,
  labelDelayFrames: 4,
  labelFadeFrames: 10,
} as const;

/** Depth buckets. Elements are assigned to exactly one. */
export type Depth = 'far' | 'mid' | 'sharp';
