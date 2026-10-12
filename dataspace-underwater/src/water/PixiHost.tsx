import { Application } from "pixi.js";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";

/** A scene built once; draws the stage for one Remotion frame on demand. */
export type PixiScene = {
  render: (frame: number) => void;
  destroy: () => void;
};

export type PixiSceneFactory = (app: Application, pw: number, ph: number) => PixiScene | Promise<PixiScene>;

/**
 * Hosts a PixiJS 8 (WebGL2) canvas inside a Remotion composition.
 *
 * - The canvas backbuffer is sized to composition size × devicePixelRatio, so
 *   `--scale=1/3` renders a true 1280×720 frame and scale 1 renders 4K.
 * - No ticker: the stage is drawn manually, exactly once per Remotion frame,
 *   from useCurrentFrame() only.
 * - Sprites, textures and shaders are built once behind delayRender.
 */
export const PixiHost: React.FC<{ factory: PixiSceneFactory }> = ({ factory }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<PixiScene | null>(null);
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const [handle] = useState(() => delayRender("PixiJS init"));
  const [ready, setReady] = useState(false); // init flag only — never drives visuals

  useEffect(() => {
    let cancelled = false;
    let app: Application | null = null;
    (async () => {
      const dpr = window.devicePixelRatio || 1;
      const pw = Math.round(width * dpr);
      const ph = Math.round(height * dpr);
      app = new Application();
      await app.init({
        width: pw,
        height: ph,
        resolution: 1,
        preference: "webgl",
        antialias: false,
        preserveDrawingBuffer: true,
        autoStart: false,
        sharedTicker: false,
        background: "#000000",
        powerPreference: "high-performance",
        hello: false,
        autoDensity: false,
      });
      app.ticker.stop();
      if (cancelled) {
        app.destroy(true);
        return;
      }
      const canvas = app.canvas as HTMLCanvasElement;
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.display = "block";
      hostRef.current?.appendChild(canvas);
      const scene = await factory(app, pw, ph);
      if (cancelled) {
        scene.destroy();
        app.destroy(true);
        return;
      }
      sceneRef.current = scene;
      scene.render(frameRef.current);
      setReady(true);
      continueRender(handle);
    })().catch((err) => {
      console.error(err);
      throw err;
    });
    return () => {
      cancelled = true;
      sceneRef.current?.destroy();
      sceneRef.current = null;
      if (app && (app as unknown as { renderer?: unknown }).renderer) app.destroy(true);
    };
    // factory/size are fixed for the life of a composition
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (!ready || !sceneRef.current) return;
    sceneRef.current.render(frame);
  }, [frame, ready]);

  return <AbsoluteFill ref={hostRef} style={{ backgroundColor: "#000" }} />;
};
