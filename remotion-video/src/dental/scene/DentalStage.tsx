// Shared stage for all nine versions: backdrop, canvas, renderer setup,
// camera rig, optional depth of field, and the grade on top.

import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { NoToneMapping, PerspectiveCamera, Vector3 } from "three";
import { Backdrop } from "../materials/palette";
import { SceneBackdrop } from "./SceneBackdrop";
import { DepthOfField, DepthOfFieldProps } from "./DepthOfField";

export type CameraState = {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  /** Roll around the view axis, in degrees. */
  roll?: number;
};

const CameraRig: React.FC<{ camera: CameraState }> = ({ camera }) => {
  const cam = useThree((s) => s.camera) as PerspectiveCamera;
  const target = useMemo(() => new Vector3(), []);

  cam.position.set(...camera.position);
  target.set(...camera.target);
  cam.up.set(0, 1, 0);
  cam.lookAt(target);
  if (camera.roll) {
    cam.rotateZ((camera.roll * Math.PI) / 180);
  }
  cam.fov = camera.fov;
  cam.near = 0.02;
  cam.far = 30;
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  return null;
};

export type DentalStageProps = {
  width: number;
  height: number;
  backdrop: Backdrop;
  camera: CameraState;
  children: React.ReactNode;
  /** Supersampling factor for the WebGL buffer. 2 = 4x SSAA. */
  dpr?: number;
  /** Strength of the corner falloff, 0..1. */
  vignette?: number;
  /** Brightness of the light pool on the backdrop. */
  keyGlow?: number;
  /** Omit to render everything sharp. */
  dof?: DepthOfFieldProps;
  /** Overall grade applied to the finished frame. */
  grade?: { contrast: number; saturation: number; brightness: number };
};

export const DentalStage: React.FC<DentalStageProps> = ({
  width,
  height,
  backdrop,
  camera,
  children,
  dpr = 1.5,
  vignette = 0.35,
  keyGlow = 0.3,
  dof,
  grade,
}) => {
  const filter = grade
    ? `contrast(${grade.contrast}) saturate(${grade.saturation}) brightness(${grade.brightness})`
    : undefined;

  // Focus follows the look-at point unless a shot overrides it.
  const focusDistance = Math.hypot(
    camera.position[0] - camera.target[0],
    camera.position[1] - camera.target[1],
    camera.position[2] - camera.target[2],
  );

  return (
    <AbsoluteFill style={{ backgroundColor: backdrop.bottom, filter }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={dpr}
        // Opaque: the depth-of-field pass blurs the framebuffer, and an
        // alpha channel there would bleed the clear colour into every edge.
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          // Clinical medical renders are not filmic: a straight linear
          // response keeps enamel reading as bright white, and the few
          // highlights that clip are meant to.
          gl.toneMapping = NoToneMapping;
        }}
        style={{ position: "absolute", inset: 0 }}
      >
        <CameraRig camera={camera} />
        <SceneBackdrop backdrop={backdrop} glow={keyGlow} />
        {children}
        {dof ? <DepthOfField {...dof} autoFocus={focusDistance} /> : null}
      </ThreeCanvas>

      {vignette > 0 ? (
        <AbsoluteFill
          style={{
            background: `radial-gradient(72% 72% at 50% 48%, rgba(0,0,0,0) 52%, rgba(10,22,34,${vignette}) 100%)`,
            pointerEvents: "none",
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
