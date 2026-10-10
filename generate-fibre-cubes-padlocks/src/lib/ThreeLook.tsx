import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import React, { useEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";

export type LookInstance = {
  render: (frame: number) => void;
  dispose: () => void;
};

// w/h are the real drawing-buffer size (composition size x render scale).
export type LookFactory = (gl: THREE.WebGLRenderer, w: number, h: number) => LookInstance;

const Driver: React.FC<{ factory: LookFactory; frame: number; w: number; h: number }> = ({
  factory,
  frame,
  w,
  h,
}) => {
  const gl = useThree((s) => s.gl);
  const look = useMemo(() => factory(gl, w, h), [factory, gl, w, h]);
  useEffect(() => () => look.dispose(), [look]);

  // The only value read here is the Remotion frame (kept in a ref so the
  // callback below always sees the current one). R3F's clock/delta are never
  // used: useFrame with priority 1 is just the hook that replaces R3F's
  // default render call with our post-processed render of `frame`.
  const frameRef = useRef(frame);
  frameRef.current = frame;
  useFrame(() => {
    look.render(frameRef.current);
  }, 1);
  return null;
};

export const ThreeLook: React.FC<{ factory: LookFactory }> = ({ factory }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  // Remotion's --scale sets devicePixelRatio; render at the real output size.
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const w = Math.round(width * dpr);
  const h = Math.round(height * dpr);
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={dpr}
        linear
        flat
        gl={{
          antialias: false,
          alpha: false,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance",
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.NoToneMapping;
          gl.outputColorSpace = THREE.LinearSRGBColorSpace;
          gl.autoClear = false;
        }}
      >
        <Driver factory={factory} frame={frame} w={w} h={h} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
