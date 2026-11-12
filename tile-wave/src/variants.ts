import type { CameraState, Look } from "./scene/TileRenderer";

// 267 frames @ 30 fps = 8.9 s, matching the reference's 267 frames (29.97 fps).
export const FPS = 30;
export const DURATION_IN_FRAMES = 267;
export const WIDTH = 3840;
export const HEIGHT = 2160;

export type VariantName = "v1" | "v2";

// Pastel candy palette keyed on depth below the surface: pink surface ->
// magenta -> violet -> periwinkle -> white -> warm yellow glow at the floor.
export const LOOK: Look = {
  stops: [
    { depth: 0.0, color: "#fff4f3" },
    { depth: 0.5, color: "#f2bfdf" },
    { depth: 1.15, color: "#b048c8" },
    { depth: 1.95, color: "#6a1fa8" },
    { depth: 2.75, color: "#8db0f5" },
    { depth: 3.2, color: "#f4f6ff" },
    { depth: 3.9, color: "#fff3a8" },
  ],
  // Pillars raised above the surface (crater rim / snap-shut pop).
  upStops: [
    { height: 0.0, color: "#fff4f3" },
    { height: 1.0, color: "#f6d4ea" },
    { height: 2.0, color: "#e08edc" },
    { height: 3.2, color: "#b866da" },
  ],
  background: "#fff6f4",
  shadowTint: "#a95cc4",
  emissiveFrom: 2.2,
  emissiveTo: 3.9,
  emissive: 0.45,
  vignette: 0.02,
};

export const MOTION_BLUR = { samples: 12, shutter: 1.5 };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const orbit = (
  target: [number, number, number],
  dist: number,
  elevation: number,
  azimuth: number,
): [number, number, number] => [
  target[0] + dist * Math.cos(elevation) * Math.sin(azimuth),
  target[1] + dist * Math.sin(elevation),
  target[2] + dist * Math.cos(elevation) * Math.cos(azimuth),
];

export const cameraFor = (variant: VariantName) => (frame: number): CameraState => {
  if (variant === "v1") {
    // Reference framing: locked-off, steep top-down view with the grid
    // rotated ~45 degrees so the valley runs bottom-left -> top-right.
    const target: [number, number, number] = [-5, -2, -6];
    return {
      position: orbit(target, 43, 1.1, 2.88),
      target,
      roll: 2.24,
      fov: 40,
      shiftX: 0.18,
    };
  }
  // Version 2: low, oblique tracking shot travelling along the valley with a
  // slow orbit, revealing the depth of the terraced walls.
  const t = frame / DURATION_IN_FRAMES;
  const target: [number, number, number] = [lerp(-14, 12, t), -2.5, lerp(1.5, -0.5, t)];
  return {
    position: orbit(target, lerp(30, 25, t), lerp(0.5, 0.42, t), lerp(-1.05, -0.75, t)),
    target,
    roll: 0,
    fov: 34,
  };
};
