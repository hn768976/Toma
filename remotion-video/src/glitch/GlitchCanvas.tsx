import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Application, type WebGLRenderer } from "pixi.js";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { GlitchEngine } from "./GlitchEngine";
import { VARIANTS_BY_ID } from "./variants";

export type GlitchCanvasProps = {
  variantId: string;
};

/**
 * Drives the Pixi engine from Remotion's frame clock.
 *
 * The engine holds no cross-frame state, so this is a plain "seek and draw":
 * phase is frame/durationInFrames, which reaches 1.0 only at the frame after
 * the last one — i.e. exactly frame 0 again. That is what makes the clips
 * loop without a seam.
 *
 * Drawing happens in a layout effect so the WebGL surface is up to date within
 * React's commit, before the browser paints and before Remotion captures.
 * `preserveDrawingBuffer` keeps the surface readable at capture time.
 */
export const GlitchCanvas: React.FC<GlitchCanvasProps> = ({ variantId }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const engineRef = useRef<GlitchEngine | null>(null);
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender(`pixi-init:${variantId}`));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const variant = VARIANTS_BY_ID[variantId];
    if (!variant) {
      cancelRender(new Error(`Unknown glitch variant "${variantId}"`));
      return;
    }

    let disposed = false;
    const app = new Application();

    app
      .init({
        canvas,
        width,
        height,
        preference: "webgl",
        antialias: false,
        autoDensity: false,
        resolution: 1,
        autoStart: false,
        sharedTicker: false,
        preserveDrawingBuffer: true,
        clearBeforeRender: true,
        background: 0x000000,
        powerPreference: "high-performance",
      })
      .then(() => {
        if (disposed) {
          app.destroy(true);
          return;
        }
        app.ticker?.stop();
        appRef.current = app;
        engineRef.current = new GlitchEngine(
          app.renderer as WebGLRenderer,
          variant,
          width,
          height,
        );
        setReady(true);
        continueRender(handle);
      })
      .catch((err) => cancelRender(err as Error));

    return () => {
      disposed = true;
      engineRef.current?.destroy();
      engineRef.current = null;
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
    };
    // Size and variant are fixed for the lifetime of a composition instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (!ready) return;
    engineRef.current?.render((frame % durationInFrames) / durationInFrames);
  }, [frame, durationInFrames, ready]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
