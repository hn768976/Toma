import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  AbsoluteFill,
  getRemotionEnvironment,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/**
 * A renderer is created once per mounted canvas, then asked to draw a given
 * frame. It must draw that frame purely from the frame number it receives:
 * no clocks, no state carried from the previous draw.
 */
export interface FrameRenderer {
  render(gl: THREE.WebGLRenderer, frame: number, width: number, height: number): void;
  dispose(): void;
}

const Driver: React.FC<{ create: () => FrameRenderer }> = ({ create }) => {
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const rendererRef = useRef<FrameRenderer | null>(null);
  if (rendererRef.current === null) rendererRef.current = create();

  useEffect(() => {
    const r = rendererRef.current;
    return () => r?.dispose();
  }, []);

  // In the Studio the canvas only redraws on demand (frame change).
  useEffect(() => {
    invalidate();
  }, [frame, invalidate]);

  // Priority 1 takes over R3F's own scene render. This is only the hook that
  // @remotion/three's advance() calls; the clock/delta arguments are ignored and
  // the picture is a pure function of useCurrentFrame().
  useFrame(() => {
    const size = new THREE.Vector2();
    gl.getDrawingBufferSize(size);
    rendererRef.current!.render(gl, frameRef.current, size.x, size.y);
  }, 1);

  return null;
};

/** Full-frame WebGL2 canvas whose drawing buffer follows Remotion's --scale. */
export const Stage: React.FC<{
  create: () => FrameRenderer;
  background: string;
}> = ({ create, background }) => {
  const { width, height } = useVideoConfig();
  const { isRendering } = getRemotionEnvironment();
  const devicePixelRatio = typeof window === "undefined" ? 1 : window.devicePixelRatio;
  // When rendering, the page's device scale factor *is* Remotion's --scale, so the
  // drawing buffer is exactly the output size (1280x720 at 1/3, 6000x3375 at 1.5625).
  // In the Studio, cap the buffer so heavy shaders stay interactive.
  const dpr = isRendering ? devicePixelRatio : Math.min(devicePixelRatio, 0.5);
  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={dpr}
        frameloop="demand"
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
        <Driver create={create} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
