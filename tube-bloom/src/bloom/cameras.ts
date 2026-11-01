import type { CameraPose } from "./scene";
import type { BloomState } from "./timeline";

export type CameraMode = "topDown" | "lowOrbit";

// Version 1: the reference's locked-off, top-down view of the flower field
// (the image changes because the flowers bloom, not because the camera moves).
// A barely perceptible drift keeps it from feeling static.
const topDown = (frame: number, s: BloomState): CameraPose => {
  const camZ = 3.54;
  const t = frame / 270;
  const dx = 0.03 * Math.sin(t * Math.PI * 2);
  return {
    position: [dx, 0, camZ],
    target: [dx, 0, 0],
    up: [0, 1, 0],
    fov: 32,
    focus: camZ - (0.34 - 0.24 * s.bloom),
    aperture: 14,
    edgeBlur: 1.0,
  };
};

// Version 2: a low, oblique camera that orbits the gap between the two
// central flowers and slowly pushes in, revealing the woven 3D depth that the
// top-down view flattens out. Shallow depth of field gives a macro feel.
// periodic (frame 270 == frame 0) so the alternative also loops seamlessly:
// sweeps around, dips low and pushes in mid-clip, then rises and pulls back
const TAU = Math.PI * 2;
const az = (f: number) => -1.65 + 0.55 * Math.sin((f / 270) * TAU);
const el = (f: number) => 0.76 + 0.15 * Math.cos((f / 270) * TAU);
const dist = (f: number) => 3.72 + 0.62 * Math.cos((f / 270) * TAU);

const lowOrbit = (frame: number, s: BloomState): CameraPose => {
  const a = az(frame);
  const e = el(frame);
  const d = dist(frame);
  const tz = 0.05 + 0.15 * (1 - s.bloom);
  return {
    position: [d * Math.cos(e) * Math.cos(a), d * Math.cos(e) * Math.sin(a), tz + d * Math.sin(e)],
    target: [0, 0, tz],
    up: [0, 0, 1],
    fov: 36,
    focus: d,
    aperture: 10,
    edgeBlur: 0.25,
  };
};

export const poseAt = (mode: CameraMode, frame: number, s: BloomState): CameraPose =>
  mode === "topDown" ? topDown(frame, s) : lowOrbit(frame, s);
