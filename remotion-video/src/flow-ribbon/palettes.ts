// Colour definitions for the two deliverable variants.
//
// "reference" tracks the source clip: deep blue strands running through
// violet into magenta, with cyan/mint/pink sparkle in the particle cloud.
//
// "cyan" is the requested dark-blue + cyan treatment. Magenta is removed
// entirely; the accent slot the reference gives to pink is taken by
// teal-green so the cloud keeps its colour variety.

import type { Variant } from "./constants";

export type ParticleSwatch = {
  /** Hex colour of the sprite. */
  color: string;
  /** Relative share of the cloud, normalised against the other swatches. */
  weight: number;
  /** Emissive multiplier - drives how hard this swatch pushes into bloom. */
  intensity: number;
};

export type Palette = {
  /** Flat clear colour behind everything. */
  background: string;
  /** Soft radial wash sitting behind the band, lifting it off the black. */
  backgroundGlow: string;
  /**
   * Four-stop ramp across the strand bundle, sampled by a blend of
   * along-band position and strand index: [0] is the far/leading end,
   * [3] the near/trailing end.
   */
  strandRamp: [string, string, string, string];
  /** Specular streak colour running along the crest of each strand. */
  strandHighlight: string;
  /** Fresnel colour at the grazing edges of each strand. */
  strandRim: string;
  /** Three-stop ramp for the additive haze sheet, bottom to top. */
  haze: [string, string, string];
  /** Overall haze opacity multiplier. */
  hazeIntensity: number;
  /**
   * Particle cloud swatches, split by how far the particle sits from the
   * focal plane. In the reference the two populations are visibly different:
   * the sharp specks sitting on the band are white and near-white, while the
   * big defocused discs drifting toward camera are distinctly cool - they are
   * lit by the band rather than being highlights in their own right. Picking
   * the swatch from the particle's own defocus reproduces that split instead
   * of averaging the whole cloud to grey.
   */
  particles: {
    /** Near the focal plane: small, sharp, bright. */
    spark: ParticleSwatch[];
    /** Well off the focal plane: large, soft, cooler. */
    bokeh: ParticleSwatch[];
  };
};

const REFERENCE: Palette = {
  background: "#05060f",
  backgroundGlow: "#0d1136",
  strandRamp: ["#37179e", "#3b2ddd", "#2a58ea", "#123caf"],
  strandHighlight: "#c3cdff",
  strandRim: "#8f5cff",
  haze: ["#3a1f9e", "#2a44d8", "#c05ac4"],
  hazeIntensity: 1,
  particles: {
    spark: [
      { color: "#ffffff", weight: 40, intensity: 1.5 },
      { color: "#cfe6ff", weight: 28, intensity: 1.3 },
      { color: "#6fe9ff", weight: 20, intensity: 1.35 },
      { color: "#86f6cf", weight: 6, intensity: 1.3 },
      { color: "#ff8ade", weight: 6, intensity: 1.4 },
    ],
    bokeh: [
      { color: "#3f7dff", weight: 30, intensity: 1.15 },
      { color: "#2fc6ff", weight: 26, intensity: 1.2 },
      { color: "#6b4fe0", weight: 18, intensity: 1.05 },
      { color: "#b06bff", weight: 12, intensity: 1.1 },
      { color: "#2ad8c0", weight: 8, intensity: 1.15 },
      { color: "#ff6bd6", weight: 6, intensity: 1.2 },
    ],
  },
};

const CYAN: Palette = {
  background: "#03060f",
  backgroundGlow: "#04122c",
  strandRamp: ["#071a5e", "#0c3596", "#0c68b4", "#0d9fbe"],
  strandHighlight: "#9fe4ff",
  strandRim: "#27d7ff",
  haze: ["#091d68", "#0d4aa6", "#0f8fc8"],
  hazeIntensity: 0.88,
  particles: {
    spark: [
      { color: "#ffffff", weight: 40, intensity: 1.5 },
      { color: "#d6f2ff", weight: 30, intensity: 1.3 },
      { color: "#62eaff", weight: 22, intensity: 1.35 },
      { color: "#6cffd8", weight: 8, intensity: 1.3 },
    ],
    bokeh: [
      { color: "#1f6ce0", weight: 30, intensity: 1.15 },
      { color: "#17b6e8", weight: 28, intensity: 1.2 },
      { color: "#1b47b8", weight: 18, intensity: 1.05 },
      { color: "#19d9c0", weight: 16, intensity: 1.15 },
      { color: "#4fd2ff", weight: 8, intensity: 1.2 },
    ],
  },
};

export const PALETTES: Record<Variant, Palette> = {
  reference: REFERENCE,
  cyan: CYAN,
};

export const getPalette = (variant: Variant): Palette => PALETTES[variant];
