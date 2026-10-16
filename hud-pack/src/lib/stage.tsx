import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useLayoutEffect, useMemo } from "react";
import { useVideoConfig } from "remotion";
import * as THREE from "three";
import { PostSettings, PostStage } from "./post";

/**
 * ThreeCanvas at composition size, rendered at the page's devicePixelRatio
 * (Remotion's --scale), WebGL2, no tone mapping (done in the final pass).
 */
export const Stage: React.FC<{
  post: PostSettings;
  children: React.ReactNode;
}> = ({ post, children }) => {
  const { width, height } = useVideoConfig();
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={dpr}
      linear
      flat
      gl={{
        preserveDrawingBuffer: true,
        antialias: false,
        alpha: false,
        powerPreference: "high-performance",
      }}
      style={{ backgroundColor: "black" }}
    >
      {children}
      <PostStage {...post} />
    </ThreeCanvas>
  );
};

export type CamPose = {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  near?: number;
  far?: number;
  roll?: number;
};

/** A perspective camera made the default for the canvas, posed every frame from props. */
export const PosedCamera: React.FC<CamPose> = ({ position, target, fov, near = 0.1, far = 200, roll = 0 }) => {
  const set = useThree((s) => s.set);
  const size = useThree((s) => s.size);
  const cam = useMemo(() => {
    const c = new THREE.PerspectiveCamera(fov, 16 / 9, near, far);
    (c as unknown as { manual: boolean }).manual = true; // R3F must not resize it
    return c;
  }, []);
  useLayoutEffect(() => {
    set({ camera: cam });
  }, [cam, set]);
  useLayoutEffect(() => {
    cam.fov = fov;
    cam.near = near;
    cam.far = far;
    cam.aspect = size.width / size.height;
    cam.position.set(...position);
    cam.up.set(Math.sin(roll), Math.cos(roll), 0);
    cam.lookAt(...target);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
  });
  return null;
};
