import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useCurrentFrame, useVideoConfig } from "remotion";

export interface FramePipeline {
  render: (frame: number) => void;
}

export type PipelineFactory = (
  renderer: THREE.WebGLRenderer,
  bufferWidth: number,
  bufferHeight: number,
) => FramePipeline;

// Bridges @remotion/three to a hand-written render pipeline. R3F's useFrame is used
// only as the "draw now" callback (priority 1 = we own the render); its clock and
// delta are never read. The picture is a pure function of useCurrentFrame().
const Driver: React.FC<{ factory: PipelineFactory }> = ({ factory }) => {
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const gl = useThree((s) => s.gl);
  const pipeline = useMemo(() => {
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    return factory(gl, size.x, size.y);
  }, [gl, factory]);
  useFrame(() => {
    pipeline.render(frameRef.current);
  }, 1);
  return null;
};

export const ThreeStage: React.FC<{ factory: PipelineFactory }> = ({ factory }) => {
  const { width, height } = useVideoConfig();
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio;
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={dpr}
      flat
      linear
      gl={{
        antialias: false,
        preserveDrawingBuffer: true,
        alpha: false,
        powerPreference: "high-performance",
      }}
      style={{ position: "absolute", inset: 0 }}
    >
      <Driver factory={factory} />
    </ThreeCanvas>
  );
};
