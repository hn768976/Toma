import React, { useLayoutEffect, useRef } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import * as THREE from "three";

/**
 * A frame-driven Three.js stage.
 *
 * The scene is built once, then `render(t)` is called synchronously for
 * every Remotion frame. Nothing depends on wall-clock time, so every frame
 * is deterministic and can be rendered in any order / in parallel tabs.
 *
 * The drawing buffer follows the composition size multiplied by the
 * device pixel ratio, so `--scale=1` renders a native 3840x2160 frame and
 * `--scale=0.5` renders the same 4K composition directly at 1920x1080
 * (quick previews). Final 1080p masters are made by rendering 4K and
 * downscaling (see README: `npm run master`).
 */
export type Stage = {
  render: (t: number, frame: number) => void;
  dispose: () => void;
};

export type StageFactory = (args: {
  renderer: THREE.WebGLRenderer;
  width: number;
  height: number;
  pixelRatio: number;
}) => Stage;

export const ThreeStage: React.FC<{
  factory: StageFactory;
  background?: string;
  antialias?: boolean;
  shadows?: boolean;
}> = ({ factory, background = "#000", antialias = true, shadows = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    THREE.ColorManagement.enabled = false;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    const pixelRatio =
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    if (shadows) {
      renderer.shadowMap.enabled = true;
      // PCF honours light.shadow.radius -> soft penumbra like the reference.
      renderer.shadowMap.type = THREE.PCFShadowMap;
    }
    rendererRef.current = renderer;
    stageRef.current = factory({ renderer, width, height, pixelRatio });
    return () => {
      stageRef.current?.dispose();
      stageRef.current = null;
      rendererRef.current = null;
      renderer.dispose();
    };
  }, [factory, width, height, antialias, shadows]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const handle = delayRender(`three frame ${frame}`);
    stage.render(frame / fps, frame);
    // Make sure the GPU has flushed before Remotion captures the frame.
    rendererRef.current?.getContext().finish();
    requestAnimationFrame(() => continueRender(handle));
  }, [frame, fps, factory]);

  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
