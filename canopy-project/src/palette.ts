/**
 * The two looks. Everything colour-related lives here so V1 can be verified as
 * strictly neutral — every V1 value below has R = G = B.
 */

export type Palette = {
  /** Sky at the vanishing point, and out at the corners. */
  skyCentre: string;
  skyEdge: string;
  /** Ellipse radii of the sky gradient, as percentages of the frame. */
  skySize: readonly [string, string];
  /**
   * The falloff, as [stop position %, how far toward skyEdge] pairs. Spelling
   * the ramp out rather than letting the browser interpolate two stops is what
   * keeps a near-flat 4K gradient from banding once encoded.
   */
  skyRamp: readonly (readonly [number, number])[];
  /** Tree fill per depth tier, near → far. Fog lifts the far tiers. */
  tiers: readonly string[];
  /** Gaussian blur in composition px per depth tier, near → far. */
  tierBlur: readonly number[];
  tierOpacity: readonly number[];
  /** Drifting fog masses. */
  fog: string;
  fogOpacity: number;
  /** Glow around the vanishing point. */
  bloom: string;
  bloomOpacity: number;
  vignette: number;
  stars: boolean;
};

export const MONO_FOG: Palette = {
  skyCentre: "#fcfcfc",
  skyEdge: "#bcbcbc",
  // A broad, soft field — the overcast winter sky is bright nearly everywhere.
  skySize: ["96%", "112%"],
  skyRamp: [
    [0, 0],
    [12, 0.06],
    [32, 0.24],
    [56, 0.52],
    [80, 0.8],
    [100, 1],
  ],
  tiers: ["#000000", "#242424", "#6b6b6b", "#a3a3a3"],
  tierBlur: [1.2, 3, 7, 15],
  tierOpacity: [1, 1, 0.96, 0.88],
  fog: "255, 255, 255",
  fogOpacity: 0.5,
  bloom: "255, 255, 255",
  bloomOpacity: 0.42,
  vignette: 0.24,
  stars: false,
};

export const BLUE_NIGHT: Palette = {
  skyCentre: "#d7e7f8",
  skyEdge: "#0b1b33",
  // Tight and fast-falling, so the lift reads as a moon behind the canopy
  // rather than as daylight.
  skySize: ["60%", "72%"],
  skyRamp: [
    [0, 0],
    [7, 0.14],
    [18, 0.42],
    [34, 0.7],
    [58, 0.9],
    [100, 1],
  ],
  tiers: ["#000206", "#04101f", "#0c1e34", "#173049"],
  tierBlur: [1.2, 3, 7, 15],
  tierOpacity: [1, 1, 0.97, 0.9],
  fog: "150, 188, 228",
  fogOpacity: 0.34,
  bloom: "197, 220, 244",
  bloomOpacity: 0.55,
  vignette: 0.44,
  stars: true,
};
