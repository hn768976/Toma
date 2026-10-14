// ThreeCanvas wrapper. All rendering goes through the deterministic
// PostPipeline; the useFrame callback below only *draws* (priority 1 takes
// over R3F's render) - it never reads a clock. Scene values are applied in
// layout effects from useCurrentFrame() before Remotion calls advance().
import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import React, { useMemo } from "react";
import { useRemotionEnvironment, useVideoConfig } from "remotion";
import * as THREE from "three";
import { PostParams, PostPipeline } from "../post/pipeline";

export type RenderRefs = {
  camera: THREE.PerspectiveCamera;
  hudScene: THREE.Scene | null;
  params: PostParams;
};

const Renderer: React.FC<{ refs: RenderRefs }> = ({ refs }) => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const pipeline = useMemo(() => new PostPipeline(4), []);
  useFrame(() => {
    pipeline.render(gl, scene, refs.hudScene, refs.camera, refs.params);
  }, 1);
  return null;
};

export const Stage: React.FC<{
  refs: RenderRefs;
  children: React.ReactNode;
}> = ({ refs, children }) => {
  const { width, height } = useVideoConfig();
  const { isRendering } = useRemotionEnvironment();
  // When rendering, Remotion sets devicePixelRatio = --scale, so a 3840x2160
  // composition rendered with --scale=0.3333 draws 1280x720 pixels.
  // In the Studio preview render at a reduced resolution to stay interactive.
  const dpr = isRendering ? window.devicePixelRatio : 0.4;
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={dpr}
      flat
      gl={{
        antialias: false,
        alpha: false,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      }}
      style={{ backgroundColor: "#000" }}
    >
      {children}
      <Renderer refs={refs} />
    </ThreeCanvas>
  );
};
