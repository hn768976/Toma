import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import {
  AbsoluteFill,
  getRemotionEnvironment,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export type StageScene = {
  /** Draw the given frame. Must be a pure function of `frame`. */
  render: (frame: number) => void;
  dispose: () => void;
};

export type SceneFactory<P> = (ctx: {
  renderer: THREE.WebGLRenderer;
  /** Drawing-buffer size in real pixels */
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  params: P;
}) => StageScene;

/**
 * Hosts a raw Three.js / WebGL2 renderer inside a Remotion composition.
 * The drawing buffer follows the composition size multiplied by the render
 * scale (`--scale`), so the 3840x2160 composition renders natively at 4K
 * and `--scale=0.5` produces a native 1920x1080 render.
 */
export function ThreeStage<P>({
  factory,
  params,
}: {
  factory: SceneFactory<P>;
  params: P;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<StageScene | null>(null);
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();

  useLayoutEffect(() => {
    const canvas = canvasRef.current!;
    const scale = getRemotionEnvironment().isRendering
      ? window.devicePixelRatio || 1
      : 0.5; // half-res preview in the Studio / Player keeps scrubbing fluid
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.autoClear = false;
    sceneRef.current = factory({
      renderer,
      width: w,
      height: h,
      fps,
      durationInFrames,
      params,
    });
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
      renderer.dispose();
    };
  }, [width, height, fps, durationInFrames, factory, params]);

  useLayoutEffect(() => {
    sceneRef.current?.render(frame);
  }, [frame, width, height, fps, durationInFrames, factory, params]);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
}
