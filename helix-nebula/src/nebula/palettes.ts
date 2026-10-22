// Linear-ish RGB colours (0..1) fed to the shader as a uniform array. The
// order of the keys is the order of `uPal[]` in the fragment shader.
export type Palette = {
  space: string; // deepest background
  cloud: string; // main background cloud colour
  fog: string; // desaturated haze inside the diagonal band
  shell: string; // outer helix shell
  shellHi: string; // bright filaments of the outer shell
  gap: string; // dark annulus between core and inner ring
  ringEdge: string; // soft edge of the bright inner ring
  ringHot: string; // brightest ring filaments
  ringTint: string; // tint on the outer side of the ring
  coreOuter: string; // rim of the central glow
  coreInner: string; // centre of the central glow
  star1: string;
  star2: string;
  star3: string;
  star4: string;
  flare: string; // fly-by particles and core sparks
};

export const PALETTE_KEYS: (keyof Palette)[] = [
  "space",
  "cloud",
  "fog",
  "shell",
  "shellHi",
  "gap",
  "ringEdge",
  "ringHot",
  "ringTint",
  "coreOuter",
  "coreInner",
  "star1",
  "star2",
  "star3",
  "star4",
  "flare",
];

// Matches the reference: deep navy space, royal-blue clouds, lavender-white
// ring and a magenta core.
export const referencePalette: Palette = {
  space: "#050a18",
  cloud: "#2c4aae",
  fog: "#78868e",
  shell: "#2c47a6",
  shellHi: "#7d93ff",
  gap: "#3b43a0",
  ringEdge: "#9ba5e6",
  ringHot: "#f0f3fa",
  ringTint: "#d6e6b4",
  coreOuter: "#b22fd6",
  coreInner: "#ff6cf6",
  star1: "#ffffff",
  star2: "#5fe6ff",
  star3: "#4dff7a",
  star4: "#ff7a4d",
  flare: "#ffffff",
};

// Alternate version: a warm "ember" grade. The helix becomes a gold ring
// around a cyan-white core, set in crimson and teal-black space.
export const emberPalette: Palette = {
  space: "#07070b",
  cloud: "#7a1c2c",
  fog: "#5f7f78",
  shell: "#a8302a",
  shellHi: "#ff8a4a",
  gap: "#5a1830",
  ringEdge: "#e2793a",
  ringHot: "#fff3d6",
  ringTint: "#ffd36a",
  coreOuter: "#1fa8c8",
  coreInner: "#9ff6ff",
  star1: "#fff6e8",
  star2: "#ffc35f",
  star3: "#6fe8d0",
  star4: "#ff5f5f",
  flare: "#fff4dc",
};

export const hexToRgb = (hex: string): [number, number, number] => {
  const v = parseInt(hex.replace("#", ""), 16);
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
};

export const paletteToArray = (p: Palette): Float32Array => {
  const out = new Float32Array(PALETTE_KEYS.length * 3);
  PALETTE_KEYS.forEach((k, i) => out.set(hexToRgb(p[k]), i * 3));
  return out;
};
