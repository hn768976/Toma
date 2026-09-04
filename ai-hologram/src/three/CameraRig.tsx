import { useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Camera state is a pure function of the frame — no useFrame clock, no delta
 * accumulation. Remotion renders frames out of order across threads, so any
 * integrated state would drift between them.
 */
export const CAMERA = {
  fov: 33,
  /** Fixed elevation above the plane. The camera never crosses it, never looks up. */
  elevationDeg: 30,
  /** A barely perceptible dolly in over the run. */
  radiusStart: 22.6,
  radiusEnd: 20.9,
  /** Total arc across the 20 seconds. */
  arcDeg: 31,
  startAzimuthDeg: -14,
  targetYStart: 1.35,
  targetYEnd: 1.8,
  /** Frames over which the constant orbit speed ramps up from rest. */
  easeFrames: 55,
};

/**
 * Orbit progress: speed ramps linearly from 0 to 1 over `easeFrames`, then
 * holds constant. Integrating that ramp gives a gentle ease at the very start
 * and dead-constant speed thereafter — no easing anywhere else.
 */
export const cameraProgress = (frame: number, duration: number) => {
  const ramp = CAMERA.easeFrames;
  const s = (f: number) => (f <= ramp ? (f * f) / (2 * ramp) : f - ramp / 2);
  return s(frame) / s(duration - 1);
};

export const cameraAzimuth = (frame: number, duration: number) => {
  const p = cameraProgress(frame, duration);
  return ((CAMERA.startAzimuthDeg + p * CAMERA.arcDeg) * Math.PI) / 180;
};

const target = new THREE.Vector3();

export const CameraRig: React.FC<{ frame: number; duration: number; fps: number }> = ({
  frame,
  duration,
  fps,
}) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const p = cameraProgress(frame, duration);
  const azimuth = cameraAzimuth(frame, duration);
  const elevation = (CAMERA.elevationDeg * Math.PI) / 180;
  const radius = CAMERA.radiusStart + (CAMERA.radiusEnd - CAMERA.radiusStart) * p;

  // A slight vertical drift on top of the arc, small enough to read as float
  // rather than as a move of its own.
  const drift = Math.sin((frame / fps / 13) * Math.PI * 2) * 0.22;
  const y = Math.sin(elevation) * radius + drift;
  const horiz = Math.cos(elevation) * radius;

  camera.fov = CAMERA.fov;
  camera.near = 0.1;
  camera.far = 400;
  camera.position.set(Math.sin(azimuth) * horiz, y, Math.cos(azimuth) * horiz);
  target.set(0, CAMERA.targetYStart + (CAMERA.targetYEnd - CAMERA.targetYStart) * p, 0);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();

  return null;
};
