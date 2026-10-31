// Colours are linear RGB multipliers fed straight into additive blending.
// Additive accumulation is what turns overlapping orange into yellow-white
// hot spots (exactly like the reference), so palettes define the *emission*
// colour of each element rather than the final pixel colour.

export type RGB = [number, number, number];

export type EmberPalette = {
  name: string;
  core: RGB; // white-hot heads / sun core
  hot: RGB; // bright trail body, sparks
  mid: RGB; // halos, ring band
  deep: RGB; // wide glow
  smoke: RGB;
  bgCenter: RGB; // ambient glow behind the action
  bgTop: RGB; // warm wash along the top edge
  bgFloor: RGB; // darkest tone (corners)
  ember: RGB; // floating specks
};

// Version 1 — matches the reference: molten orange / red on black.
export const FIRE: EmberPalette = {
  name: "fire",
  core: [1.0, 0.92, 0.45],
  hot: [1.0, 0.42, 0.04],
  mid: [1.0, 0.22, 0.02],
  deep: [0.6, 0.08, 0.0],
  smoke: [0.5, 0.09, 0.02],
  bgCenter: [0.42, 0.066, 0.018],
  bgTop: [0.3, 0.085, 0.0],
  bgFloor: [0.03, 0.006, 0.0],
  ember: [1.0, 0.5, 0.12],
};

// Version 2 — alternative palette: electric blue plasma with violet depth.
export const PLASMA: EmberPalette = {
  name: "plasma",
  core: [0.7, 0.95, 1.0],
  hot: [0.12, 0.55, 1.0],
  mid: [0.1, 0.26, 1.0],
  deep: [0.22, 0.04, 0.62],
  smoke: [0.16, 0.08, 0.55],
  bgCenter: [0.08, 0.06, 0.36],
  bgTop: [0.02, 0.1, 0.28],
  bgFloor: [0.008, 0.004, 0.03],
  ember: [0.45, 0.8, 1.0],
};
