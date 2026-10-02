// One data row per version. To add a colourway, add a row here and a
// <Composition> entry in Root.tsx (see README "Adding a colourway").

export type EarthColors = {
  rim: string; // atmosphere rim and rays
  land: string;
  ocean: string;
  skyTop: string;
  skyHorizon: string;
  star: string;
};

export type TunnelColors = {
  bar: string;
  accent: string; // occasional second colour
  accentShare: number; // 0..1 fraction of bright bars using the accent
  background: string;
  haze: string; // blurred squares in the gaps
};

export type HierarchyColors = {
  line: string;
  surface: string;
  cube: string;
};

export type SlatColors = {
  slat: string;
  light: string;
  backdrop: string;
  exposure: number;
  grain: number;
  glint: string;
};

export type TrailColors = {
  main: string;
  warm: string;
  hot: string; // pink-white
};

export const EARTH_VERSIONS: Record<"Blue" | "Gold", EarthColors> = {
  Blue: {
    rim: "#4FB8FF",
    land: "#3A78C8",
    ocean: "#05163A",
    skyTop: "#020818",
    skyHorizon: "#0B3488",
    star: "#CFE6FF",
  },
  Gold: {
    rim: "#FFC060",
    land: "#A87830",
    ocean: "#1E1206",
    skyTop: "#0A0603",
    skyHorizon: "#4A2C0C",
    star: "#FFE9C8",
  },
};

export const TUNNEL_VERSIONS: Record<"Blue" | "Magenta", TunnelColors> = {
  Blue: {
    bar: "#3FA8FF",
    accent: "#3FA8FF",
    accentShare: 0,
    background: "#020A20",
    haze: "#1B5FC0",
  },
  Magenta: {
    bar: "#FF4FD8",
    accent: "#3FE8FF",
    accentShare: 0.12,
    background: "#12021E",
    haze: "#A0209A",
  },
};

export const HIERARCHY_VERSIONS: Record<"Blue", HierarchyColors> = {
  Blue: {
    line: "#4FE8FF",
    surface: "#0E2A50",
    cube: "#2C6FD6",
  },
};

export const SLAT_VERSIONS: Record<"Black" | "White", SlatColors> = {
  Black: {
    slat: "#141416",
    light: "#E4E6EA",
    backdrop: "#08080A",
    exposure: 1.0,
    grain: 0.02,
    glint: "#E8F0FF",
  },
  White: {
    slat: "#F2F3F5",
    light: "#FFF4E6",
    backdrop: "#B8BBC2",
    exposure: 1.0,
    grain: 0.015,
    glint: "#FFFFFF",
  },
};

export const TRAIL_VERSIONS: Record<"BlueOrange", TrailColors> = {
  BlueOrange: {
    main: "#4FD8FF",
    warm: "#FF9A4A",
    hot: "#FFD6E8",
  },
};
