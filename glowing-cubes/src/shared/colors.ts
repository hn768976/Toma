import { Color } from "three";
import type { Palette } from "../palettes";
import type { CubeType } from "../rng";

export type Tone = 0 | 1 | 2 | "accent";

/** Linear-space tint for a cube of a given type/tone in a palette. */
export const tintFor = (p: Palette, type: CubeType, tone: Tone): Color => {
  switch (type) {
    case "glow":
      return new Color(tone === "accent" ? p.accent : p.glow[tone]);
    case "frosted":
      return new Color(p.frosted).lerp(new Color(p.glow[1]), 0.45);
    case "glass":
      return new Color(p.glass);
    case "dark":
    default:
      return new Color(p.glow[1]);
  }
};

/** Base (diffuse) colours per cube type. */
export const baseColorsFor = (p: Palette): Record<CubeType, Color> => ({
  glow: new Color(p.glow[1]).multiplyScalar(0.35),
  frosted: new Color(p.frosted).lerp(new Color(p.glow[1]), 0.6).multiplyScalar(0.32),
  glass: new Color(p.glass).multiplyScalar(0.6),
  dark: new Color(p.dark),
});
