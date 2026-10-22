import { useLayoutEffect, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";

export type StageHandle = {
  render: (frame: number) => void;
  dispose: () => void;
};

export type CreateStage = (
  renderer: THREE.WebGLRenderer,
  width: number,
  height: number,
  fps: number,
) => StageHandle;

// Hosts a WebGL 2 canvas at the composition's native resolution and redraws
// it synchronously whenever the Remotion frame changes. Everything rendered
// is a pure function of the frame number, so frames can render in any order.
export const ThreeStage: React.FC<{ create: CreateStage }> = ({ create }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<StageHandle | null>(null);

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
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    stageRef.current = create(renderer, width, height, fps);
    return () => {
      stageRef.current?.dispose();
      stageRef.current = null;
      renderer.dispose();
    };
  }, [create, width, height, fps]);

  useLayoutEffect(() => {
    stageRef.current?.render(frame);
  }, [frame]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
};
