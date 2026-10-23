export type MicrobePalette = {
  id: string;
  background: string;
  // Soft "cloudy" density variation of the slide, as two tints blended by fbm.
  cloudLight: [number, number, number];
  cloudDark: [number, number, number];
  cloudAlpha: number;
  vignette: string;
  vignetteStrength: number;
  speck: string;
  speckAlphaScale: number;
  wormEdge: string;
  wormCore: string;
  wormHighlight: string;
  blurredEdge: string;
  blurredCore: string;
  // Fluorescence-style bloom; null for brightfield.
  glow: { color: string; alpha: number; blurPx: number } | null;
  grainAlpha: number;
};

// Version 1: brightfield microscope look of the reference — cool grey-blue
// slide with slate, semi-translucent filaments.
export const brightfield: MicrobePalette = {
  id: "brightfield",
  background: "#a4b2b8",
  cloudLight: [196, 206, 210],
  cloudDark: [128, 142, 150],
  cloudAlpha: 0.55,
  vignette: "rgba(48, 62, 70, 1)",
  vignetteStrength: 0.62,
  speck: "rgba(52, 62, 68, A)",
  speckAlphaScale: 1,
  wormEdge: "rgba(58, 74, 82, 0.95)",
  wormCore: "rgba(122, 140, 149, 0.95)",
  wormHighlight: "rgba(170, 186, 192, 0.55)",
  blurredEdge: "rgba(78, 94, 102, 0.6)",
  blurredCore: "rgba(116, 132, 140, 0.6)",
  glow: null,
  grainAlpha: 0.07,
};

// Version 2: immunofluorescence / dark-field palette — same specimen, stained
// and imaged on a black field so the filaments glow green-cyan.
export const fluorescence: MicrobePalette = {
  id: "fluorescence",
  background: "#020607",
  cloudLight: [10, 38, 40],
  cloudDark: [0, 4, 6],
  cloudAlpha: 0.9,
  vignette: "rgba(0, 0, 0, 1)",
  vignetteStrength: 0.75,
  speck: "rgba(110, 255, 190, A)",
  speckAlphaScale: 0.45,
  wormEdge: "rgba(46, 214, 128, 0.95)",
  wormCore: "rgba(18, 120, 82, 0.95)",
  wormHighlight: "rgba(190, 255, 220, 0.75)",
  blurredEdge: "rgba(30, 150, 96, 0.6)",
  blurredCore: "rgba(14, 84, 60, 0.6)",
  glow: { color: "rgba(60, 255, 150, 1)", alpha: 0.85, blurPx: 7 },
  grainAlpha: 0.035,
};
