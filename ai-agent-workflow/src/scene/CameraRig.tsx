import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect } from "react";
import { interpolate, useCurrentFrame } from "remotion";
import type { PerspectiveCamera } from "three";
import { DURATION } from "../layout";

export type CameraMode = "reference";

type Pose = {
  u: number; // look-at target on the floor
  v: number;
  dist: number;
  azimuth: number; // degrees; heading of the view direction in world XY
  elevation: number; // degrees above the floor
  fov: number;
};

// Slow, steady truck to the right along the data flow with a gentle push-in,
// matching the reference's drift.
const poseAt = (frame: number): Pose => {
  const t = frame / (DURATION - 1);
  const ease = (x: number) => x * 0.82 + 0.18 * (1 - Math.cos(x * Math.PI)) / 2;
  const k = ease(t);
  return {
    u: interpolate(k, [0, 1], [1.9, 8.4]),
    v: interpolate(k, [0, 1], [1.3, 0.2]),
    dist: interpolate(k, [0, 1], [30, 29]),
    azimuth: 62,
    elevation: interpolate(k, [0, 1], [40, 38]),
    fov: 32,
  };
};

export const CameraRig: React.FC = () => {
  const frame = useCurrentFrame();
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  useLayoutEffect(() => {
    const p = poseAt(frame);
    const az = (p.azimuth * Math.PI) / 180;
    const el = (p.elevation * Math.PI) / 180;
    const tx = p.u;
    const ty = -p.v;
    const hx = Math.cos(az);
    const hy = Math.sin(az);
    camera.up.set(0, 0, 1);
    camera.position.set(
      tx - hx * Math.cos(el) * p.dist,
      ty - hy * Math.cos(el) * p.dist,
      Math.sin(el) * p.dist,
    );
    camera.fov = p.fov;
    camera.near = 0.5;
    camera.far = 400;
    camera.lookAt(tx, ty, 0);
    camera.updateProjectionMatrix();
  }, [frame, camera]);
  return null;
};
