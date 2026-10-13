import { useFrame } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

// One ThreeCanvas per composition. WebGL2, no MSAA on the default framebuffer
// (the Pipeline renders into its own MSAA half-float target), no tone mapping,
// no colour conversion (the composite pass does linear→sRGB itself).
export const SceneCanvas: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { width, height } = useVideoConfig();
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={dpr}
      linear
      flat
      gl={{
        antialias: false,
        alpha: false,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
        depth: true,
        stencil: false,
      }}
      style={{ position: "absolute", inset: 0 }}
    >
      {children}
    </ThreeCanvas>
  );
};

/**
 * Takes over R3F's render loop (priority 1). The callback receives the
 * Remotion frame captured during React render – never R3F's clock – so the
 * output of a frame depends on that frame number only.
 */
export const useFrameRender = (cb: (frame: number) => void) => {
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const cbRef = useRef(cb);
  cbRef.current = cb;
  useFrame(() => {
    cbRef.current(frameRef.current);
  }, 1);
};

// Easing helpers (pure functions of t).
export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const easeInOutCubic = (t: number) => {
  t = clamp01(t);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
export const easeOutBack = (t: number, s = 1.2) => {
  t = clamp01(t);
  const c3 = s + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
};
export const TAU = Math.PI * 2;
