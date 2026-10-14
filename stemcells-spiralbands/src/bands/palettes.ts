import type { BandColors } from "./types";

export const BANDS_WHITE: BandColors = {
  band: "#F0F0F2",
  floor: "#E6E6EA",
  roughness: 0.5,
  ambientSky: "#EEF0FA",
  ambientGround: "#B4B8CC",
  ambient: 1.05,
  key: { color: "#FFFFFF", intensity: 1.6, dir: [1.1, 1.8, -0.6] },
  sweep: { color: "#F4F6FF", intensity: 0.9, elevation: 0.45 },
  env: 0.5,
  aoStrength: 0.9,
  exposure: 1.12,
  grain: 0.015,
};

export const BANDS_GRAPHITE: BandColors = {
  band: "#2A2C30",
  floor: "#222428",
  roughness: 0.5,
  ambientSky: "#9AA3B4",
  ambientGround: "#2A2C30",
  ambient: 0.9,
  key: { color: "#F2F4F8", intensity: 1.3, dir: [1.2, 1.4, -0.8] },
  // A cool, low rim light that sweeps round once per loop.
  sweep: { color: "#8FB8FF", intensity: 3.2, elevation: 0.16 },
  env: 0.5,
  aoStrength: 0.85,
  exposure: 1.0,
  grain: 0.015,
};
