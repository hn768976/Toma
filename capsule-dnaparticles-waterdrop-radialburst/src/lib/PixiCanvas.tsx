import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { WebGLRenderer } from 'pixi.js';
import {
  getRemotionEnvironment,
  useCurrentFrame,
  useDelayRender,
  useVideoConfig,
} from 'remotion';

export type PixiScene = {
  // Draw frame `frame` completely. Must be a pure function of `frame`.
  render: (frame: number) => void;
  destroy: () => void;
};

export type PixiSceneFactory = (
  renderer: WebGLRenderer,
  pixelWidth: number,
  pixelHeight: number,
) => PixiScene | Promise<PixiScene>;

// Renders a PixiJS 8 (WebGL2) stage once per Remotion frame, manually: no
// ticker, no clock. The canvas backing store is composition size times the
// render scale (devicePixelRatio in Remotion renders), so a 0.333 scale
// render draws 1280x720 pixels, a 4K render 3840x2160.
export const PixiCanvas: React.FC<{ create: PixiSceneFactory }> = ({ create }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<PixiScene | null>(null);
  const [ready, setReady] = useState(false);
  const [initHandle] = useState(() => delayRender('PixiJS init'));

  useEffect(() => {
    let cancelled = false;
    let renderer: WebGLRenderer | null = null;
    const env = getRemotionEnvironment();
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const resolution = env.isRendering ? dpr : Math.min(dpr, 0.5);
    const pw = Math.round(width * resolution);
    const ph = Math.round(height * resolution);
    (async () => {
      try {
        renderer = new WebGLRenderer();
        await renderer.init({
          canvas: canvasRef.current!,
          width: pw,
          height: ph,
          resolution: 1,
          autoDensity: false,
          antialias: false,
          preserveDrawingBuffer: true,
          backgroundAlpha: 1,
          backgroundColor: 0x000000,
          clearBeforeRender: true,
          preferWebGLVersion: 2,
          powerPreference: 'high-performance',
        });
        if (cancelled) return;
        const scene = await create(renderer, pw, ph);
        if (cancelled) {
          scene.destroy();
          return;
        }
        sceneRef.current = scene;
        setReady(true);
        continueRender(initHandle);
      } catch (e) {
        cancelRender(e as Error);
      }
    })();
    return () => {
      cancelled = true;
      sceneRef.current?.destroy();
      sceneRef.current = null;
      renderer?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (!ready || !sceneRef.current) return;
    const h = delayRender(`PixiJS frame ${frame}`);
    sceneRef.current.render(frame);
    continueRender(h);
  }, [frame, ready, delayRender, continueRender]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', position: 'absolute', inset: 0 }}
    />
  );
};
