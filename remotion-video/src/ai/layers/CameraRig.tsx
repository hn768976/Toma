// Drives the scene camera from Remotion's frame.
//
// The camera is animated here rather than via useFrame so its position is a
// pure function of the current frame - Remotion renders frames out of order and
// in parallel, and anything that integrates over time would drift between them.

import { useThree } from "@react-three/fiber";
import * as THREE from "three";

export type CameraRigProps = {
  position: [number, number, number];
  lookAt?: [number, number, number];
  fov?: number;
  /** Roll around the view axis, in radians. */
  roll?: number;
};

export const CameraRig: React.FC<CameraRigProps> = ({
  position,
  lookAt = [0, 0, 0],
  fov,
  roll = 0,
}) => {
  const { camera } = useThree();
  const perspective = camera as THREE.PerspectiveCamera;

  camera.position.set(position[0], position[1], position[2]);
  camera.lookAt(lookAt[0], lookAt[1], lookAt[2]);
  if (roll !== 0) {
    camera.rotateZ(roll);
  }
  if (fov !== undefined && perspective.fov !== fov) {
    perspective.fov = fov;
    perspective.updateProjectionMatrix();
  }
  return null;
};
