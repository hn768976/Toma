import type { SeriesParams } from "./series";

// Every colour and every series characteristic in this family lives here,
// keyed by variant name. The component reads nothing but this object, so a
// new look is a new key rather than a new component.

export type Palette = {
  backgroundDeep: string;
  backgroundWash: string;
  gridLine: string;
  candleUp: string;
  candleDown: string;
  labelPale: string;
  labelBright: string;
};

export type LabelConfig = {
  count: number;
  minSize: number; // px at 4K
  maxSize: number;
  minOpacity: number;
  maxOpacity: number;
  // Scales the radii of the closed drift paths. Lower = slower, since the
  // periods themselves are fixed by the loop.
  driftScale: number;
};

export type Treatment = {
  // Fraction of the frame height the tile's full high-to-low range fills.
  // A trending series spends most of its range on the trend, so it needs a
  // taller plot to keep the individual candles large.
  plotFill: number;
  // Additive glow in each candle's own colour. Wrong on a light ground, so
  // the light variant swaps it for a soft drop shadow instead.
  glow: boolean;
  shadow: boolean;
  // Blurred candles are lifted toward the background colour by this much at
  // full blur, so defocus softens toward the ground rather than muddying it.
  dofLift: number;
  // On a light ground the corners lighten instead of darkening.
  vignetteLighten: boolean;
  vignetteStrength: number;
  backgroundWashOpacity: number;
  gridOpacity: number;
};

export type Variant = {
  palette: Palette;
  series: SeriesParams;
  labels: LabelConfig;
  treatment: Treatment;
};

export const VARIANT_NAMES = ["neonBlue", "amberDark", "monoLight"] as const;
export type VariantName = (typeof VARIANT_NAMES)[number];

export const VARIANTS: Record<VariantName, Variant> = {
  // Volatile and range-bound: no overall direction, frequent reversals, long
  // wicks. The eye reads individual candles rather than a trend.
  neonBlue: {
    palette: {
      backgroundDeep: "#0A1230",
      backgroundWash: "#16255E",
      gridLine: "#1E3566",
      candleUp: "#3FE8F5",
      candleDown: "#F5486B",
      labelPale: "#6F8FD4",
      labelBright: "#A8C4F0",
    },
    series: {
      seed: 20514,
      volatility: 3.1,
      runLength: 1.8,
      trendBias: 0,
      pullbackDamp: 1,
      pullbackRunScale: 1,
      // Range-bound: pinned to zero net so it never wanders vertically.
      netTarget: 0,
      wickFrequency: 0.62,
      wickScale: 2.1,
      baseWickScale: 0.42,
      shocks: [],
    },
    labels: {
      count: 34,
      minSize: 24,
      maxSize: 90,
      minOpacity: 0.08,
      maxOpacity: 0.35,
      driftScale: 1,
    },
    treatment: {
      plotFill: 0.72,
      glow: true,
      shadow: false,
      dofLift: 0.18,
      vignetteLighten: false,
      vignetteStrength: 0.55,
      backgroundWashOpacity: 0.85,
      gridOpacity: 0.55,
    },
  },

  // A steady climb: long up-runs, short shallow pullbacks, fewer and shorter
  // wicks. Warm throughout — up/down is carried by brightness (amber vs
  // sienna) more than by hue, a subtler contrast that suits the calmer read.
  amberDark: {
    palette: {
      backgroundDeep: "#140A02",
      backgroundWash: "#3A2008",
      gridLine: "#4A2E10",
      candleUp: "#FFC44F",
      candleDown: "#C4553A",
      labelPale: "#8A6A3F",
      labelBright: "#E8C48F",
    },
    series: {
      seed: 71822,
      volatility: 2.2,
      runLength: 3.6,
      trendBias: 0.35,
      pullbackDamp: 0.6,
      pullbackRunScale: 0.5,
      wickFrequency: 0.16,
      wickScale: 0.55,
      baseWickScale: 0.22,
      shocks: [],
    },
    // Half of neonBlue's count and slower drift: the warm palette carries
    // less contrast, so a busy backdrop muddies it.
    labels: {
      count: 17,
      minSize: 24,
      maxSize: 90,
      minOpacity: 0.08,
      maxOpacity: 0.32,
      driftScale: 0.45,
    },
    treatment: {
      plotFill: 0.9,
      glow: true,
      shadow: false,
      dofLift: 0.2,
      vignetteLighten: false,
      vignetteStrength: 0.5,
      backgroundWashOpacity: 0.8,
      gridOpacity: 0.5,
    },
  },

  // Light mode, and an inversion rather than a recolour: no glow, labels go
  // darker than the ground, defocus softens toward white and the vignette
  // lightens the corners. A sharp decline — short steep drops, weak failed
  // rallies, one near-vertical capitulation two-thirds through — which on a
  // pale ground reads as a financial-press graphic.
  monoLight: {
    palette: {
      backgroundDeep: "#F2F4F7",
      backgroundWash: "#E4E9F0",
      gridLine: "#D0D8E2",
      candleUp: "#2E7A4A",
      candleDown: "#C43A4A",
      labelPale: "#B8C2CE",
      labelBright: "#8A98A8",
    },
    series: {
      seed: 33907,
      volatility: 2.3,
      runLength: 3,
      trendBias: -0.35,
      pullbackDamp: 0.6,
      // Rallies are weak: they fail after a candle or two.
      pullbackRunScale: 0.4,
      wickFrequency: 0.3,
      wickScale: 1,
      baseWickScale: 0.3,
      // Two thirds through the tile, a single near-vertical drop.
      shocks: [{ index: 20, magnitude: 4.6 }],
    },
    labels: {
      count: 34,
      minSize: 24,
      maxSize: 90,
      // Dark text on pale reads much stronger than pale on dark, so these
      // sit far lower than the dark variants'.
      minOpacity: 0.05,
      maxOpacity: 0.1,
      driftScale: 1,
    },
    treatment: {
      plotFill: 0.88,
      glow: false,
      shadow: true,
      dofLift: 0.55,
      vignetteLighten: true,
      vignetteStrength: 0.1,
      backgroundWashOpacity: 1,
      gridOpacity: 1,
    },
  },
};
