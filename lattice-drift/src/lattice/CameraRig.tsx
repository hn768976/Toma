import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect } from "react";
import * as THREE from "three";

export type CameraPose = {
  position: THREE.Vector3;
  target: THREE.Vector3;
  // Orthographic: pixels per world unit. Perspective: vertical FOV (deg).
  zoom?: number;
  fov?: number;
};

// Applies a pose computed from the current frame to R3F's default camera.
export const CameraRig: React.FC<{ pose: CameraPose }> = ({ pose }) => {
  const camera = useThree((s) => s.camera);
  useLayoutEffect(() => {
    camera.position.copy(pose.position);
    camera.up.set(0, 1, 0);
    camera.lookAt(pose.target);
    if (camera instanceof THREE.OrthographicCamera && pose.zoom) {
      camera.zoom = pose.zoom;
      camera.near = 0.1;
      camera.far = 400;
    }
    if (camera instanceof THREE.PerspectiveCamera && pose.fov) {
      camera.fov = pose.fov;
      camera.near = 0.5;
      camera.far = 300;
    }
    camera.updateProjectionMatrix();
  }, [camera, pose]);
  return null;
};
