import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Assets, useAssets } from "./assets";
import { Post, PostParams } from "./post";

export type LookContext = {
  assets: Assets;
  width: number; // drawing-buffer pixels
  height: number;
  /** drawing-buffer height / 2160: multiply pixel sizes designed at 4K by this */
  pxScale: number;
  renderer: THREE.WebGLRenderer;
};

export interface Look {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Set every bit of on-screen state from `frame` alone. */
  update(frame: number): PostParams;
  /** Frame index used for grain (frame % loop for loops). */
  grainFrame(frame: number): number;
  dispose?(): void;
}

export type LookFactory = (ctx: LookContext) => Look;

const Driver: React.FC<{ factory: LookFactory; assets: Assets }> = ({ factory, assets }) => {
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const bundle = useMemo(() => {
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    const width = Math.round(size.x);
    const height = Math.round(size.y);
    const look = factory({ assets, width, height, pxScale: height / 2160, renderer: gl });
    const post = new Post(width, height);
    console.warn("drawing buffer", width, height, "dpr", window.devicePixelRatio, "css", gl.domElement.clientWidth);
    return { look, post };
  }, [gl, factory, assets]);
  useEffect(() => () => {
    bundle.look.dispose?.();
    bundle.post.dispose();
  }, [bundle]);
  useEffect(() => {
    invalidate();
  }, [frame, invalidate]);
  // Used only as the render hook (priority 1 = we own rendering).
  // Every value comes from the Remotion frame number, never from R3F's clock.
  useFrame(() => {
    const f = frameRef.current;
    const params = bundle.look.update(f);
    bundle.post.render(gl, bundle.look.scene, bundle.look.camera, params, bundle.look.grainFrame(f));
  }, 1);
  return null;
};

export const Stage: React.FC<{ factory: LookFactory }> = ({ factory }) => {
  const { width, height } = useVideoConfig();
  const assets = useAssets();
  // Render at the output resolution: with --scale the page DPR equals the scale.
  const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 1) : 1;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {assets ? (
        <ThreeCanvas
          width={width}
          height={height}
          dpr={dpr}
          frameloop="demand"
          linear
          flat
          gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
        >
          <Driver factory={factory} assets={assets} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};
