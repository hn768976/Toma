import React, { useEffect, useRef } from "react";
import type { Application } from "pixi.js";
import {
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { resolveBackend } from "../core/backend";

/**
 * PixiJS handles the 2D compositing layers -- the bokeh fields and drifting
 * particles that sit in front of and behind the three.js fibre slices. Doing
 * them as screen-space sprites rather than as more 3D geometry keeps their
 * size and softness independent of the camera, which is what a real
 * out-of-focus highlight does.
 *
 * Backend selection comes from the same page-wide `resolveBackend()` probe as
 * the three.js layers, so every canvas in a composition runs on one backend.
 */

export type PixiStage = {
  update: (frame: number, durationInFrames: number) => void;
  dispose: () => void;
};

export type PixiStageBuilder = (
  app: Application,
  width: number,
  height: number,
) => PixiStage;

const mountCanvas = (host: HTMLElement): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.style.position = "absolute";
  canvas.style.inset = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  host.appendChild(canvas);
  return canvas;
};

const createPixiApp = async (
  host: HTMLElement,
  width: number,
  height: number,
): Promise<{ app: Application; label: string }> => {
  const pixi = await import("pixi.js");
  const tier = await resolveBackend();
  const preference = tier === "webgpu" ? "webgpu" : "webgl";

  host.replaceChildren();
  const canvas = mountCanvas(host);

  const app = new pixi.Application();
  await app.init({
    canvas,
    width,
    height,
    backgroundAlpha: 0,
    preference,
    antialias: true,
    // Remotion drives the clock; an internal ticker would make frames depend
    // on wall time.
    autoStart: false,
    resolution: window.devicePixelRatio,
    autoDensity: false,
  });

  return { app, label: `pixi.js (${preference})` };
};

export const PixiLayer: React.FC<{
  build: PixiStageBuilder;
  style?: React.CSSProperties;
  onBackendResolved?: (label: string) => void;
}> = ({ build, style, onBackendResolved }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  const hostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const stageRef = useRef<PixiStage | null>(null);

  const buildRef = useRef(build);
  buildRef.current = build;
  const onBackendRef = useRef(onBackendResolved);
  onBackendRef.current = onBackendResolved;

  useEffect(() => {
    const handle = delayRender(`neural/pixi: frame ${frame}`, {
      timeoutInMilliseconds: 300_000,
    });

    let settled = false;
    const release = () => {
      if (!settled) {
        settled = true;
        continueRender(handle);
      }
    };

    void (async () => {
      try {
        const host = hostRef.current;
        if (!host) {
          release();
          return;
        }

        if (!appRef.current) {
          const { app, label } = await createPixiApp(host, width, height);
          appRef.current = app;
          onBackendRef.current?.(label);
          stageRef.current = buildRef.current(app, width, height);
        }

        const app = appRef.current;
        const stage = stageRef.current;
        if (!app || !stage) {
          release();
          return;
        }

        stage.update(frame, durationInFrames);
        app.renderer.render(app.stage);
        release();
      } catch (err) {
        release();
        cancelRender(err as Error);
      }
    })();

    return release;
  }, [frame, width, height, durationInFrames]);

  useEffect(() => {
    return () => {
      stageRef.current?.dispose();
      appRef.current?.destroy(false, { children: true });
      stageRef.current = null;
      appRef.current = null;
    };
  }, []);

  return <div ref={hostRef} style={{ position: "absolute", inset: 0, ...style }} />;
};
