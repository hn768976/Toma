import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  getRemotionEnvironment,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { autoDetectRenderer, type WebGLRenderer } from "pixi.js";
import { LOOP } from "./constants";
import { Post } from "./post";
import type { LookContext, Scene } from "./types";
import { LOOKS, type LookName } from "../looks";

// In the Studio the player is scaled down anyway; render a lighter backing
// store there so scrubbing stays interactive. During `remotion render` /
// `remotion still` the device pixel ratio *is* the --scale factor.
const STUDIO_RES = 0.3333333333333333;

export type PixiLoopProps = {
  look: LookName;
  params: Record<string, unknown>;
  loopCheck?: boolean;
};

export const PixiLoop: React.FC<PixiLoopProps> = ({ look, params }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender(`Init PixiJS (${look})`, { timeoutInMilliseconds: 600000 }));
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    let cancelled = false;
    let renderer: WebGLRenderer | null = null;
    let scene: Scene | null = null;
    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    hostRef.current?.appendChild(canvas);

    (async () => {
      const env = getRemotionEnvironment();
      const res = env.isRendering ? window.devicePixelRatio : STUDIO_RES;
      renderer = (await autoDetectRenderer({
        preference: "webgl",
        preferWebGLVersion: 2,
        canvas,
        width,
        height,
        resolution: res,
        autoDensity: false,
        antialias: false,
        backgroundColor: 0x000000,
        backgroundAlpha: 1,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
        hello: false,
      })) as WebGLRenderer;
      if (renderer.context.webGLVersion !== 2) throw new Error("WebGL2 is required");
      if (!renderer.context.extensions.colorBufferFloat) throw new Error("EXT_color_buffer_float missing");
      const pw = Math.round(width * res);
      const ph = Math.round(height * res);
      const post = new Post(renderer, width, height, res);
      const ctx: LookContext = { renderer, W: width, H: height, res, pw, ph, px: ph / 720, post };
      scene = await LOOKS[look](ctx, JSON.parse(paramsKey));
      if (cancelled) return;
      sceneRef.current = scene;
      scene.render(((frameRef.current % LOOP) + LOOP) % LOOP);
      setReady(true);
      continueRender(handle);
    })().catch((e) => cancelRender(e));

    return () => {
      cancelled = true;
      sceneRef.current = null;
      scene?.destroy?.();
      renderer?.destroy(false);
      canvas.remove();
    };
  }, [look, paramsKey, width, height, handle]);

  // Synchronous per-frame draw: the whole picture is a function of the frame.
  useLayoutEffect(() => {
    if (ready && sceneRef.current) sceneRef.current.render(((frame % LOOP) + LOOP) % LOOP);
  }, [frame, ready]);

  return <AbsoluteFill ref={hostRef} style={{ backgroundColor: "#000" }} />;
};
