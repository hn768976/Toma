export type RGB = readonly [number, number, number];

export type Palette = {
  // Near-black base, left/right ends of the background gradient
  bgDeep: RGB;
  bgLift: RGB;
  // Large translucent slabs that sit behind the main panel
  slab: RGB;
  // Distressed main panel tint (multiplied by grunge luminance)
  panel: RGB;
  // Hairlines, glyphs, dashes
  ink: RGB;
  // Sparse accent (lines, glyph columns, ticks)
  accent: RGB;
  // Halftone dots / splats punched into the panel
  void: RGB;
};

// Matches the reference: teal-black ground, cold grey panel, crimson accents.
export const REFERENCE_PALETTE: Palette = {
  bgDeep: [5, 11, 12],
  bgLift: [22, 33, 35],
  slab: [34, 48, 51],
  panel: [196, 202, 202],
  ink: [228, 234, 234],
  accent: [214, 38, 72],
  void: [6, 10, 11],
};

// Alternate grade: midnight indigo ground, ice-cyan panel, amber accents.
export const ALT_PALETTE: Palette = {
  bgDeep: [5, 6, 18],
  bgLift: [19, 22, 48],
  slab: [30, 36, 78],
  panel: [150, 214, 238],
  ink: [214, 236, 255],
  accent: [255, 168, 36],
  void: [4, 5, 16],
};
