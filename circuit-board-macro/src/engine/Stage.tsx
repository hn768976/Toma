import React, { useEffect, useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";

export type StageContext = {
  renderer: THREE.WebGLRenderer;
  /** Drawing-buffer size in physical pixels (composition size x render scale). */
  pixelWidth: number;
  pixelHeight: number;
  fps: number;
  durationInFrames: number;
};

export type SceneController = {
  /** Draw the given frame. Must be a pure function of `frame`. */
  render: (frame: number) => void;
  dispose: () => void;
};

export type SceneFactory = (ctx: StageContext) => SceneController;

/**
 * Frame-driven Three.js canvas for Remotion.
 *
 * The scene is rendered synchronously inside a layout effect for every frame,
 * so each Remotion screenshot always contains exactly the requested frame.
 * The drawing buffer follows `window.devicePixelRatio`, which means that
 * rendering the 4K composition with `--scale=0.5` draws natively at 1080p.
 */
export const Stage: React.FC<{
  factory: SceneFactory;
  background?: string;
}> = ({ factory, background = "#000" }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctrlRef = useRef<{
    factory: SceneFactory;
    ctrl: SceneController;
    renderer: THREE.WebGLRenderer;
  } | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!ctrlRef.current || ctrlRef.current.factory !== factory) {
      if (ctrlRef.current) {
        ctrlRef.current.ctrl.dispose();
        ctrlRef.current.renderer.dispose();
      }
      const dpr = window.devicePixelRatio || 1;
      const pixelWidth = Math.round(width * dpr);
      const pixelHeight = Math.round(height * dpr);
      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: false,
        alpha: false,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(1);
      renderer.setSize(pixelWidth, pixelHeight, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      const ctrl = factory({
        renderer,
        pixelWidth,
        pixelHeight,
        fps,
        durationInFrames,
      });
      ctrlRef.current = { factory, ctrl, renderer };
    }
    ctrlRef.current.ctrl.render(frame);
    // Make sure all GL commands are executed before Remotion captures the frame.
    ctrlRef.current.renderer.getContext().finish();
  }, [frame, factory, width, height, fps, durationInFrames]);

  useEffect(() => {
    return () => {
      if (ctrlRef.current) {
        ctrlRef.current.ctrl.dispose();
        ctrlRef.current.renderer.dispose();
        ctrlRef.current = null;
      }
    };
  }, []);

  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      <canvas ref={canvasRef} style={{ width, height, display: "block" }} />
    </AbsoluteFill>
  );
};
