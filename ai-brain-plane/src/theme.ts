import { Color } from "three";

/**
 * A version's full colour definition. Both versions share every piece of
 * geometry and both procedural textures; only these values differ, which is
 * why the textures are generated as channel *masks* rather than as coloured
 * bitmaps.
 */
export type Theme = {
  id: string;
  /** CSS gradient stops for the backdrop behind the 3D canvas. */
  bgInner: string;
  bgOuter: string;
  /** Circuit traces on the plane. */
  trace: string;
  /** Pads and vias sitting on the traces. */
  pad: string;
  /** Filled data blocks. */
  block: string;
  /** Rows of 0/1 running across the surface. */
  binary: string;
  /** Travelling pulses along the traces. */
  pulse: string;
  /** Light spilling across the plane beneath the brain. */
  planeGlow: string;
  /** Dotted brain contour and its connecting lines. */
  contour: string;
  /** Points of light sitting on the contour. */
  node: string;
  /** The two letters inside the brain. */
  ai: string;
  /** The bright point where the brain meets the plane glow, and its rays. */
  contact: string;
  /** Soft halo carried around the brain (the selective-bloom layer). */
  bloom: string;
};

export const V1_BLUE: Theme = {
  id: "blue",
  bgInner: "#06182e",
  bgOuter: "#020814",
  trace: "#1b4a9e",
  pad: "#3f86d8",
  block: "#2a6fe8",
  binary: "#4a9fe8",
  pulse: "#9fd8ff",
  planeGlow: "#2f7fd8",
  contour: "#8ad4ff",
  node: "#ffffff",
  ai: "#e8f4ff",
  contact: "#ffffff",
  bloom: "#4aa8ff",
};

/**
 * V2 is specified as silver/white with "no hue". The reference palette for it
 * (#050607..#101418, #3a4048, #6a727c, #9aa4ae, ...) is a cool grey, which
 * leaves a measurable blue cast in the encoded file - the mean blue channel
 * sits several levels above red. These are those same values converted to
 * their Rec.709 luma equivalents: identical tonal design, genuinely neutral,
 * and easier for a buyer to grade. `npm run check:neutral` asserts it.
 */
export const V2_MONO: Theme = {
  id: "mono",
  bgInner: "#131313",
  bgOuter: "#060606",
  trace: "#3f3f3f",
  pad: "#848484",
  block: "#717171",
  binary: "#a3a3a3",
  pulse: "#e9e9e9",
  planeGlow: "#939393",
  contour: "#f1f1f1",
  node: "#ffffff",
  ai: "#ffffff",
  contact: "#ffffff",
  bloom: "#b3b3b3",
};

export const THEMES: Record<string, Theme> = {
  blue: V1_BLUE,
  mono: V2_MONO,
};

/** three.js Color, cached per hex string so shader uniforms stay stable. */
const colorCache = new Map<string, Color>();
export const c3 = (hex: string): Color => {
  let col = colorCache.get(hex);
  if (!col) {
    col = new Color(hex);
    colorCache.set(hex, col);
  }
  return col;
};
