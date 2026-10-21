// ThreeCanvas wrapper: fixed camera, flat background colour, and the
// half-float + dither pipeline from pipeline.ts.
import { ThreeCanvas } from "@remotion/three";
import React, { useCallback } from "react";
import { useVideoConfig } from "remotion";
import * as THREE from "three";
import { installPipeline } from "./pipeline";

export type StageProps = {
  background: THREE.Color; // linear, already scaled with linearKey()
  fov: number;
  position: [number, number, number];
  target: [number, number, number];
  onSize?: (w: number, h: number) => void;
  children: React.ReactNode;
};

export const ThreeStage: React.FC<StageProps> = ({ background, fov, position, target, onSize, children }) => {
  const { width, height } = useVideoConfig();
  // Render at the output resolution: 4K at scale 1, 720p at --scale=1/3.
  const dpr = typeof window === "undefined" ? 1 : Math.min(1, window.devicePixelRatio || 1);
  const onCreated = useCallback(
    (state: { gl: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.Camera }) => {
      installPipeline(state.gl);
      state.scene.background = background;
      state.camera.lookAt(...target);
      const s = new THREE.Vector2();
      state.gl.getDrawingBufferSize(s);
      onSize?.(s.x, s.y);
    },
    [background, target, onSize],
  );
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={dpr}
      linear
      flat
      gl={{ antialias: false, preserveDrawingBuffer: true, alpha: false, powerPreference: "high-performance" }}
      camera={{ fov, position, near: 0.1, far: 200 }}
      onCreated={onCreated}
    >
      {children}
    </ThreeCanvas>
  );
};
