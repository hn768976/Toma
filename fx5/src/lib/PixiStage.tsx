import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  getRemotionEnvironment,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { autoDetectRenderer, type Renderer, type WebGLRenderer } from 'pixi.js';

export interface SceneCtx {
  renderer: Renderer;
  /** backing-store size in physical pixels */
  w: number;
  h: number;
  /** physical pixels per pixel of the 3840-wide design grid */
  s: number;
}
export interface Scene {
  /** Draw frame `frame`. Must depend on nothing but `frame`. */
  render(frame: number): void;
}
export type SceneFactory<P> = (ctx: SceneCtx, params: P) => Scene | Promise<Scene>;

/**
 * Hosts one PixiJS 8 WebGL2 renderer. The stage is drawn manually, once per
 * Remotion frame, synchronously in a layout effect (no ticker, no clock).
 */
export function PixiStage<P>({ factory, params }: { factory: SceneFactory<P>; params: P }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const [initHandle] = useState(() =>
    delayRender('PixiJS init', { timeoutInMilliseconds: 180000 }),
  );

  useEffect(() => {
    let disposed = false;
    let renderer: Renderer | null = null;
    // Pixi only logs shader compile failures; make them fatal for the render.
    const origError = console.error;
    console.error = (...args: unknown[]) => {
      origError(...args);
      if (args.some((a) => /Could not initialize shader|ERROR: \d+:\d+/.test(String(a)))) {
        cancelRender(new Error('Shader compile failed: ' + args.map(String).join(' ')));
      }
    };
    (async () => {
      const env = getRemotionEnvironment();
      // When rendering, Remotion's --scale becomes devicePixelRatio, so the
      // backing store matches the output size exactly. In the Studio, cap it.
      const dpr = env.isRendering ? window.devicePixelRatio : Math.min(1, 1920 / width);
      const pw = Math.round(width * dpr);
      const ph = Math.round(height * dpr);
      renderer = await autoDetectRenderer({
        preference: 'webgl',
        preferWebGLVersion: 2,
        canvas: canvasRef.current!,
        width: pw,
        height: ph,
        resolution: 1,
        autoDensity: false,
        antialias: false,
        preserveDrawingBuffer: true,
        background: '#000000',
        backgroundAlpha: 1,
        gcActive: false,
      } as any);
      const gl = (renderer as WebGLRenderer).gl as WebGL2RenderingContext;
      if (!gl || typeof (gl as any).texStorage2D !== 'function') {
        throw new Error('WebGL2 is required (run Chromium with --gl=angle).');
      }
      if (!gl.getExtension('EXT_color_buffer_float')) {
        throw new Error('EXT_color_buffer_float missing: half-float targets unavailable.');
      }
      const scene = await factory({ renderer, w: pw, h: ph, s: pw / 3840 }, params);
      if (disposed) return;
      sceneRef.current = scene;
      scene.render(frameRef.current);
      continueRender(initHandle);
    })().catch((e) => cancelRender(e));
    return () => {
      disposed = true;
      console.error = origError;
      sceneRef.current = null;
      renderer?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    sceneRef.current?.render(frame);
  }, [frame]);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </AbsoluteFill>
  );
}
