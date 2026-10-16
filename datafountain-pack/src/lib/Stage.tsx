import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { use, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { useCurrentFrame, useRemotionEnvironment, useVideoConfig } from "remotion";

/**
 * <ThreeCanvas> wrapper: WebGL2, drawing buffer = output resolution.
 * With `--scale`, Remotion sets devicePixelRatio = scale, so a 3840×2160
 * composition renders a 1280×720 buffer at --scale=1/3 and 6000×3375 at
 * --scale=1.5625 — the shaders are written in resolution-independent units.
 * In the Studio the buffer is capped at half size to keep previews fluid.
 */
export const Stage: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { width, height } = useVideoConfig();
  const { isRendering } = useRemotionEnvironment();
  const dpr = typeof window === "undefined" ? 1 : isRendering ? window.devicePixelRatio : Math.min(window.devicePixelRatio, 0.5);
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={dpr}
      flat
      linear
      gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance", stencil: false }}
      style={{ position: "absolute", inset: 0 }}
    >
      {children}
    </ThreeCanvas>
  );
};

/**
 * Suspends (inside ThreeCanvas' delayRender-backed Suspense) until `promise`
 * resolves. Promises are memoised per tab at module level.
 */
export const useAsset = <T,>(promise: Promise<T>): T => use(promise);

export type Renderable = {
  /** Called with the current frame; must set every uniform from `frame` only. */
  update: (frame: number) => void;
  render: (gl: THREE.WebGLRenderer, frame: number) => void;
};

/**
 * Drives a look: on every frame, `update(frame)` sets uniforms (layout
 * effect, i.e. before ThreeCanvas advances R3F), and the priority-1 useFrame
 * callback is the *only* thing that draws — it ignores R3F's clock entirely
 * and reads the frame index the layout effect stored.
 */
export const useDrive = (r: Renderable) => {
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  const { advance } = useThree();
  useLayoutEffect(() => {
    frameRef.current = frame;
    r.update(frame);
  }, [frame, r]);
  useFrame(({ gl }) => {
    r.update(frameRef.current);
    r.render(gl, frameRef.current);
  }, 1);
  // First mount after assets resolved (declared after useFrame so the
  // callback is already subscribed): draw immediately, so the frame being
  // captured is never the empty pre-Suspense canvas.
  useLayoutEffect(() => {
    advance(performance.now());
  }, [advance]);
};
