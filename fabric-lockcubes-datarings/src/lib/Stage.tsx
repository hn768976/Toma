import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import React, { useEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";

/**
 * A look owns its own scene, camera and post pipeline and renders a frame
 * as a pure function of the frame number it is given.
 */
export interface Look {
  render(gl: THREE.WebGLRenderer, frame: number, width: number, height: number): void;
  dispose(): void;
}

const size = new THREE.Vector2();

const Driver: React.FC<{ create: (gl: THREE.WebGLRenderer) => Look }> = ({ create }) => {
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const gl = useThree((s) => s.gl);
  const look = useMemo(() => create(gl), [create, gl]);
  useEffect(() => () => look.dispose(), [look]);
  // useFrame is used ONLY as the hook that takes over rendering (priority 1
  // stops R3F's own render). Its clock/delta are never read: the frame
  // number from useCurrentFrame() is the single input.
  useFrame(() => {
    gl.getDrawingBufferSize(size);
    look.render(gl, frameRef.current, size.x, size.y);
  }, 1);
  return null;
};

export const Stage: React.FC<{ create: (gl: THREE.WebGLRenderer) => Look; background: string }> = ({
  create,
  background,
}) => {
  const { width, height } = useVideoConfig();
  // Render at the device scale Remotion gives us (--scale), unclamped:
  // 3840x2160 * 1/3 -> a real 1280x720 drawing buffer.
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio;
  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={[dpr, dpr]}
        linear
        flat
        gl={{
          antialias: false,
          alpha: false,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance",
          stencil: false,
          depth: true,
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.NoToneMapping;
          gl.outputColorSpace = THREE.LinearSRGBColorSpace;
          gl.autoClear = false;
        }}
      >
        <Driver create={create} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
