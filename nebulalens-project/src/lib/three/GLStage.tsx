import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useEffect, useMemo, useRef } from "react";
import { useCurrentFrame } from "remotion";
import * as THREE from "three";
import { loopFrame } from "../constants";
import { useOutputPixels } from "../output";

export type GLProgram = {
  /** Draw loop frame `f` (0..599) to the canvas. Must depend on `f` only. */
  render: (f: number) => void;
  dispose: () => void;
};
export type GLFactory = (gl: THREE.WebGLRenderer, pw: number, ph: number) => GLProgram;

const Driver: React.FC<{ factory: GLFactory; pw: number; ph: number }> = ({ factory, pw, ph }) => {
  const frame = useCurrentFrame();
  // Written during render, read by the render callback below. The callback
  // never touches R3F's clock: the picture is a function of the frame only.
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const program = useMemo(() => factory(gl, pw, ph), [factory, gl, pw, ph]);
  useEffect(() => () => program.dispose(), [program]);
  useEffect(() => invalidate(), [frame, invalidate]);

  // Priority 1 = we own rendering; R3F's default scene render is skipped.
  useFrame(() => {
    const canvas = gl.domElement;
    if (canvas.width !== pw || canvas.height !== ph) {
      gl.setPixelRatio(1);
      gl.setSize(pw, ph, false);
    }
    program.render(loopFrame(frameRef.current));
  }, 1);
  return null;
};

export const GLStage: React.FC<{ factory: GLFactory }> = ({ factory }) => {
  const { pw, ph, width, height } = useOutputPixels();
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={1}
      flat
      linear
      frameloop="demand"
      gl={{
        antialias: false,
        alpha: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      }}
      style={{ position: "absolute", left: 0, top: 0, width, height }}
    >
      <Driver factory={factory} pw={pw} ph={ph} />
    </ThreeCanvas>
  );
};
