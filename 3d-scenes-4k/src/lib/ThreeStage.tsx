import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import * as THREE from "three";

export type StageController = {
  render: (frame: number) => void;
  dispose: () => void;
};

export type StageSetup = (
  renderer: THREE.WebGLRenderer,
  width: number,
  height: number,
) => StageController;

/**
 * Hosts a raw Three.js renderer on a canvas the size of the composition
 * (3840x2160). The scene is built once per tab; every frame is a pure
 * function of `frame`, so renders are deterministic under any concurrency.
 */
export const ThreeStage: React.FC<{ setup: StageSetup }> = ({ setup }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [controller, setController] = useState<StageController | null>(null);
  const [initHandle] = useState(() => delayRender("Init Three.js stage"));

  useEffect(() => {
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
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const ctrl = setup(renderer, width, height);
    setController(ctrl);
    continueRender(initHandle);
    return () => {
      ctrl.dispose();
      renderer.dispose();
    };
  }, [setup, width, height, initHandle]);

  useLayoutEffect(() => {
    if (!controller) return;
    const handle = delayRender(`Render frame ${frame}`);
    controller.render(frame);
    continueRender(handle);
  }, [controller, frame]);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
