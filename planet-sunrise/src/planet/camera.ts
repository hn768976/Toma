import { Easing, interpolate } from "remotion";

export type CameraState = {
  zoom: number;
  roll: number; // radians
  pan: readonly [number, number]; // ref-space units
};

export type CameraMode = "static" | "dolly-roll";

const SUN: readonly [number, number] = [384, 108];
const CENTER: readonly [number, number] = [384, 216];

/** Camera for a given frame. */
export const cameraAt = (
  mode: CameraMode,
  frame: number,
  durationInFrames: number,
): CameraState => {
  if (mode === "static") {
    return { zoom: 1, roll: 0, pan: [0, 0] };
  }
  // Version 2: a slow cinematic push-in towards the sunrise with a
  // gentle Dutch-roll drift and a rise over the horizon.
  const t = interpolate(frame, [0, durationInFrames - 1], [0, 1], {
    easing: Easing.inOut(Easing.sin),
  });
  return {
    zoom: interpolate(t, [0, 1], [0.92, 1.28]),
    roll: interpolate(t, [0, 1], [-0.09, 0.05]),
    pan: [interpolate(t, [0, 1], [-46, 8]), interpolate(t, [0, 1], [34, -22])],
  };
};

/** Inverse of the shader's toWorld() for parallax k = 1 -> sun on screen. */
export const sunScreen = (cam: CameraState): [number, number] => {
  const wx = SUN[0] - cam.pan[0] - CENTER[0];
  const wy = SUN[1] - cam.pan[1] - CENTER[1];
  const dx = wx * cam.zoom;
  const dy = wy * cam.zoom;
  const c = Math.cos(-cam.roll);
  const s = Math.sin(-cam.roll);
  return [CENTER[0] + c * dx - s * dy, CENTER[1] + s * dx + c * dy];
};
