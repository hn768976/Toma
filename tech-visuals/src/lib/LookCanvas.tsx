import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";

/** A look is plain three.js: it draws a complete frame as a pure function of `frame`. */
export interface Look {
  render(gl: THREE.WebGLRenderer, frame: number): void;
  dispose(): void;
}

const Runner: React.FC<{ create: () => Look }> = ({ create }) => {
  const gl = useThree((s) => s.gl);
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const look = useMemo(() => create(), [create]);
  useEffect(() => () => look.dispose(), [look]);
  // Priority 1 → R3F skips its own scene render; we draw everything ourselves.
  // The R3F clock/delta are deliberately ignored: the only input is the Remotion frame.
  useFrame(() => {
    look.render(gl, frameRef.current);
  }, 1);
  return null;
};

export const LookCanvas: React.FC<{ create: () => Look }> = ({ create }) => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <ThreeCanvas
        width={width}
        height={height}
        linear
        flat
        // Remotion's --scale becomes devicePixelRatio; honour it exactly (R3F's default clamps to ≥1).
        dpr={typeof window === "undefined" ? 1 : window.devicePixelRatio}
        gl={{
          antialias: false,
          preserveDrawingBuffer: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.LinearSRGBColorSpace;
          gl.toneMapping = THREE.NoToneMapping;
          gl.autoClear = false;
        }}
      >
        <Runner create={create} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
