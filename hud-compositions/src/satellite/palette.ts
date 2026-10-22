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
  shadow: [0.055, 0.075, 0.095],
  mid: [0.47, 0.54, 0.6],
  light: [0.95, 0.975, 0.99],
  grid: [0.62, 0.86, 0.9],
  lensTint: [0.9, 0.93, 0.8],
  haze: [0.62, 0.68, 0.72],
  amber: "#E9A23B",
  red: "#E0283F",
  white: "#F4F8FA",
  cyan: "#8FD6DE",
};
