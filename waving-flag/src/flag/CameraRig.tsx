import React from 'react';
import {useThree} from '@react-three/fiber';
import {PerspectiveCamera} from 'three';

/**
 * Explicit camera placement. Every value is derived from the frame dimensions
 * and passed in, so framing is resolution independent.
 */
export const CameraRig: React.FC<{
  readonly position: [number, number, number];
  readonly tilt: number;
  readonly fov: number;
}> = ({position, tilt, fov}) => {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);

  camera.position.set(...position);
  camera.rotation.set(tilt, 0, 0);
  camera.fov = fov;
  camera.near = 0.01;
  camera.far = 400;
  camera.aspect = size.width / size.height;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();

  return null;
};
