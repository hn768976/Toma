import { ThreeCanvas } from "@remotion/three";
import React from "react";
import { useRemotionEnvironment, useVideoConfig } from "remotion";

/**
 * Drawing-buffer pixel ratio. While rendering, Remotion sets devicePixelRatio
 * to --scale, so a 3840x2160 composition at scale 1/3 draws a 1280x720 buffer
 * (no resampling, grain stays one output pixel). In the Studio we cap it so
 * the preview stays interactive.
 */
export const useStageDpr = (): number => {
  const { isRendering } = useRemotionEnvironment();
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  return isRendering ? dpr : Math.min(dpr, 0.5);
};

/** ThreeCanvas configured for WebGL2, no tonemapping, no MSAA, no clock. */
export const Stage: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { width, height } = useVideoConfig();
  const dpr = useStageDpr();
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={dpr}
      flat
      linear
      frameloop="never"
      gl={{
        antialias: false,
        alpha: false,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      }}
      style={{ position: "absolute", inset: 0 }}
    >
      {children}
    </ThreeCanvas>
  );
};

/** Frame index inside the 600-frame loop: frame 600 maps exactly to 0. */
export const LOOP_FRAMES = 600;
export const loopFrame = (frame: number) =>
  ((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;
