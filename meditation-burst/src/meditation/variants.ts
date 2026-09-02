/**
 * The single source of truth for every variant-specific value in the
 * piece — palette, burst direction, filament density and foreground
 * mode, plus the handful of tuning numbers that follow from them.
 *
 * No hex literal appears anywhere else in the project: components read
 * colours from `config.palette` only. Likewise the burst's direction is
 * a signed number here rather than an assumption baked into the
 * geometry, because the "inward" variant reverses it.
 */

export type VariantName = "gold" | "cool" | "inward";

export type Palette = {
  /** Page background; also the colour the water surface settles to. */
  backgroundDeep: string;
  /** The hottest centre of the core glow. */
  coreWhite: string;
  /** The core glow's mid tone, between white and the filament hue. */
  coreMid: string;
  /** The filament field's main hue — the mid rendering channel. */
  filamentMid: string;
  /** The outer reaches of the filament field. */
  filamentDeep: string;
  /** Spark colour. */
  sparkPale: string;
  /** The figure and the whole foreground. */
  silhouette: string;
};

/**
 * Shape of the angular distribution, measured as an angular distance
 * `phi` from straight up. Even spacing produces a sunburst, so every
 * variant biases its rays somehow.
 */
export type AngularProfile = {
  /** Weight retained at `phi = PI` (straight down). */
  floor: number;
  /** Exponent on cos(phi/2); larger tightens the fan toward "up". */
  concentration: number;
  /** Extra suppression of rays aimed into the ground, 0..1. */
  horizonCut: number;
};

export type CoreGlowMode =
  /** Steady +/-10% breath on a sine whose period divides the loop. */
  | "breathe"
  /** Dim at frame 0, accumulating to a late peak, easing back by the end. */
  | "accumulate";

export type VariantConfig = {
  palette: Palette;
  /** +1 radiates away from the origin, -1 converges on it. */
  burstDirection: 1 | -1;
  /** Filament count before branches are added. */
  filamentCount: number;
  foreground: "grass" | "water";

  angular: AngularProfile;
  /** Per-filament reach as a fraction of the distance to the frame edge. */
  reach: { min: number; max: number };
  /** Half-width of a filament at the origin, in 4K pixels. */
  filamentWidth: number;
  /** Global multiplier on filament opacity. */
  filamentOpacity: number;

  sparkCount: number;

  /** Horizon y as a fraction of frame height. */
  horizonFraction: number;
  /** Figure height as a fraction of frame height. */
  figureFraction: number;

  coreGlow: {
    /** Outer radius as a fraction of frame height. */
    radiusFraction: number;
    mode: CoreGlowMode;
    intensity: number;
  };
};

export const VARIANTS: Record<VariantName, VariantConfig> = {
  /**
   * Warm, abundant, enveloping. Filaments radiate outward and surround
   * the figure, densest above the head and thinning toward the horizon.
   */
  gold: {
    palette: {
      backgroundDeep: "#0A0602",
      coreWhite: "#FFFDF0",
      coreMid: "#FFD46A",
      filamentMid: "#E8A02E",
      filamentDeep: "#A85C14",
      sparkPale: "#FFE8B8",
      silhouette: "#000000",
    },
    burstDirection: 1,
    filamentCount: 320,
    foreground: "grass",
    angular: { floor: 0.14, concentration: 2.3, horizonCut: 0.7 },
    reach: { min: 0.34, max: 1.06 },
    filamentWidth: 7.5,
    filamentOpacity: 1,
    sparkCount: 500,
    horizonFraction: 0.795,
    figureFraction: 0.34,
    coreGlow: { radiusFraction: 0.3, mode: "breathe", intensity: 1 },
  },

  /**
   * Clear and directional. Warm light reads as abundant; cool light
   * reads as a shaft. Fewer, longer, slightly thicker filaments packed
   * into a narrow fan above the head, over a still water horizon.
   */
  cool: {
    palette: {
      backgroundDeep: "#02060E",
      coreWhite: "#FFFFFF",
      coreMid: "#A8E8FF",
      filamentMid: "#4F9FE8",
      filamentDeep: "#1A4A8A",
      sparkPale: "#D8F0FF",
      silhouette: "#000000",
    },
    burstDirection: 1,
    filamentCount: 170,
    foreground: "water",
    angular: { floor: 0.01, concentration: 8.5, horizonCut: 0.94 },
    reach: { min: 0.62, max: 1.14 },
    filamentWidth: 9.5,
    filamentOpacity: 1.05,
    sparkCount: 500,
    horizonFraction: 0.685,
    figureFraction: 0.34,
    coreGlow: { radiusFraction: 0.3, mode: "breathe", intensity: 1 },
  },

  /**
   * Violet, and reversed. Filaments enter at the frame edges and travel
   * inward, crowding as they converge behind the head; the core visibly
   * accumulates what they feed it across the loop. Densest of the three,
   * at reduced per-filament opacity so the convergence does not blow out.
   */
  inward: {
    palette: {
      backgroundDeep: "#08041A",
      coreWhite: "#F8F0FF",
      coreMid: "#B88AFF",
      filamentMid: "#7B4FD4",
      filamentDeep: "#3A1A7A",
      sparkPale: "#E0C8FF",
      silhouette: "#000000",
    },
    burstDirection: -1,
    filamentCount: 420,
    foreground: "grass",
    angular: { floor: 0.66, concentration: 0.85, horizonCut: 0.4 },
    reach: { min: 1, max: 1.14 },
    filamentWidth: 7,
    filamentOpacity: 0.75,
    sparkCount: 500,
    horizonFraction: 0.795,
    figureFraction: 0.34,
    coreGlow: { radiusFraction: 0.3, mode: "accumulate", intensity: 1.05 },
  },
};

/** Weight for a ray at angle `phi` away from straight up. */
export const angularWeight = (profile: AngularProfile, phi: number): number => {
  const base =
    profile.floor +
    (1 - profile.floor) * Math.pow(Math.cos(phi / 2), profile.concentration);
  // Rays aimed into the ground are hidden by the foreground; damp them
  // rather than spending filaments there.
  const downwardness = Math.max(0, Math.cos(Math.PI - phi));
  return base * (1 - profile.horizonCut * Math.pow(downwardness, 1.6));
};
