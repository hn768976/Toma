import { RIPPLE_AMPLITUDE, SWELL_AMPLITUDE } from "./constants";

// The two versions worth shipping. The geometry is the product here, so
// V2 is not just a hue swap: it doubles the displacement and adds a
// horizon glow band, which lands it in genuinely different territory
// (retro/synthwave title backgrounds) rather than the same clip recoloured.
export type GridPlaneVariant = {
  // Bulk line colour.
  lineColor: string;
  // Colour the "stronger" columns pick up.
  accentColor: string;
  // Multiplies the base line alpha.
  alphaScale: number;
  // Multiplies both noise amplitudes.
  displacementScale: number;
  // Optional glow band sitting on the horizon.
  horizonGlow: { color: string; opacity: number; heightFraction: number } | null;
};

export const VARIANTS: Record<"blue" | "synthwave", GridPlaneVariant> = {
  // V1 -- reference match. Cool white-blue, calm swell, no horizon band.
  blue: {
    lineColor: "#cfe0ff",
    accentColor: "#5b8fd6",
    alphaScale: 1,
    displacementScale: 1,
    horizonGlow: null,
  },
  // V2 -- magenta/cyan synthwave. Hotter line colour, ~2x displacement,
  // and a glow band bleeding up off the horizon.
  synthwave: {
    lineColor: "#ff86e8",
    accentColor: "#3ff0ff",
    alphaScale: 1.05,
    displacementScale: 2,
    horizonGlow: { color: "#ff2fb0", opacity: 0.34, heightFraction: 0.3 },
  },
};

export const swellAmplitude = (variant: GridPlaneVariant) =>
  SWELL_AMPLITUDE * variant.displacementScale;

export const rippleAmplitude = (variant: GridPlaneVariant) =>
  RIPPLE_AMPLITUDE * variant.displacementScale;
