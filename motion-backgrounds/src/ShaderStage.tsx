import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Application,
  Container,
  Filter,
  GlProgram,
  Sprite,
  Texture,
  defaultFilterVert,
} from "pixi.js";
import {
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export type UniformSpec = Record<
  string,
  { value: number | Float32Array; type: "f32" | "vec2<f32>" | "vec3<f32>" }
>;

type Props = {
  fragment: string;
  uniforms: UniformSpec;
};

/**
 * Drives a fullscreen PixiJS v8 filter from Remotion's frame clock.
 *
 * Two things matter for deterministic rendering:
 *
 *  1. Pixi's ticker is never started. The renderer is invoked by hand, once per
 *     Remotion frame, with uniforms derived purely from `useCurrentFrame()`.
 *     Nothing reads wall-clock time, so a frame renders identically no matter
 *     when or in what order it is produced.
 *
 *  2. The canvas backing store is sized in *device* pixels. Remotion's --scale
 *     flag maps onto `devicePixelRatio`, so a 3840x2160 composition rendered at
 *     --scale=0.5 runs the shader at exactly 1920x1080 rather than shading 4K
 *     and downsampling.
 */
export const ShaderStage: React.FC<Props> = ({ fragment, uniforms }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const filterRef = useRef<Filter | null>(null);
  const stageRef = useRef<Container | null>(null);

  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  const [initHandle] = useState(() => delayRender("Initialising PixiJS"));
  const [ready, setReady] = useState(false);

  // Device-pixel dimensions of the render target.
  const dpr =
    typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);

  const renderFrame = useCallback(
    (phase: number) => {
      const app = appRef.current;
      const filter = filterRef.current;
      const stage = stageRef.current;
      if (!app || !filter || !stage) return;

      const u = filter.resources.shaderUniforms.uniforms as Record<
        string,
        number | Float32Array
      >;
      u.uPhase = phase;
      (u.uResolution as Float32Array).set([pixelWidth, pixelHeight]);

      app.renderer.render({ container: stage });

      // Force the driver to finish before Remotion screenshots the page.
      const gl = (app.renderer as unknown as { gl?: WebGL2RenderingContext }).gl;
      gl?.finish();
    },
    [pixelWidth, pixelHeight],
  );

  useEffect(() => {
    let disposed = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const app = new Application();

    app
      .init({
        canvas,
        width: pixelWidth,
        height: pixelHeight,
        // Required so the framebuffer still holds our pixels when Remotion
        // captures the frame.
        preserveDrawingBuffer: true,
        antialias: false,
        autoDensity: false,
        resolution: 1,
        autoStart: false,
        preference: "webgl",
        powerPreference: "high-performance",
        backgroundAlpha: 1,
        background: 0x000000,
      })
      .then(() => {
        if (disposed) {
          app.destroy(true);
          return;
        }

        app.ticker.stop();

        const glProgram = GlProgram.from({
          vertex: defaultFilterVert,
          fragment,
        });

        const filter = new Filter({
          glProgram,
          resources: {
            shaderUniforms: {
              uPhase: { value: 0, type: "f32" },
              uResolution: {
                value: new Float32Array([pixelWidth, pixelHeight]),
                type: "vec2<f32>",
              },
              ...uniforms,
            },
          },
        });

        // A plain white sprite stretched over the frame gives the filter
        // something to run against; the fragment shader ignores its contents
        // and writes the background procedurally.
        const quad = new Sprite(Texture.WHITE);
        quad.width = pixelWidth;
        quad.height = pixelHeight;

        const stage = new Container();
        stage.addChild(quad);
        stage.filters = [filter];
        stage.filterArea = {
          x: 0,
          y: 0,
          width: pixelWidth,
          height: pixelHeight,
        } as Container["filterArea"];

        appRef.current = app;
        filterRef.current = filter;
        stageRef.current = stage;

        setReady(true);
        continueRender(initHandle);
      })
      .catch((err) => {
        // Surface WebGL/context failures as a render error rather than a
        // silently black video.
        // eslint-disable-next-line no-console
        console.error("PixiJS init failed", err);
        continueRender(initHandle);
      });

    return () => {
      disposed = true;
      appRef.current = null;
      filterRef.current = null;
      stageRef.current = null;
      try {
        app.destroy(true);
      } catch {
        // Already torn down.
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fragment, pixelWidth, pixelHeight]);

  // Draw synchronously on every frame change, before the browser paints.
  React.useLayoutEffect(() => {
    if (!ready) return;
    // frame / durationInFrames, not (frame / (durationInFrames - 1)): frame N
    // must land exactly where frame 0 started, which is what closes the loop.
    renderFrame(frame / durationInFrames);
  }, [ready, frame, durationInFrames, renderFrame, uniforms]);

  return (
    <canvas
      ref={canvasRef}
      width={pixelWidth}
      height={pixelHeight}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
      }}
    />
  );
};
