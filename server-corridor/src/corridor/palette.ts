export type Palette = {
  background: string;
  frame: string; // cabinet frames, plinths, pillars
  ceiling: string;
  floor: string;
  floorOpacity: number; // lower = stronger mirror reflection
  stripLight: string; // ceiling strips + plinth / header slots
  stripOpacity: number;
  handle: string;
  handleGlow: number; // emissive intensity of the door handles
  glassBase: string; // dark interior behind the glass
  glassInterior: string; // equipment silhouettes inside the cabinet
  glassStreak: string; // diagonal reflections on the glass
  leds: { color: string; weight: number }[]; // up to 3 LED colours
  // Light intensities are multiplied by PI in the scene (three.js r155+
  // light units), so 1 here means "full colour".
  ambient: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  vignette: number;
};

// Matches the reference: clinical white data hall, smoked glass, white LEDs.
export const REFERENCE_PALETTE: Palette = {
  background: "#d4d3d7",
  frame: "#e2e1e5",
  ceiling: "#ebeaef",
  floor: "#cfced3",
  floorOpacity: 0.975,
  stripLight: "#ffffff",
  stripOpacity: 0.55,
  handle: "#15191b",
  handleGlow: 0,
  glassBase: "#141d1f",
  glassInterior: "#192325",
  glassStreak: "#4d5d61",
  leds: [{ color: "#ffffff", weight: 1 }],
  ambient: 0.62,
  hemiSky: "#ffffff",
  hemiGround: "#9fa3a8",
  hemiIntensity: 0.42,
  vignette: 0.12,
};

// Alternate version: same shot, night-mode graphite hall with cyan light
// strips and multi-colour status LEDs.
export const MIDNIGHT_PALETTE: Palette = {
  background: "#05080d",
  frame: "#2a3240",
  ceiling: "#1a202b",
  floor: "#0b0f16",
  floorOpacity: 0.72,
  stripLight: "#4ff3ff",
  stripOpacity: 1,
  handle: "#4ff3ff",
  handleGlow: 0.8,
  glassBase: "#03070c",
  glassInterior: "#0a1622",
  glassStreak: "#1f4a5e",
  leds: [
    { color: "#4ff3ff", weight: 0.6 },
    { color: "#7cff9b", weight: 0.28 },
    { color: "#ffb347", weight: 0.12 },
  ],
  ambient: 0.55,
  hemiSky: "#7fdcff",
  hemiGround: "#101826",
  hemiIntensity: 1.1,
  vignette: 0.45,
};
