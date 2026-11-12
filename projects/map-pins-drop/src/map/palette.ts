import * as THREE from "three";

export type Variant = "v1" | "v2";

export type MapPalette = {
  land: string;
  block: string;
  sand: string;
  minor: string;
  majorEdge: string;
  majorCore: string;
  highway: string;
  water: string;
  waterEdge: string;
  park: string;
  parkDark: string;
  parkPath: string;
  fog: string;
  /** 0 = flat print-style lines, 1 = neon glow around highways / rivers */
  glow: number;
  pin: string;
  pinEmissive: string;
  pinEmissiveIntensity: number;
  pinRoughness: number;
  pinDot: string;
  pinDotGlow: number;
  shadowColor: string;
  shadowOpacity: number;
  ripple: string;
  rippleOpacity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  keyIntensity: number;
  envIntensity: number;
  vignette: number;
};

/** Version 1 – matches the reference: bright, soft "daylight" web-map style. */
const daylight: MapPalette = {
  land: "#e4e4e3",
  block: "#d6d6d6",
  sand: "#e9d9ae",
  minor: "#fbfbfb",
  majorEdge: "#c9dbe6",
  majorCore: "#f4f8fa",
  highway: "#2a9fd2",
  water: "#94cfe2",
  waterEdge: "#88c6db",
  park: "#b4da98",
  parkDark: "#8fc56c",
  parkPath: "#eef6e6",
  fog: "#ecefef",
  glow: 0,
  pin: "#a50b14",
  pinEmissive: "#000000",
  pinEmissiveIntensity: 0,
  pinRoughness: 0.36,
  pinDot: "#e7cfcf",
  pinDotGlow: 0.0,
  shadowColor: "#4a4f55",
  shadowOpacity: 0.24,
  ripple: "#ffffff",
  rippleOpacity: 0,
  hemiSky: "#ffffff",
  hemiGround: "#b9bcc0",
  hemiIntensity: 0.75,
  keyIntensity: 1.25,
  envIntensity: 0.35,
  vignette: 0.06,
};

/** Version 2 – alternative palette: night-mode navigation map with amber pins. */
const nightMode: MapPalette = {
  land: "#0e1828",
  block: "#132238",
  sand: "#1b2a3a",
  minor: "#253c5c",
  majorEdge: "#1d4166",
  majorCore: "#3d6f9c",
  highway: "#3fd4ff",
  water: "#06233a",
  waterEdge: "#0f4566",
  park: "#0f312d",
  parkDark: "#124036",
  parkPath: "#1d5547",
  fog: "#0b1422",
  glow: 1,
  pin: "#ff9416",
  pinEmissive: "#ff5a00",
  pinEmissiveIntensity: 0.22,
  pinRoughness: 0.25,
  pinDot: "#fff4d6",
  pinDotGlow: 0.9,
  shadowColor: "#000000",
  shadowOpacity: 0.55,
  ripple: "#ffc861",
  rippleOpacity: 0.6,
  hemiSky: "#9fc4ff",
  hemiGround: "#0b1422",
  hemiIntensity: 0.7,
  keyIntensity: 1.6,
  envIntensity: 0.8,
  vignette: 0.32,
};

export const PALETTES: Record<Variant, MapPalette> = {
  v1: daylight,
  v2: nightMode,
};

/** Map shader colours are authored directly in sRGB (no conversion). */
export const srgbVec3 = (hex: string) => {
  const c = new THREE.Color();
  c.setHex(parseInt(hex.replace("#", ""), 16), THREE.SRGBColorSpace);
  // getRGB with SRGB space returns the raw sRGB components
  const out = { r: 0, g: 0, b: 0 };
  c.getRGB(out as THREE.RGB, THREE.SRGBColorSpace);
  return new THREE.Vector3(out.r, out.g, out.b);
};
