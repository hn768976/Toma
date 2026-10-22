export type Palette = {
  background: string; // clear color / deep void
  panelTop: string; // panel glass gradient (top)
  panelBottom: string; // panel glass gradient (bottom)
  text: string; // regular code
  textHot: string; // highlighted lines
  frame: string; // glowing lattice bars
  frameHot: string; // bar cores / intersections
  ray: string; // diagonal light rays
  haze: string; // volumetric haze / dust
};

// Close match of the reference: icy cyan lattice over deep navy glass.
export const CYBER_BLUE: Palette = {
  background: "#01060f",
  panelTop: "#0b3a66",
  panelBottom: "#03132a",
  text: "#a8c4e0",
  textHot: "#d6e8f8",
  frame: "#2db2da",
  frameHot: "#3cc8ec",
  ray: "#2fd8cc",
  haze: "#1a78c8",
};

// Alternate grade: molten amber lattice over smoked bronze glass.
export const EMBER_GOLD: Palette = {
  background: "#0b0302",
  panelTop: "#4a1a08",
  panelBottom: "#200803",
  text: "#ffb46a",
  textHot: "#fff1d6",
  frame: "#ff6a0a",
  frameHot: "#ffc070",
  ray: "#ffa640",
  haze: "#c8461a",
};

export const PALETTES = {
  cyberBlue: CYBER_BLUE,
  emberGold: EMBER_GOLD,
} as const;

export type PaletteName = keyof typeof PALETTES;
