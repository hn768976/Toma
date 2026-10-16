import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFontsReady } from "../fonts";
import { getRenderScale } from "../scale";

/** Called once per Remotion frame, with the frame number only. */
export type ThreeRender = (gl: THREE.WebGLRenderer, frame: number, size: { w: number; h: number }) => void;

// Takes over R3F's render (priority 1). This is only the render hook that
// <ThreeCanvas> drives once per Remotion frame; R3F's clock is never read.
// Everything drawn comes from `frame`, which is the Remotion frame.
const Renderer: React.FC<{ frame: number; render: ThreeRender }> = ({ frame, render }) => {
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const renderRef = useRef(render);
  renderRef.current = render;
  const { gl, size } = useThree();
  useFrame(() => {
    const pr = gl.getPixelRatio();
    renderRef.current(gl, frameRef.current, { w: Math.round(size.width * pr), h: Math.round(size.height * pr) });
  }, 1);
  useEffect(() => {
    gl.autoClear = false;
  }, [gl]);
  return null;
};

export const ThreeLook: React.FC<{ render: ThreeRender }> = ({ render }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const fontsReady = useFontsReady();
  const dpr = useMemo(getRenderScale, []);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {fontsReady ? (
        <ThreeCanvas
          width={width}
          height={height}
          dpr={dpr}
          linear
          flat
          gl={{ antialias: false, preserveDrawingBuffer: true, alpha: false, powerPreference: "high-performance" }}
          style={{ position: "absolute", left: 0, top: 0 }}
        >
          <Renderer frame={frame} render={render} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};
