import React, { useLayoutEffect } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { z } from "zod";
import {
  BACKGROUND_BOTTOM,
  BACKGROUND_TOP,
  CAMERA_FAR,
  CAMERA_FOV_DEG,
  CAMERA_HEIGHT,
  CAMERA_NEAR,
  CAMERA_PITCH_DEG,
  VIGNETTE,
  YAW_DRIFT_DEG,
} from "./constants";
import { GridLines } from "./GridLines";
import { Starfield } from "./Starfield";
import { VARIANTS } from "./variants";

export const gridPlaneSchema = z.object({
  variant: z.enum(["blue", "synthwave"]),
});

export type GridPlaneProps = z.infer<typeof gridPlaneSchema>;

export const gridPlaneDefaults: GridPlaneProps = { variant: "blue" };

// r3f points a freshly configured camera at the origin unless the camera
// options carry a rotation. From (0, CAMERA_HEIGHT, 0) that lookAt is
// straight down, parallel to the up vector, and the resulting view matrix
// is degenerate -- the scene renders as nothing at all. Handing it a
// rotation up front skips that path; CameraRig then owns the camera.
const CAMERA_PROPS = {
  fov: CAMERA_FOV_DEG,
  near: CAMERA_NEAR,
  far: CAMERA_FAR,
  position: [0, CAMERA_HEIGHT, 0] as [number, number, number],
  rotation: [
    THREE.MathUtils.degToRad(-CAMERA_PITCH_DEG),
    0,
    0,
  ] as [number, number, number],
};

// The camera is otherwise locked -- no dolly, no roll. All the travel
// comes from the grid sliding underneath it. The yaw is a single sine
// cycle over the loop, so it closes seamlessly.
const CameraRig: React.FC<{ loopProgress: number }> = ({ loopProgress }) => {
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;
  const size = useThree((state) => state.size);
  const yaw = YAW_DRIFT_DEG * Math.sin(Math.PI * 2 * loopProgress);

  useLayoutEffect(() => {
    camera.position.set(0, CAMERA_HEIGHT, 0);
    camera.rotation.order = "YXZ";
    camera.rotation.set(
      THREE.MathUtils.degToRad(-CAMERA_PITCH_DEG),
      THREE.MathUtils.degToRad(yaw),
      0,
    );
    camera.fov = CAMERA_FOV_DEG;
    camera.near = CAMERA_NEAR;
    camera.far = CAMERA_FAR;
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }, [camera, size.width, size.height, yaw]);

  return null;
};

export const GridPlane: React.FC<GridPlaneProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const palette = VARIANTS[variant];

  // Everything periodic is driven off this. useCurrentFrame() only --
  // no useFrame clock, no delta accumulation, because Remotion renders
  // frames out of order across threads.
  const loopProgress = frame / durationInFrames;

  // Anything denominated in pixels is authored at 4K and scaled from the
  // real output height, so the 1080p preview is the same image.
  const pixelScale = height / 2160;

  return (
    <AbsoluteFill style={{ backgroundColor: BACKGROUND_BOTTOM }}>
      <AbsoluteFill
        style={{
          background: `linear-gradient(to bottom, ${BACKGROUND_TOP} 0%, ${BACKGROUND_BOTTOM} 55%)`,
        }}
      />
      <Starfield frame={frame} pixelScale={pixelScale} />
      <ThreeCanvas
        width={width}
        height={height}
        gl={{ antialias: false, alpha: true, premultipliedAlpha: true }}
        camera={CAMERA_PROPS}
      >
        <CameraRig loopProgress={loopProgress} />
        <GridLines
          variant={palette}
          loopProgress={loopProgress}
          width={width}
          height={height}
          pixelScale={pixelScale}
        />
      </ThreeCanvas>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 78% 78% at 50% 48%, transparent 40%, ${VIGNETTE} 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};
