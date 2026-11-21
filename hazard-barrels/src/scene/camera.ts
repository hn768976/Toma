import { CAMERA, VIDEO } from "../config";
import type { CameraState } from "../three/Stage";

const rad = (d: number) => (d * Math.PI) / 180;

/** Camera for a frame: a constant-speed vertical crane. Pure function of the frame number. */
export const cameraAt = (frame: number): CameraState => {
  const t = frame / (VIDEO.durationInFrames - 1);
  const y = CAMERA.yStart + (CAMERA.yEnd - CAMERA.yStart) * t;
  const pitch = rad(CAMERA.pitchDeg);
  const yaw = rad(CAMERA.yawDeg);
  const dir: [number, number, number] = [
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch),
  ];
  return {
    position: [CAMERA.x, y, CAMERA.z],
    target: [CAMERA.x + dir[0], y + dir[1], CAMERA.z + dir[2]],
    rollDeg: CAMERA.rollDeg,
    fovDeg: CAMERA.fovDeg,
    focusDistance: CAMERA.focusDistance,
  };
};
