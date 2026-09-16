import React, { useCallback, useEffect, useRef } from "react";
import {
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import * as THREE from "three/webgpu";
import { z } from "zod";
import { PALETTES } from "./palette";
import { buildFiberOpticsScene, type FiberOpticsScene } from "./scene";
import { isWebGPUUsable } from "./webgpu-probe";

export const fiberOpticsSchema = z.object({
  /** Which colourway to render. */
  variant: z.enum(["blue", "violet"]),
  /**
   * `auto` uses WebGPU when the browser exposes a device that actually works
   * and falls back to the WebGL2 backend otherwise. Both run the same TSL node
   * materials through the same post-processing graph, so the image matches
   * either way.
   */
  backend: z.enum(["auto", "webgpu", "webgl"]).default("auto"),
  /** Changes the strand layout and data pattern without touching the look. */
  seed: z.number().int().default(20260916),
});

export type FiberOpticsProps = z.infer<typeof fiberOpticsSchema>;

export const fiberOpticsDefaults: FiberOpticsProps = {
  variant: "blue",
  backend: "auto",
  seed: 20260916,
};

/** Generous, because a 4K frame on a software GPU is not quick. */
const RENDER_TIMEOUT_MS = 600_000;

type Engine = {
  renderer: THREE.WebGPURenderer;
  post: THREE.PostProcessing;
  scene: FiberOpticsScene;
};

const createEngine = async ({
  canvas,
  width,
  height,
  variant,
  seed,
  forceWebGL,
}: {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  variant: FiberOpticsProps["variant"];
  seed: number;
  forceWebGL: boolean;
}): Promise<Engine> => {
  const renderer = new THREE.WebGPURenderer({
    canvas,
    antialias: true,
    alpha: false,
    forceWebGL,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.setClearColor(new THREE.Color(PALETTES[variant].background), 1);
  renderer.toneMapping = THREE.NoToneMapping;

  await renderer.init();

  const scene = buildFiberOpticsScene({
    palette: PALETTES[variant],
    aspect: width / height,
    seed,
  });
  const post = scene.buildPostProcessing(renderer);

  // Draw one throwaway frame now. Where WebGPU exists but the device is not
  // really usable — common in headless containers — this is where it falls
  // over, while we can still swap backends cleanly.
  scene.update(0, 0);
  post.render();

  return { renderer, post, scene };
};

export const FiberOptics: React.FC<FiberOpticsProps> = ({
  variant,
  backend,
  seed,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // The engine is held as a *promise*, not as state. Flipping a state flag when
  // setup finishes would let Remotion screenshot in the window between
  // `continueRender` and React flushing that update, and it would capture
  // whatever was drawn last — every frame comes out identical. Frame effects
  // instead register their own `delayRender` synchronously and await this.
  const engineRef = useRef<Promise<Engine> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    let disposed = false;

    const setup = async (): Promise<Engine> => {
      const useWebGPU =
        backend === "webgpu" ||
        (backend === "auto" && (await isWebGPUUsable()));

      if (useWebGPU) {
        try {
          return await createEngine({
            canvas, width, height, variant, seed, forceWebGL: false,
          });
        } catch (error) {
          if (backend === "webgpu") throw error;
          console.warn(
            "WebGPU device unusable, falling back to the WebGL2 backend:",
            error,
          );
        }
      }

      return createEngine({
        canvas, width, height, variant, seed, forceWebGL: true,
      });
    };

    const pending = setup();
    engineRef.current = pending;

    return () => {
      disposed = true;
      engineRef.current = null;
      void pending
        .then((engine) => {
          if (!disposed) return;
          engine.scene.dispose();
          engine.renderer.dispose();
        })
        .catch(() => {
          // Setup already reported its own failure.
        });
    };
  }, [backend, height, seed, variant, width]);

  const drawFrame = useCallback(async () => {
    const engine = await engineRef.current;
    if (!engine) return;
    // `durationInFrames - 1` so the final frame lands exactly on progress 1.
    const progress = durationInFrames > 1 ? frame / (durationInFrames - 1) : 0;
    engine.scene.update(progress, frame / fps);
    engine.post.render();
  }, [durationInFrames, fps, frame]);

  useEffect(() => {
    const handle = delayRender(`fiber-optics: frame ${frame}`, {
      timeoutInMilliseconds: RENDER_TIMEOUT_MS,
    });
    drawFrame()
      .catch((error) => {
        console.error(`fiber-optics: frame ${frame} failed`, error);
      })
      .finally(() => continueRender(handle));
  }, [drawFrame, frame]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
};
