import React, { useEffect, useRef, useState } from "react";
import {
  cancelRender,
  continueRender,
  delayRender,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Palette } from "./palettes";
import { MODEL } from "./constants";
import { createEyeScene, type EyeScene } from "./scene/createEyeScene";

type Props = {
  palette: Palette;
  particleCount: number;
  wireframe: boolean;
  antialias: boolean;
};

// Bridges Remotion's frame clock to a three.js WebGPURenderer. Every frame
// registers a delayRender() handle that is released only after the GPU queue
// reports the frame as finished, so screenshots never catch a half-drawn frame.
export const EyeCanvas: React.FC<Props> = ({
  palette,
  particleCount,
  wireframe,
  antialias,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<EyeScene | null>(null);
  const [ready, setReady] = useState(false);
  const [initHandle] = useState(() =>
    delayRender("Initialising WebGPU eye scene", {
      timeoutInMilliseconds: 300000,
    }),
  );

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    createEyeScene({
      canvas,
      width,
      height,
      palette,
      modelUrl: staticFile(MODEL.url),
      particleCount,
      wireframe,
      antialias,
      durationSeconds: durationInFrames / fps,
    })
      .then((scene) => {
        if (cancelled) {
          scene.dispose();
          return;
        }
        sceneRef.current = scene;
        setReady(true);
        continueRender(initHandle);
      })
      .catch((err: unknown) => {
        cancelRender(err);
      });
    return () => {
      cancelled = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
    // The scene is built once per mount; palette/quality changes remount via key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!ready || !scene) {
      return;
    }
    const handle = delayRender(`Rendering eye frame ${frame}`, {
      timeoutInMilliseconds: 120000,
    });
    let released = false;
    scene
      .renderFrame(frame / fps)
      .then(() => {
        if (!released) {
          released = true;
          continueRender(handle);
        }
      })
      .catch((err: unknown) => {
        cancelRender(err);
      });
    return () => {
      if (!released) {
        released = true;
        continueRender(handle);
      }
    };
  }, [frame, fps, ready]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width, height, display: "block" }}
    />
  );
};
