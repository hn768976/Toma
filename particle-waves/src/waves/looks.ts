import { lerp, smooth } from "../gl/timeline";

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
    position: [lerp(0.15, -0.15, k), lerp(1.85, 1.75, k), lerp(1.55, 1.4, k)],
    target: [lerp(0.05, -0.15, k), -0.1, lerp(-0.35, -0.5, k)],
    roll: 0.03 * Math.sin(t * 0.35),
  };
};

// Version 2 — low-altitude flyover: the camera skims just above the cloth,
// banking through a sweeping arc so the folds rise like dunes toward a
// fog-softened horizon.
export const FLYOVER_RIG: CameraRig = (t) => {
  const k = smooth(0, 15, t) * 0.6 + (t / 15) * 0.4;
  const angle = lerp(-0.75, 0.65, k);
  const radius = lerp(5.4, 4.2, k);
  const height = lerp(1.05, 1.45, k) + 0.06 * Math.sin(t * 0.7);
  return {
    position: [Math.sin(angle) * radius, height, Math.cos(angle) * radius],
    target: [Math.sin(angle + 0.9) * 1.2, -0.35, Math.cos(angle + 0.9) * 1.2 - 0.6],
    roll: -0.11 * Math.sin(lerp(-0.9, 1.4, k)),
  };
};
