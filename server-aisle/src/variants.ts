// One data row per version. Add a colourway by adding a row (see README).
import type { GradeParams } from "./lib/post";

export type LookName = "serverAisle" | "frameTunnel" | "streamCorridor" | "screenCorridor" | "stageBeams";

export type Variant = {
  id: string;
  look: LookName;
  durationInFrames: number;
  /** Loop length; 0 for one-shot transitions. */
  loop: number;
  params: Record<string, unknown> & { grade?: GradeParams };
};

export const VARIANTS: Variant[] = [
  {
    id: "ServerAisle-Steel",
    look: "serverAisle",
    durationInFrames: 600,
    loop: 600,
    params: {
      ledA: "#5AE8FF",
      ledB: "#6AFF8A",
      grade: { exposure: 1.05, contrast: 1.1, saturation: 1.0, lift: [0.012, 0.016, 0.016], gain: [0.96, 1.01, 1.0], vignette: 0.45, grain: 0.015 },
    },
  },
  {
    id: "FrameTunnel-WhiteBurst",
    look: "frameTunnel",
    durationInFrames: 180,
    loop: 0,
    params: {
      mode: "burst",
      colorA: "#F4F6FF",
      colorB: "#F4F6FF",
      slat: "#3a3b3e",
      grade: { exposure: 1.0, contrast: 1.08, saturation: 1.0, vignette: 0.6, grain: 0.012 },
    },
  },
  {
    id: "FrameTunnel-CyanMagenta",
    look: "frameTunnel",
    durationInFrames: 600,
    loop: 600,
    params: {
      mode: "loop",
      colorA: "#3AE8FF",
      colorB: "#FF3AC8",
      slat: "#101018",
      grade: { exposure: 1.0, contrast: 1.05, saturation: 1.05, vignette: 0.4, grain: 0.0 },
    },
  },
  {
    id: "StreamCorridor-Blue",
    look: "streamCorridor",
    durationInFrames: 600,
    loop: 600,
    params: {
      ribbon: "#2A7AFF",
      edge: "#F2F7FF",
      grade: { exposure: 1.05, contrast: 1.02, saturation: 1.15, lift: [0.0, 0.025, 0.06], gain: [0.85, 0.98, 1.1], vignette: 0.4, grain: 0.015 },
    },
  },
  {
    id: "ScreenCorridor-GreenBlue",
    look: "screenCorridor",
    durationInFrames: 600,
    loop: 600,
    params: {
      bars: "#6AFF3A",
      panels: "#2A6AFF",
      icons: "#C84AE8",
      floor: "#7A8CA0",
      grade: { exposure: 1.0, contrast: 1.08, saturation: 1.1, gain: [0.86, 1.0, 1.14], vignette: 0.35, grain: 0.015, toneMap: false },
    },
  },
  {
    id: "ScreenCorridor-AmberTeal",
    look: "screenCorridor",
    durationInFrames: 600,
    loop: 600,
    params: {
      bars: "#FFB43A",
      panels: "#1AC8C0",
      icons: "#E8F0F0",
      floor: "#8A8070",
      grade: { exposure: 1.0, contrast: 1.08, saturation: 1.1, gain: [1.08, 1.0, 0.9], vignette: 0.35, grain: 0.015, toneMap: false },
    },
  },
  {
    id: "StageBeams-Steel",
    look: "stageBeams",
    durationInFrames: 600,
    loop: 600,
    params: {
      beam: "#7AA8C8",
      fringe: "#E8803A",
      pool: "#9AC0E0",
      background: "#05080C",
      grade: { exposure: 1.0, contrast: 1.0, saturation: 1.0, vignette: 0.55, vignetteSoft: 0.6, grain: 0.022 },
    },
  },
  {
    id: "StageBeams-Amber",
    look: "stageBeams",
    durationInFrames: 600,
    loop: 600,
    params: {
      beam: "#F0C070",
      fringe: "#E86A4A",
      pool: "#E8C890",
      background: "#0A0705",
      grade: { exposure: 1.0, contrast: 1.0, saturation: 1.0, vignette: 0.55, vignetteSoft: 0.6, grain: 0.022 },
    },
  },
];
