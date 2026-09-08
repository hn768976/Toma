/**
 * Every size is a fraction of the frame height, so the 1080p preview is an
 * exact scale of the 4K render.
 */
export const LAYOUT = {
  /** Outer radius of the ring band at full exhale. */
  minOuterRadius: 0.22,
  /** Outer radius of the ring band at full inhale. */
  maxOuterRadius: 0.38,
  /** Band thickness — grows with the radius so the ring inflates, not slides. */
  minBandWidth: 0.024,
  maxBandWidth: 0.04,
  guideTrackWidth: 0.0018,
  markerRadius: 0.0105,
  echoRingWidth: 0.0022,
  /** How far past the ring the echo rings travel before they are gone. */
  echoTravel: 0.075,
  labelFontSize: 0.028,
  ringBlur: 0.011,
  markerBlur: 0.013,
} as const;

export const COLORS = {
  /** Background gradient: centre → corners. */
  backgroundCentre: "#0e1420",
  backgroundMid: "#0a0f18",
  backgroundEdge: "#05080e",
  /** Ring, brightest (inner edge of the band). */
  ringInner: "#a8e8f0",
  /** Ring, outer edge of the band. */
  ringOuter: "#2a7a9a",
  guideTrack: "#1e3a4a",
  marker: "#f4fcfe",
  label: "#a8e8f0",
} as const;

/** Size of one grain tile in composition px. See scripts/make-grain.mjs. */
export const GRAIN_TILE_PX = 512;
