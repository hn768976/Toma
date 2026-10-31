// Timing is locked to the reference clip: 14.0 s = 420 frames @ 30 fps.
export const FPS = 30;
export const DURATION_IN_FRAMES = 420;
export const LOOP_SECONDS = DURATION_IN_FRAMES / FPS; // seamless loop

// Composition size (4K UHD). Final deliverables are downscaled to 1080p.
export const WIDTH = 3840;
export const HEIGHT = 2160;

// Wall layout in tile units. The reference shows ~18 x 10 tiles with a grid
// line running through the frame centre, so the grid is even-sized.
export const COLS = 26;
export const ROWS = 16;
export const TILE_GAP = 0; // flush tiles merge seamlessly, as in the reference
export const MAX_DEPTH = 0.8; // how far a tile can push out of the wall

export type Palette = {
  name: string;
  tile: string;
  background: string;
  keyLight: string;
  keyIntensity: number;
  fillLight: string;
  fillIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  ambient: string;
  ambientIntensity: number;
  roughness: number;
  metalness: number;
  // Side faces of the tiles (the thin strips you see between depth levels).
  side: string;
  sideEmissive: string;
  sideEmissiveIntensity: number;
  vignette: number; // 0..1 strength of the CSS overlay vignette
  vignetteColor: string;
};

// Sampled from the reference: cool white tiles, soft blue-grey shading,
// bright centre falling off to the corners.
export const REFERENCE_PALETTE: Palette = {
  name: "Arctic White",
  tile: "#ffffff",
  background: "#eef1f8",
  keyLight: "#ffffff",
  keyIntensity: 1.35,
  fillLight: "#f4f6ff",
  fillIntensity: 75,
  hemiSky: "#dfe8ff",
  hemiGround: "#2a6aa8",
  hemiIntensity: 0.55,
  ambient: "#7eaad8",
  ambientIntensity: 0.55,
  roughness: 0.85,
  metalness: 0,
  side: "#ffffff",
  sideEmissive: "#000000",
  sideEmissiveIntensity: 0,
  vignette: 0.07,
  vignetteColor: "#4e5f86",
};

// Alternative: "Indigo Ember" - deep indigo tile faces under a cool key,
// while the side walls of every tile glow ember-coral, so each depth change
// draws a luminous line. Same geometry, camera and motion as the reference.
export const INDIGO_EMBER_PALETTE: Palette = {
  name: "Indigo Ember",
  tile: "#2a2f5c",
  background: "#0b0c1c",
  keyLight: "#b9c4ff",
  keyIntensity: 1.0,
  fillLight: "#9d86ff",
  fillIntensity: 70,
  hemiSky: "#5a63b8",
  hemiGround: "#120f2a",
  hemiIntensity: 0.6,
  ambient: "#2b2f63",
  ambientIntensity: 0.4,
  roughness: 0.45,
  metalness: 0.2,
  side: "#ff8a4c",
  sideEmissive: "#ff5a2a",
  sideEmissiveIntensity: 1.25,
  vignette: 0.55,
  vignetteColor: "#04040c",
};
