export type Palette = {
  // Backdrop
  bgDark: string;
  bgMid: string;
  bgGlow: string;
  bgStrip: string;
  // Cell body
  core: string;
  body: string;
  rim: string;
  seam: string;
  // Translucent outer membrane
  membrane: string;
};

// Sampled from the reference: cool blue backlit microscopy look.
export const referencePalette: Palette = {
  bgDark: "#30548c",
  bgMid: "#7cb3e0",
  bgGlow: "#cff0fd",
  bgStrip: "#a9d5eb",
  core: "#052a53",
  body: "#2a7bbd",
  rim: "#a8e7f8",
  seam: "#5cb6e6",
  membrane: "#e4f6ff",
};

// Alternate version: warm fluorescence-stain look (violet field, coral cells,
// peach backlight).
export const coralPalette: Palette = {
  bgDark: "#2b1240",
  bgMid: "#7b3d86",
  bgGlow: "#ffd9c4",
  bgStrip: "#b56fa0",
  core: "#360828",
  body: "#8c2353",
  rim: "#ffc6a4",
  seam: "#ff8ea6",
  membrane: "#ffe9de",
};
