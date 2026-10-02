/**
 * Colourways — ONE DATA ROW PER VERSION.
 *
 * To add a colourway, append a row to the relevant array. Root.tsx registers a
 * composition for every row automatically (id `<Look>-<name>`).
 * All colours are sRGB hex; shaders convert them to linear light.
 */

export type GalaxyColours = {
  name: string;
  particleA: string; // particle base colour
  particleB: string; // particle highlight (mixed towards for core / sparkles)
  streak: string;
  core: string;
  bgBottom: string; // gradient — lighter, under the disk
  bgTop: string; // gradient — darker, top of frame
  haze: string;
};

export type OrbColours = {
  name: string;
  ribbon: string;
  highlight: string;
  halo: string;
  mesh: string;
};

export type MapColours = {
  name: string;
  square: string;
  particle: string;
  cube: string;
  bgTop: string; // light from the top centre
  bg: string; // base background
  link: string;
  label: string;
};

export type CellColours = {
  name: string;
  rim: string;
  inner: string;
  sparkle: string;
  nucleus: string;
};

export type NebulaColours = {
  name: string;
  cloudA: string;
  cloudB: string;
  dust: string;
  core: string;
  space: string; // deep background
  star: string;
};

export const GALAXY: GalaxyColours[] = [
  { name: "Blue", particleA: "#7FB0FF", particleB: "#FFFFFF", streak: "#4F8CFF", core: "#EAF2FF", bgBottom: "#0A1A4A", bgTop: "#03081C", haze: "#3F6FD8" },
  { name: "Gold", particleA: "#FFD08A", particleB: "#FFF6E6", streak: "#FFA040", core: "#FFF4E2", bgBottom: "#2A1405", bgTop: "#0A0502", haze: "#D88A3A" },
];

export const ORB: OrbColours[] = [
  { name: "Blue", ribbon: "#5FC8FF", highlight: "#FFFFFF", halo: "#2A3FFF", mesh: "#4F8CFF" },
  { name: "Magenta", ribbon: "#FF6FE0", highlight: "#FFFFFF", halo: "#7A2AFF", mesh: "#C86FFF" },
];

export const MAP: MapColours[] = [
  { name: "Blue", square: "#9FD0FF", particle: "#DCEBFF", cube: "#4FD8FF", bgTop: "#1E4FB8", bg: "#030A1E", link: "#4FA8FF", label: "#9FD0FF" },
  { name: "Gold", square: "#FFD27A", particle: "#FFF0DA", cube: "#FFB040", bgTop: "#8A4A12", bg: "#140A04", link: "#FFB050", label: "#FFD27A" },
];

export const CELL: CellColours[] = [
  { name: "Cyan", rim: "#7FF4FF", inner: "#3FD8F0", sparkle: "#FFFFFF", nucleus: "#BFFAFF" },
  { name: "Emerald", rim: "#8FFFC0", inner: "#30D890", sparkle: "#FFF6B0", nucleus: "#D0FFE0" },
];

export const NEBULA: NebulaColours[] = [
  { name: "Violet", cloudA: "#7A4AC8", cloudB: "#E86AB0", dust: "#1A0816", core: "#FFF0C8", space: "#05020A", star: "#F4EEFF" },
  { name: "Teal", cloudA: "#3FB8C8", cloudB: "#3F6AE8", dust: "#040C1C", core: "#E6FCFF", space: "#01040A", star: "#EEF8FF" },
];
