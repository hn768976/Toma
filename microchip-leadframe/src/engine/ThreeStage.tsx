import React, { useLayoutEffect, useRef } from "react";
import {
  AbsoluteFill,
  getRemotionEnvironment,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import * as THREE from "three";

export type StageController = {
  /** Draw the given frame. Must be a pure function of `frame`. */
  render: (frame: number) => void;
  dispose: () => void;
};

export type StageArgs = {
  renderer: THREE.WebGLRenderer;
  /** Composition size in CSS pixels (3840x2160). */
  width: number;
  height: number;
  /** Drawing-buffer size in real pixels (composition size x pixel ratio). */
  bufferWidth: number;
  bufferHeight: number;
  fps: number;
  durationInFrames: number;
};

export type StageFactory = (args: StageArgs) => StageController;

/**
 * Pixel ratio of the WebGL drawing buffer.
 *
 * While rendering, Remotion sets the page's device scale factor to the value of
 * `--scale`, so a 3840x2160 composition rendered with `--scale=0.5` draws a
 * 1920x1080 buffer and a plain render draws the full 4K buffer.
 * In the Studio / Player we cap the buffer at 1080p to keep scrubbing responsive.
 */
const getPixelRatio = (): number => {
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  if (getRemotionEnvironment().isRendering) {
    return dpr;
  }
  return Math.min(dpr, 0.5);
};

/**
 * Hosts a raw Three.js WebGL2 renderer inside a Remotion composition and
 * redraws it synchronously for every frame, so each screenshot Remotion takes
 * contains exactly the frame that was asked for.
 */
export const ThreeStage: React.FC<{
  factory: StageFactory;
  background?: string;
}> = ({ factory, background = "#000" }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<StageController | null>(null);
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const pixelRatio = getPixelRatio();
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.autoClear = true;

    const controller = factory({
      renderer,
      width,
      height,
      bufferWidth: Math.round(width * pixelRatio),
      bufferHeight: Math.round(height * pixelRatio),
      fps,
      durationInFrames,
    });
    controllerRef.current = controller;

    return () => {
      controllerRef.current = null;
      controller.dispose();
      renderer.dispose();
    };
  }, [factory, width, height, fps, durationInFrames]);

  useLayoutEffect(() => {
    controllerRef.current?.render(frame);
  }, [frame, factory, width, height, fps, durationInFrames]);

  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      <canvas
        ref={canvasRef}
        style={{ width, height, display: "block" }}
      />
    </AbsoluteFill>
  );
};
