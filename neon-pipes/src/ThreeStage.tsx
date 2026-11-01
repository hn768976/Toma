import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";

/**
 * A scene built once per mount and rendered deterministically per frame.
 * `render(frame)` must draw synchronously so Remotion captures the result.
 */
export type SceneHandle = {
  render: (frame: number) => void;
  dispose: () => void;
};

export type SceneFactory = (
  renderer: THREE.WebGLRenderer,
  width: number,
  height: number,
  fps: number,
  durationInFrames: number,
) => SceneHandle;

/**
 * Hosts a plain Three.js WebGL2 renderer inside a Remotion composition.
 * The canvas backing store always matches the composition size (3840x2160),
 * so the 4K composition is rendered at full resolution; `--scale` can then be
 * used at render time to downsample to the 1080p delivery size.
 */
export const ThreeStage: React.FC<{ factory: SceneFactory }> = ({
  factory,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SceneHandle | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    sceneRef.current = factory(renderer, width, height, fps, durationInFrames);
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
      renderer.dispose();
    };
  }, [factory, width, height, fps, durationInFrames]);

  useLayoutEffect(() => {
    sceneRef.current?.render(frame);
  }, [frame, factory, width, height]);

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
