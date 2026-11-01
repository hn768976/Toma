import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import * as THREE from "three";

/**
 * A stage owns the Three.js scene graph. It is created once per browser tab
 * and asked to draw a specific frame. Everything drawn must be a pure
 * function of `frame` so Remotion can render frames in any order / in
 * parallel tabs.
 */
export type Stage = {
  render: (frame: number) => void;
  dispose: () => void;
};

export type StageFactory = (
  renderer: THREE.WebGLRenderer,
  size: { width: number; height: number; fps: number; durationInFrames: number },
) => Stage;

/**
 * Renders a vanilla Three.js stage into a canvas that matches the
 * composition size. `pixelRatio` scales the WebGL backing store relative to
 * the composition (1 = native 4K for a 3840x2160 composition).
 */
export const ThreeStage: React.FC<{
  factory: StageFactory;
  pixelRatio?: number;
  background?: string;
}> = ({ factory, pixelRatio = 1, background = "#000" }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const [ready, setReady] = useState(false);
  const [initHandle] = useState(() => delayRender("Initialising WebGL stage"));

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    stageRef.current = factory(renderer, {
      width,
      height,
      fps,
      durationInFrames,
    });
    setReady(true);
    continueRender(initHandle);
    return () => {
      stageRef.current?.dispose();
      stageRef.current = null;
      renderer.dispose();
    };
  }, [factory, pixelRatio, width, height, fps, durationInFrames, initHandle]);

  const draw = useCallback((f: number) => {
    stageRef.current?.render(f);
  }, []);

  useLayoutEffect(() => {
    if (!ready) return;
    const handle = delayRender(`Rendering frame ${frame}`);
    draw(frame);
    // Let the compositor pick up the new WebGL frame before screenshotting.
    requestAnimationFrame(() => continueRender(handle));
  }, [frame, ready, draw]);

  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
