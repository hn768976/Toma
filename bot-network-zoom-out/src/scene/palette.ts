// Colour palettes. All colours are linear-ish RGB triplets (0..1) fed
// straight into the shaders; values above 1 feed the bloom pass.
export type RGB = [number, number, number];

export type Palette = {
  name: string;
  background: RGB; // clear / fog colour
  groundNear: RGB;
  groundGlow: RGB; // large soft haze on the floor
  groundDots: RGB;
  tileIdle: RGB; // tile waiting for an agent
  tileDone: RGB; // tile after its task is completed
  icon: RGB;
  lines: RGB; // network connections
  robotBody: RGB;
  robotDark: RGB;
  robotFace: RGB;
  robotEye: RGB;
  spawnDots: RGB; // dotted pulse under a materialising robot
  check: RGB;
  farRobot: RGB; // robots seen as dots from far away
  grade: RGB; // final colour multiplier
};

// Version 1 – matches the reference: navy floor, blue tiles, red bots,
// green "done" tiles and check marks.
export const referencePalette: Palette = {
  name: "reference",
  background: [0.004, 0.008, 0.04],
  groundNear: [0.006, 0.014, 0.07],
  groundGlow: [0.02, 0.09, 0.42],
  groundDots: [0.25, 0.55, 1.0],
  tileIdle: [0.12, 0.46, 0.95],
  tileDone: [0.2, 1.0, 0.62],
  icon: [0.85, 0.95, 1.0],
  lines: [0.22, 0.62, 1.0],
  robotBody: [0.95, 0.1, 0.16],
  robotDark: [0.55, 0.03, 0.09],
  robotFace: [0.64, 0.62, 0.66],
  robotEye: [0.12, 0.03, 0.1],
  spawnDots: [1.0, 0.12, 0.25],
  check: [0.25, 1.0, 0.3],
  farRobot: [1.0, 0.1, 0.45],
  grade: [1.0, 1.0, 1.0],
};

// Version 2 – alternative palette: plum floor, violet tiles, teal bots,
// amber/gold "done" tiles and check marks.
export const duskPalette: Palette = {
  name: "dusk",
  background: [0.028, 0.004, 0.035],
  groundNear: [0.045, 0.008, 0.06],
  groundGlow: [0.32, 0.03, 0.34],
  groundDots: [1.0, 0.4, 0.9],
  tileIdle: [0.56, 0.2, 1.0],
  tileDone: [1.0, 0.62, 0.1],
  icon: [1.0, 0.9, 1.0],
  lines: [0.85, 0.35, 1.0],
  robotBody: [0.05, 0.78, 0.74],
  robotDark: [0.02, 0.38, 0.42],
  robotFace: [0.66, 0.64, 0.6],
  robotEye: [0.04, 0.12, 0.16],
  spawnDots: [0.1, 1.0, 0.9],
  check: [1.0, 0.8, 0.15],
  farRobot: [0.1, 1.0, 0.9],
  grade: [1.03, 0.98, 1.0],
};
