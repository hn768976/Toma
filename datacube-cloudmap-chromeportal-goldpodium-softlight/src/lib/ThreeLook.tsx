import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Vector2, WebGLRenderer } from "three";

/**
 * A look is an imperative three.js scene whose every visible value is a pure
 * function of the frame number passed to render(). It owns its scene, camera
 * and post pipeline; it is built once and never carries state between frames.
 */
export interface Look {
  render(renderer: WebGLRenderer, frame: number, width: number, height: number): void;
  dispose(): void;
}

const size = new Vector2();

const Runner: React.FC<{ create: (gl: WebGLRenderer) => Look }> = ({ create }) => {
  const gl = useThree((s) => s.gl);
  const frame = useCurrentFrame();
  // Written during render, read by the render callback that <ThreeCanvas>
  // triggers via advance() after commit. Only the Remotion frame drives it.
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const look = useMemo(() => create(gl), [gl, create]);
  useEffect(() => () => look.dispose(), [look]);
  // Priority 1 → we own rendering. The R3F clock/delta arguments are ignored.
  useFrame(() => {
    gl.getDrawingBufferSize(size);
    look.render(gl, frameRef.current, size.x, size.y);
  }, 1);
  return null;
};

export const ThreeLook: React.FC<{ create: (gl: WebGLRenderer) => Look }> = ({ create }) => {
  const { width, height } = useVideoConfig();
  // Remotion's --scale sets devicePixelRatio; render at exactly that size.
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio;
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={dpr}
        flat
        linear
        gl={{
          antialias: false,
          alpha: false,
          depth: true,
          stencil: false,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance",
        }}
      >
        <Runner create={create} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
