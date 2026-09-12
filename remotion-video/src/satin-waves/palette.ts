/**
 * Two looks over the same height field.
 *
 * `light` is sampled from the reference footage: a cool, near-white satin
 * with very low contrast. `dark` is the same material with the lights off —
 * neutral charcoal with a cool-silver sheen, so the specular has to do much
 * more of the work than it does in the light version.
 */

export type SatinTheme = {
  /** Deepest fold. */
  shadow: string;
  /** The value most of the frame sits at. */
  mid: string;
  /** Peak of a lit ridge. */
  high: string;
  /** How steeply the normals tilt — the apparent depth of the folds. */
  bump: number;
  diffuse: number;
  specular: number;
  specPower: number;
  sheen: number;
  /** Dithered grain amplitude; keeps these flat gradients from banding. */
  grain: number;
  vignette: number;
};

export const LIGHT_THEME: SatinTheme = {
  shadow: "#c4cad4",
  mid: "#dfe3e8",
  high: "#ffffff",
  bump: 0.12,
  diffuse: 0.55,
  specular: 0.3,
  specPower: 26,
  sheen: 0.2,
  grain: 0.012,
  vignette: 0.05,
};

export const DARK_THEME: SatinTheme = {
  shadow: "#0d0e11",
  mid: "#23262c",
  high: "#bfc6d0",
  bump: 0.11,
  // A dark satin blows out fast: the highlight ramp spans a much wider value
  // range than the light version's does, so the specular has to stay narrow
  // in gain and broad in falloff or the ridges clip to bare white.
  diffuse: 0.4,
  specular: 0.26,
  specPower: 20,
  sheen: 0.22,
  grain: 0.016,
  vignette: 0.08,
};

export const THEMES = { light: LIGHT_THEME, dark: DARK_THEME };

export type ThemeName = keyof typeof THEMES;

/** "#rrggbb" -> [r, g, b] in 0..1. */
export const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
