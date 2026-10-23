type Rgb = [number, number, number];

const rgb = (r: number, g: number, b: number): Rgb => [r / 255, g / 255, b / 255];

export type UnderwaterPalette = {
  sun: [number, number];
  horizon: number;
  surface: Rgb;
  highlight: Rgb;
  upper: Rgb;
  mid: Rgb;
  deep: Rgb;
  abyss: Rgb;
  floor: Rgb;
  ray: Rgb;
  rayStrength: number;
};

// Version 1: the reference's clear ocean blue.
export const OCEAN_BLUE: UnderwaterPalette = {
  sun: [0.3, 0.0],
  horizon: 0.21,
  surface: rgb(44, 165, 226),
  highlight: rgb(235, 252, 255),
  upper: rgb(32, 170, 233),
  mid: rgb(6, 120, 198),
  deep: rgb(0, 70, 136),
  abyss: rgb(0, 26, 66),
  floor: rgb(80, 186, 220),
  ray: rgb(150, 225, 255),
  rayStrength: 0.85,
};

// Version 2: a tropical lagoon, emerald water lit by warm late-afternoon sun.
export const LAGOON_GOLD: UnderwaterPalette = {
  sun: [0.3, 0.0],
  horizon: 0.21,
  surface: rgb(70, 196, 178),
  highlight: rgb(255, 246, 214),
  upper: rgb(38, 170, 158),
  mid: rgb(14, 124, 120),
  deep: rgb(4, 74, 82),
  abyss: rgb(2, 26, 38),
  floor: rgb(150, 210, 160),
  ray: rgb(255, 208, 125),
  rayStrength: 1.0,
};
