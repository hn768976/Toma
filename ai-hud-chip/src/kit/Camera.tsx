import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect } from "react";
import * as THREE from "three";

/** Sets the default camera from props (pure function of the frame upstream). */
export const CameraRig: React.FC<{ position: [number, number, number]; target: [number, number, number]; fov: number; roll?: number }> = ({ position, target, fov, roll = 0 }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useLayoutEffect(() => {
    camera.position.set(...position);
    camera.up.set(Math.sin(roll), Math.cos(roll), 0);
    camera.lookAt(...target);
    camera.fov = fov;
    camera.near = 0.1;
    camera.far = 200;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  });
  return null;
};
