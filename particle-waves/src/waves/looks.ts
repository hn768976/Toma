import { lerp } from "../gl/timeline";

export type WavePalette = {
  bgDeep: string;
  bgGlow: string;
  deep: string;
  base: string;
  highlight: string;
};

export type CameraPose = {
  position: [number, number, number];
  target: [number, number, number];
  roll: number;
};
export type CameraRig = (t: number) => CameraPose;

// Teal particle cloth, matched to the reference (used by both versions —
// version 2 differs by camera, not colour).
export const TEAL: WavePalette = {
  bgDeep: "#020a0d",
  bgGlow: "#0b3d4a",
  deep: "#0a3a40",
  base: "#1f9a9a",
  highlight: "#7ff5ec",
};

// Version 1 — reference framing: a high three-quarter view looking down into
// the folds, with a slow, almost imperceptible drift.
export const HOVER_RIG: CameraRig = (t) => {
  const k = t / 15;
  return {
    position: [lerp(0.15, -0.2, k), lerp(1.45, 1.38, k), lerp(1.3, 1.1, k)],
    target: [lerp(0.05, -0.2, k), -0.45, lerp(-0.25, -0.45, k)],
    roll: 0.03 * Math.sin(t * 0.35),
  };
};

// Version 2 — low-altitude flyover: the camera travels forward a few metres
// over the cloth on a gentle S-curve, banking into each turn, so the folds
// stream beneath the lens toward a fog-softened horizon.
export const FLYOVER_RIG: CameraRig = (t) => {
  const z = lerp(5.2, -1.6, t / 15);
  const x = 1.3 * Math.sin(t * 0.33);
  const heading = 1.3 * 0.33 * Math.cos(t * 0.33) / (6.8 / 15); // dx/dz along the path
  const height = 1.3 + 0.08 * Math.sin(t * 0.6);
  return {
    position: [x, height, z],
    target: [x - heading * 1.6, -0.25, z - 1.9],
    roll: 0.12 * heading,
  };
};
