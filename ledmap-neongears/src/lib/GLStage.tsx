import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useCurrentFrame, useRemotionEnvironment, useVideoConfig } from "remotion";

export interface FrameRenderer {
  // Draw the complete image for `frame` into the canvas. Must be a pure function of frame.
  render(frame: number): void;
  dispose(): void;
}

type Factory = (gl: THREE.WebGLRenderer, width: number, height: number) => FrameRenderer;

const Driver: React.FC<{ factory: Factory; frameRef: React.RefObject<number> }> = ({
  factory,
  frameRef,
}) => {
  const gl = useThree((s) => s.gl);
  const renderer = useMemo(() => {
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    gl.autoClear = false;
    return factory(gl, size.x, size.y);
  }, [gl, factory]);
  useEffect(() => () => renderer.dispose(), [renderer]);
  // useFrame is used only as R3F's render hook (priority 1 replaces the default render).
  // Its clock and delta are never read: the image depends only on Remotion's frame.
  useFrame(() => {
    renderer.render(frameRef.current);
  }, 1);
  return null;
};

export const GLStage: React.FC<{ factory: Factory }> = ({ factory }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { isRendering } = useRemotionEnvironment();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  // When rendering, Remotion's --scale sets devicePixelRatio, so the drawing buffer is
  // exactly the output size (3840 x 2160 x scale). In the Studio, cap it to keep it responsive.
  const dpr = isRendering
    ? typeof window !== "undefined"
      ? window.devicePixelRatio
      : 1
    : 0.5;
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={dpr}
      gl={{
        antialias: false,
        alpha: false,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      }}
      flat
      linear
    >
      <Driver factory={factory} frameRef={frameRef} />
    </ThreeCanvas>
  );
};
