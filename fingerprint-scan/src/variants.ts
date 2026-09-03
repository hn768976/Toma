/**
 * The single source of truth for both versions.
 *
 * Every hex literal in this project lives in this file. The two versions differ
 * only by the data below — `scan.mode` in particular is what makes "verify" a
 * different piece rather than a second implementation.
 */

export type VariantName = "acquire" | "verify";

export type Palette = {
  bgDeep: string;
  bgWash: string;
  panelFill: string;
  panelFillAlpha: number;
  panelBorder: string;
  /** Ridge colour at rest. */
  ridge: string;
  /** Ridge colour immediately behind the scan line. */
  ridgeBright: string;
  /** The scan line's core. */
  scanCore: string;
  /** The scan line's glow. */
  scanGlow: string;
  globe: string;
  textPale: string;
  textBright: string;
};

/** A keyframe on the scan's progress curve: normalised time -> normalised travel. */
export type ScanStep = { t: number; p: number };

export type ScanConfig =
  | {
      mode: "acquire";
      /** Ridges exist only where the line has already been. */
      reveals: true;
      direction: "down";
      startFrame: number;
      endFrame: number;
      /** Deliberately uneven, with two plateaus. A linear sweep reads mechanical. */
      steps: ScanStep[];
      /** Length of the soft gradient at the reveal edge, in print-space px. */
      edgeSoftness: number;
      /** How long the just-passed region keeps glowing. */
      trailFrames: number;
    }
  | {
      mode: "verify";
      /** The print is already there; the line only brightens it. */
      reveals: false;
      direction: "up";
      /** Three passes, each faster and a little brighter than the last. */
      passes: { start: number; end: number; gain: number }[];
      trailFrames: number;
    };

export type MinutiaeConfig = {
  count: number;
  color: string;
  /** Markers arrive as this pass crosses them. */
  appearPass: number;
  /** Connector web is drawn across this pass. */
  connectPass: number;
  radius: number;
  tickLength: number;
  /** Max connector length as a fraction of the print's height. */
  maxLinkDistance: number;
  /** Links per marker, before seeded thinning — keeps the web irregular. */
  linksPerMarker: number;
};

export type OutcomeConfig =
  | { kind: "none" }
  | {
      kind: "match";
      label: string;
      /** Frame the plate stamps in on. */
      at: number;
      /** Stamp scale snaps from this to 1.0 over `stampFrames`, no easing. */
      fromScale: number;
      stampFrames: number;
      flashFrames: number;
      plateFill: string;
      plateBorder: string;
      plateText: string;
      flash: string;
    };

export type ReadoutConfig =
  | { kind: "percent"; label: string }
  | { kind: "confidence"; label: string; max: number; settleFrame: number };

export type VariantConfig = {
  palette: Palette;
  scan: ScanConfig;
  readout: ReadoutConfig;
  minutiae: MinutiaeConfig | null;
  outcome: OutcomeConfig;
  /** Print brightness ahead of / outside the scan. 0 = nothing until revealed. */
  restingRidge: number;
  /** Gentle pulse applied to the finished print. */
  holdPulse: { from: number; amplitude: number };
};

export const VARIANTS: Record<VariantName, VariantConfig> = {
  acquire: {
    palette: {
      bgDeep: "#030A1A",
      bgWash: "#0A1F3D",
      panelFill: "#061428",
      panelFillAlpha: 0.85,
      panelBorder: "#2E5C8A",
      ridge: "#4FA8E8",
      ridgeBright: "#A8DCFF",
      scanCore: "#E8F8FF",
      scanGlow: "#5FD4FF",
      globe: "#3F7FD4",
      textPale: "#7FB4D4",
      textBright: "#E8F4FF",
    },
    scan: {
      mode: "acquire",
      reveals: true,
      direction: "down",
      startFrame: 20,
      endFrame: 330,
      // Uneven slopes with plateaus at 34% and 71%.
      steps: [
        { t: 0.0, p: 0.0 },
        { t: 0.08, p: 0.07 },
        { t: 0.15, p: 0.19 },
        { t: 0.22, p: 0.26 },
        { t: 0.28, p: 0.34 },
        { t: 0.37, p: 0.34 },
        { t: 0.44, p: 0.42 },
        { t: 0.52, p: 0.54 },
        { t: 0.58, p: 0.6 },
        { t: 0.65, p: 0.71 },
        { t: 0.735, p: 0.71 },
        { t: 0.8, p: 0.78 },
        { t: 0.88, p: 0.91 },
        { t: 1.0, p: 1.0 },
      ],
      edgeSoftness: 108,
      trailFrames: 20,
    },
    readout: { kind: "percent", label: "ACQUISITION" },
    minutiae: null,
    outcome: { kind: "none" },
    restingRidge: 0,
    holdPulse: { from: 330, amplitude: 0.1 },
  },

  verify: {
    palette: {
      bgDeep: "#010F08",
      bgWash: "#063823",
      panelFill: "#04180E",
      panelFillAlpha: 0.85,
      panelBorder: "#2E7A52",
      ridge: "#3FB86A",
      ridgeBright: "#A8FFC4",
      scanCore: "#E8FFF0",
      scanGlow: "#5FE8A0",
      globe: "#3FD47A",
      textPale: "#7FD4A0",
      textBright: "#E8FFF0",
    },
    scan: {
      mode: "verify",
      reveals: false,
      direction: "up",
      // Each pass shorter (faster) and brighter than the one before.
      passes: [
        { start: 14, end: 132, gain: 0.72 },
        { start: 158, end: 258, gain: 0.86 },
        { start: 274, end: 348, gain: 1.0 },
      ],
      trailFrames: 16,
    },
    readout: { kind: "confidence", label: "CONFIDENCE", max: 99.4, settleFrame: 330 },
    minutiae: {
      count: 14,
      color: "#F5C43F",
      appearPass: 0,
      connectPass: 1,
      radius: 21,
      tickLength: 30,
      maxLinkDistance: 0.34,
      linksPerMarker: 2,
    },
    outcome: {
      kind: "match",
      label: "MATCH",
      at: 350,
      fromScale: 1.2,
      stampFrames: 4,
      flashFrames: 3,
      plateFill: "#0C5A2E",
      plateBorder: "#A8FFC4",
      plateText: "#E8FFF0",
      flash: "#A8FFC4",
    },
    restingRidge: 0.62,
    holdPulse: { from: 352, amplitude: 0.07 },
  },
};
