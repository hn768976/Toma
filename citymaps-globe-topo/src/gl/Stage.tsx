// A full-frame WebGL2 stage on top of @remotion/three's <ThreeCanvas>.
//
// Remotion calls R3F's advance() once per frame while rendering; our priority-1
// useFrame callback takes over rendering and draws the frame purely from
// useCurrentFrame(). R3F's clock is never read.

import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useEffect, useMemo, useRef } from "react";
import { getRemotionEnvironment, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { loopFrame } from "../lib/loop";

THREE.ColorManagement.enabled = false;

export interface StageInstance {
  render: (renderer: THREE.WebGLRenderer, frame: number) => void;
  dispose: () => void;
}

export interface StageContext {
  renderer: THREE.WebGLRenderer;
  width: number; // drawing-buffer pixels
  height: number;
}

export type StageFactory = (ctx: StageContext) => StageInstance;

const Inner: React.FC<{ factory: StageFactory }> = ({ factory }) => {
  const gl = useThree((s) => s.gl);
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const inst = useMemo(() => {
    gl.outputColorSpace = THREE.LinearSRGBColorSpace;
    gl.toneMapping = THREE.NoToneMapping;
    gl.autoClear = false;
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    return factory({ renderer: gl, width: size.x, height: size.y });
  }, [gl, factory]);
  useEffect(() => () => inst.dispose(), [inst]);
  useFrame(() => {
    inst.render(gl, loopFrame(frameRef.current));
  }, 1);
  return null;
};

export const Stage: React.FC<{ factory: StageFactory; style?: React.CSSProperties }> = ({ factory, style }) => {
  const { width, height } = useVideoConfig();
  // Render the drawing buffer at the output resolution (scale = DPR while
  // rendering). In the Studio, cap it so previews stay interactive.
  const dpr = useMemo(() => {
    const d = typeof window === "undefined" ? 1 : window.devicePixelRatio;
    return getRemotionEnvironment().isRendering ? d : Math.min(d, 0.5);
  }, []);
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={dpr}
      linear
      flat
      style={{ position: "absolute", left: 0, top: 0, ...style }}
      gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
    >
      <Inner factory={factory} />
    </ThreeCanvas>
  );
};
