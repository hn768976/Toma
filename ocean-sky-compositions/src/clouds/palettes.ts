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
  zenith: "#111418",
  horizon: "#1b2531",
  below: "#2a3138",
  milkyWay: "#1c2733",
  moonGlow: "#4f5a66",
  moonLight: "#fbfcfd",
  moonShadow: "#a9afb6",
  moonRadiusDeg: 5.9,
  cloudDark: "#0a0d10",
  cloudLit: "#727a82",
  moonLightOnClouds: "#aab3bc",
  fog: "#212a34",
  fogGlow: "#5d6874",
  backlight: 0.45,
};
