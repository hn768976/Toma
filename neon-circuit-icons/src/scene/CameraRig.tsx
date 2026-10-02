import { useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import { PerspectiveCamera } from 'three';
import { CAMERA_FOV, TARGET, cameraAt } from './camera';

export const CameraRig = ({ t }: { t: number }) => {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  // Set synchronously during render so it is in place before R3F advances.
  cameraAt(t, camera.position);
  camera.lookAt(TARGET);
  camera.updateMatrixWorld();
  useLayoutEffect(() => {
    camera.fov = CAMERA_FOV;
    camera.near = 0.1;
    camera.far = 80;
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
};
