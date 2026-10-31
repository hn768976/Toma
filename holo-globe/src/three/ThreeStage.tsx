import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { WebGLRenderer } from "three";

/**
 * Everything a scene needs to set itself up. The drawing buffer is
 * `width * pixelRatio` x `height * pixelRatio` pixels: a 3840x2160
 * composition rendered with `--scale=0.5` draws into a 1920x1080 buffer,
 * while a full-scale render draws a true 4K buffer. Scenes size every
 * pixel-based quantity (line widths, point sizes) with `pxScale`, so the
 * picture is identical at any output scale.
 */
export type StageContext = {
  renderer: WebGLRenderer;
  width: number;
  height: number;
  pixelRatio: number;
  /** Buffer height / 1080: multiply "1080p pixel" sizes by this. */
  pxScale: number;
  fps: number;
  durationInFrames: number;
};

export type SceneHandle = {
  /** Must be a pure function of the frame number (renders run out of order). */
  render: (frame: number) => void;
  dispose: () => void;
};

export type SceneFactory = (ctx: StageContext) => Promise<SceneHandle>;

export const ThreeStage: React.FC<{
  create: SceneFactory;
  overlay?: React.ReactNode;
}> = ({ create, overlay }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SceneHandle | null>(null);
  const [ready, setReady] = useState(false);
  const [initHandle] = useState(() =>
    delayRender("Building Three.js scene", { timeoutInMilliseconds: 120000 }),
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    // Never draw more than the composition's own resolution (keeps the
    // Studio preview on HiDPI screens from allocating an 8K buffer).
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1);
    const renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);

    create({
      renderer,
      width,
      height,
      pixelRatio,
      pxScale: (height * pixelRatio) / 1080,
      fps,
      durationInFrames,
    })
      .then((handle) => {
        if (cancelled) {
          handle.dispose();
          return;
        }
        sceneRef.current = handle;
        setReady(true);
        continueRender(initHandle);
      })
      .catch((err) => {
        console.error(err);
        throw err;
      });

    return () => {
      cancelled = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draw synchronously before Remotion takes the screenshot of this frame.
  useLayoutEffect(() => {
    if (ready && sceneRef.current) {
      sceneRef.current.render(frame);
    }
  }, [frame, ready]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      {overlay}
    </AbsoluteFill>
  );
};
