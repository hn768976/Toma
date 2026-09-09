import type { Stop } from "./color";

export type Theme = {
  background: string;
  /** Pill body, top to bottom. Kept nearly flat so text dropped in the middle
   *  is equally legible anywhere inside. */
  bodyTop: string;
  bodyBottom: string;
  /** Always-on hairline so the pill's outline reads even where the border is
   *  at its dimmest. */
  rim: string;
  innerShadow: string;
  innerShadowOpacity: number;
  innerShadowScale: number;
  /** Colour the border settles to where the highlight is not falling on it. */
  dim: string;
  /** Glow compositing. On a pale ground a normal-blended glow just washes out;
   *  multiply turns it into a proper colour cast instead. */
  glowBlend: "normal" | "plus-lighter";
  glowStrength: number;
  stops: Stop[];
  grain: { opacity: number; blend: "plus-lighter" | "multiply" };
};

/**
 * Hue positions are fixed to the shape and given as fractions of the
 * perimeter, clockwise from the top-left junction. The travelling highlight
 * moves over them; the hues themselves never rotate.
 */
const SPECTRUM: Stop[] = [
  { at: 0.0, hex: "#c840ff" }, // magenta — upper left
  { at: 0.19, hex: "#7a4aff" }, // violet — along the top
  { at: 0.375, hex: "#2a7aff" }, // blue — upper right
  { at: 0.5, hex: "#22d3ee" }, // cyan — lower right
  { at: 0.69, hex: "#3ae08a" }, // green — along the bottom
  { at: 0.875, hex: "#f0d020" }, // yellow — lower left
  // wraps back to magenta through the left cap
];

/** V2: the same construction over a narrow cyan-to-blue range. */
const COOL: Stop[] = [
  { at: 0.0, hex: "#1f52dc" },
  { at: 0.28, hex: "#2a7aff" },
  { at: 0.5, hex: "#22d3ee" },
  { at: 0.72, hex: "#3a8ff0" },
];

export const DARK_SPECTRUM: Theme = {
  background: "#000000",
  bodyTop: "#17171a",
  bodyBottom: "#121214",
  rim: "rgba(255,255,255,0.075)",
  innerShadow: "#000000",
  innerShadowOpacity: 0.55,
  innerShadowScale: 1,
  dim: "#000000",
  glowBlend: "plus-lighter",
  glowStrength: 1,
  stops: SPECTRUM,
  // Pure black bands badly around a glow ramp. A little upward dither at
  // ~1.5% kills it without visibly lifting the field.
  grain: { opacity: 0.03, blend: "plus-lighter" },
};

export const DARK_COOL: Theme = { ...DARK_SPECTRUM, stops: COOL };

export const LIGHT_SPECTRUM: Theme = {
  background: "#f4f5f7",
  bodyTop: "#ffffff",
  bodyBottom: "#f7f8fa",
  rim: "rgba(15,18,25,0.17)",
  innerShadow: "#5b6070",
  innerShadowOpacity: 0.13,
  innerShadowScale: 0.62,
  dim: "#d9dde5",
  glowBlend: "normal",
  glowStrength: 0.85,
  stops: SPECTRUM,
  // Pale ground doesn't band; keep grain minimal so H.264 doesn't turn it
  // into mosquito noise around the border.
  grain: { opacity: 0.014, blend: "multiply" },
};
