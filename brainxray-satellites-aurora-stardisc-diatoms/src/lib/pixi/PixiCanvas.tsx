import { Application, Container, RenderTexture } from "pixi.js";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  getRemotionEnvironment,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { createPostPass, PostOptions } from "./post";

export type PixiCtx = {
  app: Application;
  /** Design size (composition size, e.g. 3840x2160). Stage units. */
  W: number;
  H: number;
  /** Backing pixels per design unit. */
  res: number;
};

export type PixiLook<S> = {
  /** Build GPU resources once. May be async (textures). */
  build: (ctx: PixiCtx) => Promise<S> | S;
  /** Pure function of the frame: set uniforms / buffers. */
  update: (scene: S, frame: number, ctx: PixiCtx) => void;
  /** The container drawn into the half-float scene target. */
  root: (scene: S) => Container;
  post: PostOptions;
};

type Live<S> = { ctx: PixiCtx; scene: S; target: RenderTexture; post: ReturnType<typeof createPostPass> };

/**
 * Hosts a PixiJS 8 (WebGL2) look inside Remotion. No ticker: the stage is
 * rendered manually exactly once per Remotion frame, and everything on
 * screen is derived from useCurrentFrame().
 */
export function PixiCanvas<S>({ look }: { look: PixiLook<S> }) {
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [live, setLive] = useState<Live<S> | null>(null);
  const [initHandle] = useState(() => delayRender("PixiJS init"));

  useEffect(() => {
    let disposed = false;
    let app: Application | null = null;
    (async () => {
      const env = getRemotionEnvironment();
      // When rendering, Remotion sets devicePixelRatio = --scale, so the
      // backing store matches the output size (720p preview, 4K, 6K stills).
      const res = env.isRendering ? window.devicePixelRatio : 0.5;
      app = new Application();
      await app.init({
        canvas: canvasRef.current!,
        width: W,
        height: H,
        resolution: res,
        autoDensity: false,
        preference: "webgl",
        antialias: false,
        preserveDrawingBuffer: true,
        autoStart: false,
        sharedTicker: false,
        backgroundColor: 0x000000,
        backgroundAlpha: 1,
        hello: false,
        powerPreference: "high-performance",
      });
      app.ticker.stop();
      const ctx: PixiCtx = { app, W, H, res };
      const scene = await look.build(ctx);
      const target = RenderTexture.create({
        width: W,
        height: H,
        resolution: res,
        format: "rgba16float",
        antialias: false,
      });
      const post = createPostPass(ctx, target, look.post);
      if (disposed) return;
      setLive({ ctx, scene, target, post });
      continueRender(initHandle);
    })().catch((e) => {
      console.error(e);
      throw e;
    });
    return () => {
      disposed = true;
      app?.destroy(false, { children: true, texture: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (!live) return;
    const { ctx, scene, target, post } = live;
    look.update(scene, frame, ctx);
    post.update(frame);
    ctx.app.renderer.render({ container: look.root(scene), target, clear: true, clearColor: [0, 0, 0, 1] });
    ctx.app.renderer.render({ container: post.container, clear: true });
    const gl = (ctx.app.renderer as unknown as { gl?: WebGL2RenderingContext }).gl;
    gl?.finish();
  }, [live, frame, look]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
    </AbsoluteFill>
  );
}
