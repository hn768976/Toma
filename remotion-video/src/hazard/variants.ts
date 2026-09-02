/**
 * The one and only place a colour literal appears in this piece.
 *
 * A variant bundles three things and nothing else: a palette, which symbol to
 * draw, and how the energy inside it behaves. Every other module in the folder
 * is written against these types and never against a specific variant — the
 * plate, ring, shimmer and animation cannot tell a trefoil from a biohazard.
 */

export type VariantName = "radiation" | "biohazard";

/** Which shape <SymbolShape> should build. Only that module reads this. */
export type SymbolType = "radiation" | "biohazard";

export interface HazardPalette {
  /** Base tone of the metal plate. */
  plateDark: string;
  /** The plate's lighter worn patches. */
  plateMid: string;
  /** Perforation holes punched through the plate. */
  plateHole: string;
  /** The near-black disc the symbol is printed onto. */
  discBlack: string;
  /** The symbol's fill, and the shimmer's mid point. */
  symbol: string;
  /** The shimmer's peaks — near white. */
  symbolBright: string;
  /** The shimmer's troughs — just below the base accent. */
  symbolDark: string;
  /** The outer ring's stroke. */
  ring: string;
  /** The glow thrown by the outer ring and the symbol's rim. */
  ringGlow: string;
}

/**
 * How the energy inside the symbol behaves. "hot" crackles on the surface;
 * "organic" moves underneath it.
 */
export interface ShimmerSpec {
  /** Human-readable character, for documentation and debugging. */
  character: "hot" | "organic";
  /** Weight of the slow, large-scale drift in the multiplied field. */
  lowWeight: number;
  /** Weight of the fast, fine-scale flicker. */
  highWeight: number;
  /** Cycles-per-loop range for the fast band. Integers only. */
  highCycles: [number, number];
  /** Cycles-per-loop range for the slow band. Integers only. */
  lowCycles: [number, number];
  /** Spatial frequency range of the slow band, in cycles across the layer. */
  lowFreq: [number, number];
  /** Spatial frequency range of the fast band. Coarser reads as organic. */
  highFreq: [number, number];
  /** Contrast applied to the combined field before the colour ramp. */
  contrast: number;
  /** How much brighter the shimmer runs within a rim of the symbol's edge. */
  edgeBoost: number;
  /** Opacity of the wisps escaping past the outline. */
  wispGain: number;
  /** Blur, in layer pixels, applied to those wisps. */
  wispBlur: number;
  /** Frames between flares, min and max. */
  flareGap: [number, number];
  /** Frames a flare lasts, min and max. */
  flareDuration: [number, number];
  /** Fraction of a flare's life spent rising. Small = a sharp strike. */
  flareOnset: number;
}

export interface HazardVariant {
  palette: HazardPalette;
  symbol: SymbolType;
  shimmer: ShimmerSpec;
}

export const VARIANTS: Record<VariantName, HazardVariant> = {
  radiation: {
    symbol: "radiation",
    palette: {
      plateDark: "#14140F",
      plateMid: "#24241C",
      plateHole: "#0A0A08",
      discBlack: "#0A0A06",
      symbol: "#E8D419",
      symbolBright: "#FFF88A",
      symbolDark: "#7A6A08",
      ring: "#F5E42E",
      ringGlow: "#FFF470",
    },
    shimmer: {
      character: "hot",
      lowWeight: 0.55,
      highWeight: 0.9,
      lowCycles: [1, 3],
      highCycles: [5, 12],
      lowFreq: [1.5, 4],
      highFreq: [13, 30],
      contrast: 1.15,
      edgeBoost: 0.55,
      wispGain: 1.5,
      wispBlur: 9,
      flareGap: [60, 110],
      flareDuration: [5, 8],
      flareOnset: 0.18,
    },
  },
  biohazard: {
    symbol: "biohazard",
    palette: {
      plateDark: "#140C0A",
      plateMid: "#241812",
      plateHole: "#0A0605",
      discBlack: "#0A0504",
      symbol: "#E86A19",
      symbolBright: "#FFB870",
      symbolDark: "#7A3208",
      ring: "#F57A2E",
      ringGlow: "#FFA860",
    },
    shimmer: {
      character: "organic",
      // The slow band dominates: something moving under the surface rather
      // than crackling on it.
      lowWeight: 1,
      highWeight: 0.3,
      lowCycles: [1, 2],
      highCycles: [2, 5],
      lowFreq: [1.2, 3],
      highFreq: [7, 16],
      contrast: 0.95,
      edgeBoost: 0.45,
      // Half the escaping wisps of the radiation variant, blurred further.
      wispGain: 0.75,
      wispBlur: 20,
      flareGap: [100, 180],
      flareDuration: [12, 18],
      flareOnset: 0.45,
    },
  },
};
