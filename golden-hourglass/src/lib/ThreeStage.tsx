import React, { useLayoutEffect, useRef } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import * as THREE from "three";

export type StageScene = {
  /** Draw exactly this frame. Must depend on nothing but `frame`. */
  render: (frame: number) => void;
  dispose: () => void;
};

export type StageContext = {
  renderer: THREE.WebGLRenderer;
  /** drawing-buffer size in real pixels */
  width: number;
  height: number;
  /** composition size (3840x2160) */
  compWidth: number;
  compHeight: number;
};

/**
 * A plain WebGL 2 canvas driven only by useCurrentFrame().
 * No requestAnimationFrame, no useFrame, no clocks: each frame is drawn
 * synchronously from the frame number, behind a delayRender() handle.
 * The drawing buffer follows the render scale (--scale=0.5 -> 1920x1080,
 * --scale=1 -> 3840x2160) so 1080p finals do not pay for 4K shading.
 */
export const ThreeStage: React.FC<{
  create: (ctx: StageContext) => StageScene;
  /** optional override of the frame that is drawn (used by LookDev) */
  frameOverride?: number;
}> = ({ create, frameOverride }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<StageScene | null>(null);

  useLayoutEffect(() => {
    const handle = delayRender("create three.js stage");
    const canvas = canvasRef.current as HTMLCanvasElement;
    const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
    // never draw more than the composition size; follow --scale below it
    const scale = Math.min(1, dpr);
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // post.ts encodes sRGB itself
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.autoClear = true;
    sceneRef.current = create({
      renderer,
      width: w,
      height: h,
      compWidth: width,
      compHeight: height,
    });
    continueRender(handle);
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
      renderer.dispose();
    };
  }, [create, width, height]);

  const f = frameOverride ?? frame;
  useLayoutEffect(() => {
    const handle = delayRender(`draw frame ${f}`);
    const s = sceneRef.current;
    if (s) {
      s.render(f);
      const gl = canvasRef.current?.getContext("webgl2");
      gl?.finish();
    }
    continueRender(handle);
  }, [f, create, width, height]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas
        ref={canvasRef}
        style={{ width, height, display: "block" }}
      />
    </AbsoluteFill>
  );
};
