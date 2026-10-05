import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { getRemotionEnvironment, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * A look owns its own three.js scene, camera and post pipeline and draws one
 * frame from nothing but the frame number. No clocks, no carried state.
 */
export type Look = {
  render: (frame: number) => void;
  dispose: () => void;
};

export type LookFactory = (gl: THREE.WebGLRenderer) => Look;

const Driver: React.FC<{ create: LookFactory }> = ({ create }) => {
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  // Rebuild render targets if the drawing buffer changes size.
  const look = useMemo(() => {
    // Surface shader compile/link errors instead of silently skipping draws.
    gl.debug.checkShaderErrors = true;
    gl.debug.onShaderError = (glc, program, vs, fs) => {
      const log = [glc.getProgramInfoLog(program), glc.getShaderInfoLog(vs), glc.getShaderInfoLog(fs)].join("\n");
      throw new Error(`Shader error: ${log}`);
    };
    return create(gl);
  }, [gl, create, size.width, size.height, dpr]);
  useEffect(() => () => look.dispose(), [look]);
  // Priority > 0 makes this callback the renderer (R3F skips its own render).
  // It is only a hook to draw; time comes from Remotion's frame, never R3F's clock.
  useFrame(() => look.render(frameRef.current), 1);
  return null;
};

export const Stage: React.FC<{ create: LookFactory }> = ({ create }) => {
  const { width, height } = useVideoConfig();
  // Render at the page's device pixel ratio (Remotion's --scale sets it), so
  // --scale=1/3 draws a real 1280x720 buffer. In the Studio, cap the preview.
  const dpr = useMemo(() => {
    const d = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
    return getRemotionEnvironment().isRendering ? d : Math.min(d, 0.5);
  }, []);
  return (
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
      }}
      style={{ backgroundColor: "black" }}
    >
      <Driver create={create} />
    </ThreeCanvas>
  );
};
