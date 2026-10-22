import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { use, useEffect, useMemo, useRef } from "react";
import { ColorManagement, type WebGLRenderer } from "three";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { loadBrainAssets, type BrainAssets } from "./assets";

// All looks render imperatively with three.js. React only hands over the
// frame number: `useCurrentFrame()` is written to a ref during render, and the
// R3F render callback (priority 1, so R3F does not draw its own scene) calls
// look.render(frame). Nothing reads clock time or deltas, and nothing
// accumulates between frames, so any frame renders identically in isolation.

ColorManagement.enabled = false;

export type LookContext = { gl: WebGLRenderer; assets: BrainAssets; width: number; height: number };
export type LookInstance = { render: (frame: number) => void; dispose: () => void };
export type LookFactory = (ctx: LookContext) => LookInstance;

const Driver: React.FC<{ look: LookFactory }> = ({ look }) => {
  const assets = use(loadBrainAssets());
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const gl = useThree((s) => s.gl);
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const inst = useMemo(() => look({ gl, assets, width, height }), [gl, assets, look, width, height]);
  useEffect(() => () => inst.dispose(), [inst]);
  useFrame(() => {
    try {
      inst.render(frameRef.current);
    } catch (e) {
      console.error("BrainStage render failed", e instanceof Error ? e.stack : e);
      throw e;
    }
  }, 1);
  return null;
};

export const BrainStage: React.FC<{ look: LookFactory }> = ({ look }) => {
  const { width, height } = useVideoConfig();
  // Remotion's --scale sets devicePixelRatio; the drawing buffer follows it
  // (1280x720 for the 3840x2160 compositions at --scale=1/3). Capped at 1.
  const dpr = useMemo(() => (typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 1)), []);
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={dpr}
      flat
      linear
      gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
    >
      <Driver look={look} />
    </ThreeCanvas>
  );
};
