import { useFrame } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useRef } from "react";
import { AbsoluteFill, getRemotionEnvironment, useCurrentFrame, useVideoConfig } from "remotion";
import type { WebGLRenderer } from "three";

/**
 * <ThreeCanvas> configured for hand-driven rendering:
 * - drawing buffer = composition size x devicePixelRatio (= Remotion `--scale`),
 *   so `--scale=0.5` really renders 1920x1080 and a 6000px still really renders 6000px;
 * - no tone mapping / colour management from R3F: every shader writes final values;
 * - no MSAA on the default framebuffer (the post pipeline owns anti-aliasing).
 */
export const GLStage: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { width, height } = useVideoConfig();
  const env = getRemotionEnvironment();
  const deviceDpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  // In the Studio the 3840px canvas is only shown scaled down; keep it light.
  const dpr = env.isRendering ? deviceDpr : Math.min(deviceDpr, 0.5);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
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
      >
        {children}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

/**
 * Takes over R3F's render for this canvas (priority 1 disables the default
 * render). The callback receives only the Remotion frame: R3F's clock and
 * delta are never read, so every pixel is a pure function of the frame.
 */
export const useFrameRender = (draw: (frame: number, gl: WebGLRenderer) => void) => {
  const frame = useCurrentFrame();
  const ref = useRef({ frame, draw });
  ref.current = { frame, draw };
  useFrame((state) => {
    ref.current.draw(ref.current.frame, state.gl);
  }, 1);
};
