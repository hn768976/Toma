// Color palettes. All colors are linear-ish sRGB triplets in 0..1 so
// they can be passed straight to the shader as uniforms.

export type Rgb = [number, number, number];

export type WavePalette = {
  // Background gradient: top-left, top-right, bottom-left, bottom-right.
  bgTopLeft: Rgb;
  bgTopRight: Rgb;
  bgBottomLeft: Rgb;
  bgBottomRight: Rgb;
  // Soft haze glow laid over the background.
  hazeColor: Rgb;
  hazeStrength: number;
  // Particle colors: near (in focus) -> far (blurred), plus an accent
  // blended in across the width of the field.
  dotNear: Rgb;
  dotFar: Rgb;
  dotAccent: Rgb;
  accentMix: number;
  // Overall particle brightness.
  intensity: number;
};

const hex = (h: string): Rgb => {
  const n = parseInt(h.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

// Matches the reference: pale silver-blue studio backdrop with white
// particles.
export const silverPalette: WavePalette = {
  bgTopLeft: hex("#d3dde5"),
  bgTopRight: hex("#a3b4c3"),
  bgBottomLeft: hex("#c9d4de"),
  bgBottomRight: hex("#98a9b9"),
  hazeColor: hex("#e9eff4"),
  hazeStrength: 0.45,
  dotNear: hex("#ffffff"),
  dotFar: hex("#ffffff"),
  dotAccent: hex("#ffffff"),
  accentMix: 0,
  intensity: 0.8,
};

// Alternate palette: deep midnight indigo with an aurora gradient of
// particles running cyan -> violet -> magenta.
export const auroraPalette: WavePalette = {
  bgTopLeft: hex("#120a33"),
  bgTopRight: hex("#05061a"),
  bgBottomLeft: hex("#0a1638"),
  bgBottomRight: hex("#03040f"),
  hazeColor: hex("#3b1d7a"),
  hazeStrength: 0.5,
  dotNear: hex("#5ff4ff"),
  dotFar: hex("#b46bff"),
  dotAccent: hex("#ff4fc8"),
  accentMix: 0.75,
  intensity: 0.85,
};

export const PALETTES = { silver: silverPalette, aurora: auroraPalette };
export type PaletteName = keyof typeof PALETTES;
