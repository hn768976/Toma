/**
 * Drives the default camera straight from Remotion's frame number.
 *
 * DETERMINISM: this never uses `useFrame(delta)`. The camera's position for
 * frame N is a pure function of N, so a render distributed across workers,
 * a re-render, or a scrub in the Studio all produce the identical picture.
 */

import { useLayoutEffect } from "react";
import { useThree } from "@react-three/fiber";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { getCameraState } from "./cameraPath";
import { CAMERA_FAR, CAMERA_FOV, CAMERA_NEAR } from "./scene";

export const CameraRig: React.FC = () => {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // A layout effect, so the camera is in place before @remotion/three advances
  // the renderer in its passive effect.
  useLayoutEffect(() => {
    const state = getCameraState(frame, durationInFrames);
    camera.position.copy(state.position);
    camera.up.set(0, 1, 0);
    camera.lookAt(state.target);
    if ("isPerspectiveCamera" in camera && camera.isPerspectiveCamera) {
      camera.fov = CAMERA_FOV;
      camera.near = CAMERA_NEAR;
      camera.far = CAMERA_FAR;
      camera.aspect = size.width / size.height;
    }
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }, [camera, frame, durationInFrames, size.width, size.height]);

  return null;
};
