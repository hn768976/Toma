// The two looks. Both drive the identical relief and the identical motion —
// only material, light and exposure differ, which is the whole point: the
// clip is a lighting study, so changing the light changes everything.

export type PaperRippleVariant = "white" | "graphite";

export type VariantPreset = {
  /** Base surface colour, sRGB hex. */
  albedo: string;
  /** Flat clear colour behind the plane. Never visible; a safety net only. */
  background: string;

  keyColor: string;
  keyIntensity: number;
  fillColor: string;
  fillIntensity: number;
  ambientColor: string;
  ambientIntensity: number;

  /** How far light bleeds past the terminator, and the colour it bleeds. */
  wrap: number;
  subsurfaceColor: string;
  subsurfaceIntensity: number;

  sheenColor: string;
  sheenIntensity: number;
  sheenPower: number;

  /** Floor of the crevice-occlusion term (1 = no occlusion). */
  occlusion: number;
  /** Penumbra widening rate of the ray-marched key shadow. */
  shadowSoftness: number;

  exposure: number;
  vignette: number;
  grain: number;
  fibreAmount: number;
};

// Key light: upper left, 13 deg above the surface. The low angle is the whole
// trick — grazing light is what turns a millimetre of relief into a legible
// shadow. Fill comes back from the lower right, higher up, to keep the
// shadows grey rather than black.
export const KEY_AZIMUTH_DEG = 135;
export const KEY_ELEVATION_DEG = 13;
export const FILL_AZIMUTH_DEG = -50;
export const FILL_ELEVATION_DEG = 42;

// Fibre scale is fixed in world space, so it stays a constant physical size:
// barely resolvable at 1080p, real material tooth at 4K.
export const FIBRE_SCALE = 950;

export const VARIANT_PRESETS: Record<PaperRippleVariant, VariantPreset> = {
  // V1 — white paper. High-key: near-white where the light lands, shadows only
  // a few steps down and tinted cool, so the surface reads as paper or plaster
  // rather than plastic.
  white: {
    albedo: "#faf8f4",
    background: "#f2f0ec",
    keyColor: "#fff6e8",
    keyIntensity: 1.35,
    fillColor: "#d8e2ee",
    fillIntensity: 0.2,
    ambientColor: "#b9c8dc",
    ambientIntensity: 0.34,
    wrap: 0.35,
    subsurfaceColor: "#ffd9b0",
    subsurfaceIntensity: 0.14,
    sheenColor: "#ffffff",
    sheenIntensity: 0.03,
    sheenPower: 48,
    occlusion: 0.8,
    shadowSoftness: 0.16,
    exposure: 2.3,
    vignette: 0.1,
    grain: 0.02,
    fibreAmount: 0.03,
  },

  // V2 — graphite. Same relief, cooler and harder light, low-key exposure. The
  // sheen is pushed up and masked to the crests only, so the ridges catch a
  // faint cold line and everything between them stays matte.
  graphite: {
    albedo: "#2a2d31",
    background: "#1c1e21",
    keyColor: "#dfe9f7",
    keyIntensity: 2.6,
    fillColor: "#8ea4bd",
    fillIntensity: 0.18,
    ambientColor: "#5b6c85",
    ambientIntensity: 0.3,
    wrap: 0.32,
    subsurfaceColor: "#000000",
    subsurfaceIntensity: 0,
    sheenColor: "#cfe0f5",
    sheenIntensity: 0.1,
    sheenPower: 9,
    occlusion: 0.55,
    shadowSoftness: 0.14,
    exposure: 1.9,
    vignette: 0.22,
    grain: 0.016,
    fibreAmount: 0.045,
  },
};
