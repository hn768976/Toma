import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Application } from "pixi.js";
import { BASE_HEIGHT, BASE_WIDTH } from "../constants";

/** What a plate gets handed once, at setup time. */
export type SceneContext = {
  app: Application;
  /** Composition size in real pixels. */
  width: number;
  height: number;
  /** width / 1920 -- multiply every authored length by this. */
  scale: number;
  /** Total frames in the composition, for building periodic motion. */
  durationInFrames: number;
};

/** What a plate hands back. `draw` must be a pure function of `frame`. */
export type Scene = {
  draw: (frame: number) => void;
  destroy?: () => void;
};

export type SceneSetup = (ctx: SceneContext) => Scene;

export const PixiScene: React.FC<{
  setup: SceneSetup;
  /** Painted behind the canvas so the very first frame is never transparent. */
  background: string;
}> = ({ setup, background }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const sceneRef = useRef<Scene | null>(null);

  const [initHandle] = useState(() => delayRender("Initialising PixiJS scene"));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let disposed = false;
    const app = new Application();

    app
      .init({
        canvas: canvasRef.current as HTMLCanvasElement,
        width,
        height,
        resolution: 1,
        autoDensity: false,
        antialias: false,
        // Frames are driven by Remotion, never by Pixi's own clock.
        autoStart: false,
        sharedTicker: false,
        preference: "webgl",
        powerPreference: "high-performance",
        backgroundAlpha: 1,
        background: 0x000000,
        preserveDrawingBuffer: true,
      })
      .then(() => {
        if (disposed) {
          app.destroy(true, { children: true });
          return;
        }
        appRef.current = app;
        sceneRef.current = setup({
          app,
          width,
          height,
          scale: width / BASE_WIDTH,
          durationInFrames,
        });
        setReady(true);
        continueRender(initHandle);
      })
      .catch((err) => {
        // Surface WebGL/context failures as a render error instead of a
        // silently black video.
        console.error(err);
        continueRender(initHandle);
        throw err;
      });

    return () => {
      disposed = true;
      sceneRef.current?.destroy?.();
      sceneRef.current = null;
      if (appRef.current) {
        appRef.current.destroy(true, { children: true, texture: true });
        appRef.current = null;
      }
    };
    // Size/duration are fixed for the lifetime of a composition instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One delayRender handle per frame, created during the render pass so it
  // always exists before Remotion looks for pending handles. Guarding on the
  // frame number keeps it idempotent if React renders twice.
  const pendingRef = useRef<{ frame: number; handle: number } | null>(null);
  if (ready && pendingRef.current?.frame !== frame) {
    if (pendingRef.current) {
      continueRender(pendingRef.current.handle);
    }
    pendingRef.current = { frame, handle: delayRender(`Pixi frame ${frame}`) };
  }

  useLayoutEffect(() => {
    if (!ready || !appRef.current || !sceneRef.current) {
      return;
    }
    sceneRef.current.draw(frame);
    appRef.current.render();
    if (pendingRef.current) {
      continueRender(pendingRef.current.handle);
      pendingRef.current = null;
    }
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background,
        overflow: "hidden",
      }}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ display: "block", width: "100%", height: "100%" }}
      />
    </div>
  );
};

export { BASE_WIDTH, BASE_HEIGHT };
