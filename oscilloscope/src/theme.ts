/**
 * The two versions differ only in this file. V1 matches the reference's
 * multicolour scope; V2 is a single-hue phosphor CRT that separates its traces
 * by brightness and line weight instead of by hue — without that separation a
 * monochrome scope reads as mush.
 */

export type TraceKey =
  | "noiseTop"
  | "sineMain"
  | "sineSecondary"
  | "square"
  | "noiseBottom";

export type TraceStyle = {
  color: string;
  /** Core stroke width in design (4K) px. */
  width: number;
  /** Bloom pass stroke width in design px. */
  glowWidth: number;
  glowOpacity: number;
  opacity: number;
};

export type Theme = {
  id: string;
  background: string;
  /** Subtle lift towards the centre of the screen. */
  centerGlow: string;
  gridColor: string;
  gridMinorOpacity: number;
  gridMajorOpacity: number;
  labelColor: string;
  labelOpacity: number;
  sweepColor: string;
  /** Blur radius of the bloom pass, in design px. */
  bloom: number;
  traces: Record<TraceKey, TraceStyle>;
};

export const V1: Theme = {
  id: "v1",
  background: "#040a18",
  centerGlow: "#0d1f3d",
  gridColor: "#2765a2",
  gridMinorOpacity: 0.3,
  gridMajorOpacity: 0.52,
  labelColor: "#6a90b8",
  labelOpacity: 0.8,
  sweepColor: "#9fd8f5",
  bloom: 20,
  traces: {
    noiseTop: {
      color: "#e8f0f8",
      width: 3,
      glowWidth: 11,
      glowOpacity: 0.5,
      opacity: 0.9,
    },
    sineMain: {
      color: "#22d3ee",
      width: 6,
      glowWidth: 26,
      glowOpacity: 1,
      opacity: 1,
    },
    sineSecondary: {
      color: "#2a6fe8",
      width: 4,
      glowWidth: 15,
      glowOpacity: 0.6,
      opacity: 0.8,
    },
    square: {
      color: "#4a9fe8",
      width: 5,
      glowWidth: 19,
      glowOpacity: 0.85,
      opacity: 0.98,
    },
    noiseBottom: {
      color: "#e0303a",
      width: 4,
      glowWidth: 16,
      glowOpacity: 0.8,
      opacity: 0.95,
    },
  },
};

export const V2: Theme = {
  id: "v2",
  background: "#020806",
  centerGlow: "#06241a",
  gridColor: "#0d3a24",
  gridMinorOpacity: 0.5,
  gridMajorOpacity: 0.95,
  labelColor: "#2f8f5a",
  labelOpacity: 0.8,
  sweepColor: "#8ff0b4",
  bloom: 22,
  traces: {
    // Dim and thin: reads as the quietest signal on the screen.
    noiseTop: {
      color: "#1f9a54",
      width: 3,
      glowWidth: 10,
      glowOpacity: 0.42,
      opacity: 0.92,
    },
    // The brightest, heaviest trace — the eye's anchor.
    sineMain: {
      color: "#4ade80",
      width: 7,
      glowWidth: 28,
      glowOpacity: 1,
      opacity: 1,
    },
    // Dimmest and thinnest, so it sits clearly behind the main sine.
    sineSecondary: {
      color: "#1a8a4a",
      width: 3,
      glowWidth: 13,
      glowOpacity: 0.62,
      opacity: 0.9,
    },
    // Mid-bright, heavy: the flat tops need weight to read as a square wave.
    square: {
      color: "#33c46c",
      width: 5,
      glowWidth: 18,
      glowOpacity: 0.66,
      opacity: 0.95,
    },
    noiseBottom: {
      color: "#26ab60",
      width: 4,
      glowWidth: 15,
      glowOpacity: 0.6,
      opacity: 0.95,
    },
  },
};
