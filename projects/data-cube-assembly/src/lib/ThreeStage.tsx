import React, { useLayoutEffect, useRef, useState } from "react";
import { continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";

/**
 * A scene controller is created once per mounted composition and must render
 * a frame purely as a function of `frame` (Remotion renders frames out of order
 * and in parallel tabs, so no state may carry over between frames).
 */
export type SceneController = {
  render: (frame: number) => void;
  dispose: () => void;
};

export type SceneFactory = (
  renderer: THREE.WebGLRenderer,
  width: number,
  height: number,
) => SceneController;

export const ThreeStage: React.FC<{ factory: SceneFactory }> = ({ factory }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<SceneController | null>(null);
  const [handle] = useState(() => delayRender("Initialising WebGL scene"));

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    controllerRef.current = factory(renderer, width, height);
    continueRender(handle);
    return () => {
      controllerRef.current?.dispose();
      controllerRef.current = null;
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factory, width, height]);

  useLayoutEffect(() => {
    controllerRef.current?.render(frame);
  }, [frame, factory, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width, height, display: "block", background: "#000" }}
    />
  );
};

/** Deterministic PRNG so every render of a frame is identical. */
export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
