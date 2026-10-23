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
  moonLight: "#eceef0",
  moonShadow: "#8f969e",
  moonRadiusDeg: 5.9,
  cloudDark: "#07090b",
  cloudLit: "#50575e",
  moonLightOnClouds: "#aab3bc",
  fog: "#1d2631",
  fogGlow: "#323b45",
  backlight: 0.7,
};
