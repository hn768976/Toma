export type PaletteName = "sepia" | "cyanotype";

export type Palette = {
  paper: [number, number, number];
  paperCenter: [number, number, number];
  stain: [number, number, number];
  speck: [number, number, number];
  rule: string;
  ink: string;
  burn: [number, number, number];
  flickerTint: [number, number, number];
};

export const PALETTES: Record<PaletteName, Palette> = {
  // Version 1: the reference look — rosy aged paper, near-black ink, burnt edges.
  sepia: {
    paper: [205, 183, 172],
    paperCenter: [222, 203, 193],
    stain: [178, 128, 98],
    speck: [120, 80, 50],
    rule: "rgba(105, 82, 76, 0.26)",
    ink: "rgb(52, 42, 38)",
    burn: [34, 22, 18],
    flickerTint: [255, 236, 220],
  },
  // Version 2: cyanotype / blueprint print — Prussian-blue paper, pale ink,
  // deep navy burn.
  cyanotype: {
    paper: [30, 68, 112],
    paperCenter: [62, 112, 160],
    stain: [16, 42, 78],
    speck: [150, 190, 220],
    rule: "rgba(170, 205, 235, 0.26)",
    ink: "rgb(236, 243, 246)",
    burn: [3, 10, 24],
    flickerTint: [200, 225, 255],
  },
};
