export type SkyPalette = {
  zenith: string;
  horizon: string;
  lowSky: string;
  milkyWay: string;
  moonGlow: string;
  moonLight: string;
  moonShadow: string;
  moonRadiusDeg: number;
};

// Cool, desaturated moonlight matching the reference.
export const MOONLIGHT: SkyPalette = {
  zenith: "#090b0e",
  horizon: "#1a2330",
  lowSky: "#0b0e12",
  milkyWay: "#161d26",
  moonGlow: "#868d96",
  moonLight: "#f8f9fa",
  moonShadow: "#858c94",
  moonRadiusDeg: 6.8,
};
