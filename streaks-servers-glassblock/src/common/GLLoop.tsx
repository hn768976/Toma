import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";

/**
 * An imperative three.js renderer for one look. `render` is a pure function of
 * `frame`: it sets every uniform/transform from the frame number and draws all
 * passes. Nothing is carried over from the previous frame.
 */
export interface LoopRenderer {
  render(gl: THREE.WebGLRenderer, frame: number, width: number, height: number): void;
  dispose(): void;
}

const tmpSize = new THREE.Vector2();

const Driver: React.FC<{ create: () => LoopRenderer }> = ({ create }) => {
  const frame = useCurrentFrame();
  // Written during render, read when ThreeCanvas calls advance() for this frame.
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const renderer = useMemo(create, [create]);
  useEffect(() => () => renderer.dispose(), [renderer]);
  const { gl } = useThree();
  useMemo(() => {
    gl.autoClear = false;
  }, [gl]);
  // Priority 1 = we own the draw. The R3F clock/delta argument is ignored:
  // every value comes from the Remotion frame number.
  useFrame(() => {
    gl.getDrawingBufferSize(tmpSize);
    renderer.render(gl, frameRef.current, tmpSize.x, tmpSize.y);
  }, 1);
  return null;
};

export const GLLoop: React.FC<{ create: () => LoopRenderer }> = ({ create }) => {
  const { width, height } = useVideoConfig();
  // Render the drawing buffer at the output resolution (respects --scale),
  // instead of R3F's default dpr clamp of [1, 2].
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
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
          depth: true,
          stencil: false,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance",
        }}
      >
        <Driver create={create} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
