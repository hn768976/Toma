import { ThreeCanvas } from "@remotion/three";
import { useThree, useFrame } from "@react-three/fiber";
import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useCurrentFrame, useRemotionEnvironment, useVideoConfig } from "remotion";

export type World = {
  /** Set all scene state from the frame number, then render. */
  render: (frame: number) => void;
  dispose: () => void;
};
export type WorldFactory = (gl: THREE.WebGLRenderer, w: number, h: number) => World;

/**
 * Render scale: in a render, Remotion's --scale becomes devicePixelRatio, so a
 * 3840x2160 composition rendered at --scale=0.333 draws a 1280x720 buffer.
 * In the Studio we cap it so previews stay responsive.
 */
export const useRenderDpr = () => {
  const { isRendering } = useRemotionEnvironment();
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  return isRendering ? dpr : Math.min(dpr, 0.5);
};

const Driver: React.FC<{ create: WorldFactory; w: number; h: number }> = ({ create, w, h }) => {
  const gl = useThree((s) => s.gl);
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const world = useMemo(() => {
    gl.outputColorSpace = THREE.LinearSRGBColorSpace;
    gl.toneMapping = THREE.NoToneMapping;
    return create(gl, w, h);
  }, [gl, create, w, h]);
  useEffect(() => () => world.dispose(), [world]);
  // priority 1 = we render ourselves; no clock is read, only the Remotion frame
  useFrame(() => world.render(frameRef.current), 1);
  return null;
};

export const ThreeLook: React.FC<{ create: WorldFactory }> = ({ create }) => {
  const { width, height } = useVideoConfig();
  const dpr = useRenderDpr();
  const w = Math.floor(width * dpr);
  const h = Math.floor(height * dpr);
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={dpr}
      gl={{ antialias: false, preserveDrawingBuffer: true, alpha: false, powerPreference: "high-performance" }}
      linear
      flat
    >
      <Driver create={create} w={w} h={h} />
    </ThreeCanvas>
  );
};
