export type SatellitePalette = {
  shadow: [number, number, number];
  mid: [number, number, number];
  light: [number, number, number];
  grid: [number, number, number];
  lensTint: [number, number, number];
  haze: [number, number, number];
  amber: string;
  red: string;
  white: string;
  cyan: string;
};

/** Cold monochrome satellite grade with amber/red HUD accents (reference). */
export const SATELLITE_PALETTE: SatellitePalette = {
  shadow: [0.03, 0.045, 0.065],
  mid: [0.4, 0.48, 0.56],
  light: [0.95, 0.975, 0.99],
  grid: [0.62, 0.86, 0.9],
  lensTint: [0.93, 0.96, 0.88],
  haze: [0.62, 0.68, 0.72],
  amber: "#E9A23B",
  red: "#E0283F",
  white: "#F4F8FA",
  cyan: "#8FD6DE",
};
