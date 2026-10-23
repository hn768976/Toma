export type CloudPalette = {
  zenith: string;
  horizon: string;
  below: string;
  milkyWay: string;
  moonGlow: string;
  moonLight: string;
  moonShadow: string;
  moonRadiusDeg: number;
  cloudDark: string;
  cloudLit: string;
  moonLightOnClouds: string;
  fog: string;
  fogGlow: string;
  backlight: number;
};

// Cool, desaturated moonlight matching the reference.
export const MOONLIGHT: CloudPalette = {
  zenith: "#090b0e",
  horizon: "#141c26",
  below: "#2a3138",
  milkyWay: "#161d26",
  moonGlow: "#868d96",
  moonLight: "#f8f9fa",
  moonShadow: "#858c94",
  moonRadiusDeg: 6.8,
  cloudDark: "#07090b",
  cloudLit: "#454b51",
  moonLightOnClouds: "#aab3bc",
  fog: "#18202a",
  fogGlow: "#323b45",
  backlight: 0.8,
};
