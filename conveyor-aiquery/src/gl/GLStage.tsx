import React, { useMemo, useRef } from "react";
import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import { useCurrentFrame, useRemotionEnvironment, useVideoConfig } from "remotion";
import * as THREE from "three";

// A Stage owns its whole render: scene passes and post. It is created once
// per browser tab and renders a frame purely from the frame number.
export interface Stage {
  render(gl: THREE.WebGLRenderer, frame: number): void;
}
export type StageFactory = (gl: THREE.WebGLRenderer, width: number, height: number) => Stage;

const Runner: React.FC<{ factory: StageFactory; frameRef: React.MutableRefObject<number> }> = ({ factory, frameRef }) => {
  const gl = useThree((s) => s.gl);
  const size = useMemo(() => gl.getDrawingBufferSize(new THREE.Vector2()), [gl]);
  const stage = useMemo(() => factory(gl, size.x, size.y), [factory, gl, size]);
  // Priority 1 takes over rendering from R3F. The frame number comes from
  // Remotion (via frameRef), never from R3F's clock.
  useFrame(() => {
    stage.render(gl, frameRef.current);
  }, 1);
  return null;
};

export const GLStage: React.FC<{ factory: StageFactory }> = ({ factory }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { isRendering } = useRemotionEnvironment();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  // Rendering: honour Remotion's --scale (devicePixelRatio). Studio: cap the
  // buffer at 1080p so the preview stays interactive.
  const dpr = typeof window === "undefined" ? 1 : isRendering ? window.devicePixelRatio : Math.min(window.devicePixelRatio, 1920 / width);
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={dpr}
      gl={{ antialias: false, preserveDrawingBuffer: true, alpha: false, powerPreference: "high-performance" }}
      flat
      linear
    >
      <Runner factory={factory} frameRef={frameRef} />
    </ThreeCanvas>
  );
};
