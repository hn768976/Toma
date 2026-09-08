/**
 * True isometric camera.
 *
 * An orthographic camera looking down the (1, 1, 1) diagonal — 45 degrees of
 * azimuth, 35.264 degrees of elevation. Nothing converges, which is the
 * entire aesthetic, and it also buys a much cheaper render: no depth of
 * field pass and far simpler lighting than a perspective setup.
 *
 * The frustum is derived from useVideoConfig(), so the framing is identical
 * at 1080p and 4K. camera.manual keeps react-three-fiber from recomputing it
 * from the pixel size.
 */

import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { smoothstep } from "./anim";
import {
  CAMERA_DIRECTION,
  CAMERA_DISTANCE,
  PAN_AXIS,
  VIEW_HEIGHT,
  VIEW_TARGET,
} from "./constants";

/**
 * Total lateral drift across the whole clip, in world units. The camera is
 * orthographic, so this is a translation of the view, not a dolly. Kept
 * under 3% of the frame width.
 */
const DRIFT = 0.44;

export const CameraRig: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const camera = useThree((state) => state.camera);

  const axes = useMemo(
    () => ({
      view: new THREE.Vector3(...CAMERA_DIRECTION).normalize(),
      pan: new THREE.Vector3(...PAN_AXIS).normalize(),
      target: new THREE.Vector3(...VIEW_TARGET),
    }),
    [],
  );

  useLayoutEffect(() => {
    // `manual` tells react-three-fiber to leave the frustum alone; it is a
    // runtime flag that is missing from the three.js typings.
    const ortho = camera as THREE.OrthographicCamera & { manual: boolean };
    if (!ortho.isOrthographicCamera) return;

    const aspect = width / height;
    const halfHeight = VIEW_HEIGHT / 2;
    const halfWidth = halfHeight * aspect;

    ortho.manual = true;
    ortho.zoom = 1;
    ortho.left = -halfWidth;
    ortho.right = halfWidth;
    ortho.top = halfHeight;
    ortho.bottom = -halfHeight;
    ortho.near = -120;
    ortho.far = 400;

    // Near-constant drift with softened ends.
    const t = durationInFrames > 1 ? frame / (durationInFrames - 1) : 0;
    const eased = 0.65 * t + 0.35 * smoothstep(0, 1, t);
    const offset = (eased - 0.5) * DRIFT;

    const target = axes.target.clone().addScaledVector(axes.pan, offset);
    ortho.position
      .copy(target)
      .addScaledVector(axes.view, CAMERA_DISTANCE);
    ortho.up.set(0, 1, 0);
    ortho.lookAt(target);
    ortho.updateProjectionMatrix();
    ortho.updateMatrixWorld();
  });

  return null;
};
