import { useLayoutEffect, useRef, useState } from "react";
import * as THREE from "three";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export type StageInfo = {
  renderer: THREE.WebGLRenderer;
  /** Composition size (4K), in CSS px. */
  width: number;
  height: number;
  /** Actual drawing-buffer size (4K, or 1080p when rendered with --scale=0.5). */
  bufferWidth: number;
  bufferHeight: number;
  /** bufferHeight / 2160 — use to keep pixel-sized things resolution independent. */
  pixelScale: number;
};

export type SceneController = {
  renderFrame: (frame: number) => void;
  dispose: () => void;
};

/**
 * Imperative Three.js stage driven by Remotion's frame clock.
 * The whole scene is a pure function of the frame number, so any frame can be
 * rendered in any order and in parallel tabs.
 *
 * The drawing buffer follows devicePixelRatio (capped at 1): rendering the 4K
 * composition with `--scale=0.5` rasterises natively at 1920x1080 instead of
 * rendering 4K and downsampling.
 */
export const ThreeStage: React.FC<{
  create: (info: StageInfo) => SceneController;
}> = ({ create }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<SceneController | null>(null);
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const [initHandle] = useState(() => delayRender("Initialising WebGL scene", { timeoutInMilliseconds: 180000 }));

  useLayoutEffect(() => {
    const canvas = canvasRef.current!;
    const dpr = Math.min(1, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const bufferWidth = Math.round(width * dpr);
    const bufferHeight = Math.round(height * dpr);
    controllerRef.current = create({
      renderer,
      width,
      height,
      bufferWidth,
      bufferHeight,
      pixelScale: bufferHeight / 2160,
    });
    continueRender(initHandle);
    return () => {
      controllerRef.current?.dispose();
      controllerRef.current = null;
      renderer.dispose();
      renderer.forceContextLoss();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    const handle = delayRender(`Rendering frame ${frame}`);
    controllerRef.current?.renderFrame(frame);
    // Make sure the GPU (or SwiftShader) finished before Remotion screenshots.
    const gl = (controllerRef.current ? canvasRef.current?.getContext("webgl2") : null) as
      | WebGL2RenderingContext
      | null;
    gl?.finish();
    continueRender(handle);
  }, [frame]);

  return (
    <AbsoluteFill>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
    </AbsoluteFill>
  );
};
