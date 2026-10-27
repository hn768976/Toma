import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import * as THREE from "three";

export type Stage = {
  // Draws one frame. Must be a pure function of `frame` so that
  // Remotion can render frames out of order and in parallel tabs.
  render: (frame: number) => void;
  dispose: () => void;
};

export type StageFactory = (
  renderer: THREE.WebGLRenderer,
  size: { width: number; height: number; fps: number },
) => Stage | Promise<Stage>;

/**
 * Hosts a raw three.js renderer inside a Remotion composition.
 * The drawing buffer always matches the composition size (3840x2160),
 * so a `--scale=0.5` render is a supersampled downscale of the 4K frame.
 */
export const ThreeStage: React.FC<{ factory: StageFactory }> = ({
  factory,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<Stage | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const handle = delayRender("Building three.js stage");
    let cancelled = false;
    const canvas = canvasRef.current as HTMLCanvasElement;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    Promise.resolve(factory(renderer, { width, height, fps }))
      .then((stage) => {
        if (cancelled) {
          stage.dispose();
          return;
        }
        stageRef.current = stage;
        setReady(true);
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));

    return () => {
      cancelled = true;
      stageRef.current?.dispose();
      stageRef.current = null;
      renderer.dispose();
      continueRender(handle);
    };
  }, [factory, width, height, fps]);

  useLayoutEffect(() => {
    if (ready && stageRef.current) {
      stageRef.current.render(frame);
    }
  }, [frame, ready]);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%" }}
      />
    </AbsoluteFill>
  );
};
