import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import * as THREE from "three";

/**
 * Minimal imperative Three.js integration for Remotion.
 *
 * - The scene is built once per browser tab (`build`).
 * - Every frame is a pure function of the frame number (`draw`), so frames can be
 *   rendered out of order / in parallel by Remotion's concurrent renderer.
 * - The drawing buffer is sized from the composition size (4K) multiplied by the
 *   device pixel ratio, so `--scale=0.5` renders a native 1080p framebuffer while a
 *   plain render produces full 3840x2160.
 */
export type SceneHandle = {
  render: (frame: number) => void;
  dispose: () => void;
};

export type BuildFn = (args: {
  renderer: THREE.WebGLRenderer;
  width: number;
  height: number;
  pixelRatio: number;
  fps: number;
  durationInFrames: number;
}) => SceneHandle;

export const useThreeScene = (build: BuildFn, ready = true) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<SceneHandle | null>(null);
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const [initHandle] = useState(() => delayRender("Building Three.js scene"));
  const [built, setBuilt] = useState(false);

  const buildRef = useRef(build);
  buildRef.current = build;

  useEffect(() => {
    if (!ready || !canvasRef.current) return;
    const pixelRatio =
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const handle = buildRef.current({
      renderer,
      width,
      height,
      pixelRatio,
      fps,
      durationInFrames,
    });
    handleRef.current = handle;
    setBuilt(true);
    continueRender(initHandle);
    return () => {
      handle.dispose();
      renderer.dispose();
      handleRef.current = null;
    };
  }, [ready, width, height, fps, durationInFrames, initHandle]);

  const draw = useCallback((f: number) => {
    handleRef.current?.render(f);
  }, []);

  useLayoutEffect(() => {
    if (!built) return;
    const h = delayRender(`Rendering frame ${frame}`);
    draw(frame);
    // Make sure the GPU has finished before the screenshot is taken.
    const gl = canvasRef.current?.getContext("webgl2");
    gl?.finish();
    continueRender(h);
  }, [frame, built, draw]);

  return canvasRef;
};

/** Deterministic PRNG (mulberry32). */
export const rng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Stateless hash -> [0,1). */
export const hash = (...n: number[]) => {
  let h = 2166136261 >>> 0;
  for (const v of n) {
    h ^= Math.floor(v) + 0x9e3779b9 + (h << 6) + (h >>> 2);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995) >>> 0;
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
