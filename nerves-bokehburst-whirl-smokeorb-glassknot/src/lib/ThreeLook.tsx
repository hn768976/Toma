import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { getRenderScale } from "./useRenderScale";

/**
 * A look built imperatively with three.js. `render(gl, frame)` must draw the
 * frame purely from `frame` (no clocks, no state carried between frames).
 */
export type ThreeLookImpl = {
  render: (gl: THREE.WebGLRenderer, frame: number) => void;
  dispose: () => void;
};

export type ThreeLookFactory = (gl: THREE.WebGLRenderer, pxW: number, pxH: number) => ThreeLookImpl;

const Runner: React.FC<{ create: ThreeLookFactory }> = ({ create }) => {
  const frame = useCurrentFrame();
  const gl = useThree((s) => s.gl);
  const frameRef = useRef(frame);
  frameRef.current = frame;

  const impl = useMemo(() => {
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    return create(gl, size.x, size.y);
  }, [gl, create]);

  useLayoutEffect(() => () => impl.dispose(), [impl]);

  // Priority 1 makes this the only render call when @remotion/three advances
  // the canvas once per Remotion frame. It ignores R3F's clock entirely and
  // draws from the current Remotion frame only.
  useFrame(() => {
    impl.render(gl, frameRef.current);
  }, 1);
  return null;
};

export const ThreeLook: React.FC<{ create: ThreeLookFactory; background?: string }> = ({
  create,
  background = "#000",
}) => {
  const { width, height } = useVideoConfig();
  const dpr = useMemo(() => getRenderScale(), []);
  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={dpr}
        flat
        linear
        gl={{
          antialias: false,
          alpha: false,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance",
          stencil: false,
        }}
      >
        <Runner create={create} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
