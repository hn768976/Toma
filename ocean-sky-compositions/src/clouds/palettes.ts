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
  milkyWay: "#26303c",
  moonGlow: "#868d96",
  moonLight: "#f8f9fa",
  moonShadow: "#a6acb3",
  moonRadiusDeg: 6.8,
  cloudDark: "#07090b",
  cloudLit: "#5e656c",
  moonLightOnClouds: "#aab3bc",
  fog: "#1d2631",
  fogGlow: "#323b45",
  backlight: 1.0,
};
