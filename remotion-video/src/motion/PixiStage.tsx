import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Application } from "pixi.js";

/** Everything a scene needs to know about the frame it is drawing. */
export type FrameState = {
  /** Current frame index, 0-based. */
  frame: number;
  /** Normalised progress through the composition, 0..1. */
  progress: number;
  /** Seconds elapsed since the first frame. */
  time: number;
  fps: number;
  durationInFrames: number;
  width: number;
  height: number;
  /**
   * Render size divided by the 1920x1080 design size. Scenes multiply any
   * pixel-space constant by this so a 4K render is identical to a 1080p one.
   */
  scale: number;
};

export type SceneDimensions = {
  width: number;
  height: number;
  scale: number;
};

/** A scene is a factory: it builds its display objects once, then redraws per frame. */
export type SceneUpdater = (state: FrameState) => void;
export type SceneFactory = (app: Application, dim: SceneDimensions) => SceneUpdater;

export const DESIGN_WIDTH = 1920;

type Props = {
  createScene: SceneFactory;
  /** Background colour of the WebGL canvas, as a CSS hex string. */
  backgroundColor: string;
};

/**
 * Hosts a PixiJS v8 WebGL canvas inside Remotion.
 *
 * Remotion screenshots the page once React has committed and every
 * delayRender() handle has resolved, so the contract here is:
 *   - initialise Pixi once (async in v8) behind a delayRender handle,
 *   - draw the current frame *synchronously* in a layout effect,
 *   - keep preserveDrawingBuffer on so the buffer survives until capture.
 */
export const PixiStage: React.FC<Props> = ({ createScene, backgroundColor }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const updateRef = useRef<SceneUpdater | null>(null);
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const [ready, setReady] = useState(false);
  const [initHandle] = useState(() => delayRender("pixi-init"));

  const buildState = useCallback(
    (f: number): FrameState => ({
      frame: f,
      progress: durationInFrames <= 1 ? 0 : f / (durationInFrames - 1),
      time: f / fps,
      fps,
      durationInFrames,
      width,
      height,
      scale: width / DESIGN_WIDTH,
    }),
    [durationInFrames, fps, width, height],
  );

  useEffect(() => {
    let disposed = false;
    const app = new Application();

    app
      .init({
        canvas: canvasRef.current as HTMLCanvasElement,
        width,
        height,
        preference: "webgl",
        antialias: true,
        // Without this the WebGL buffer can be cleared before Remotion
        // screenshots the page, which renders every frame black.
        preserveDrawingBuffer: true,
        autoStart: false,
        autoDensity: false,
        resolution: 1,
        background: backgroundColor,
        powerPreference: "high-performance",
      })
      .then(() => {
        if (disposed) {
          app.destroy(true, { children: true });
          return;
        }
        appRef.current = app;
        updateRef.current = createScene(app, {
          width,
          height,
          scale: width / DESIGN_WIDTH,
        });
        // Paint frame 0 before releasing the handle, so the very first
        // screenshot never catches an empty canvas.
        updateRef.current(buildState(frame));
        app.renderer.render(app.stage);
        setReady(true);
        continueRender(initHandle);
      })
      .catch((err: unknown) => {
        cancelRender(
          new Error(
            `PixiJS failed to initialise a WebGL context: ${
              err instanceof Error ? err.message : String(err)
            }`,
          ),
        );
      });

    return () => {
      disposed = true;
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
        updateRef.current = null;
      }
    };
    // Scenes are rebuilt only if the canvas size changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  useLayoutEffect(() => {
    if (!ready) return;
    const app = appRef.current;
    const update = updateRef.current;
    if (!app || !update) return;
    update(buildState(frame));
    app.renderer.render(app.stage);
  }, [frame, ready, buildState]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width, height, display: "block" }}
    />
  );
};
