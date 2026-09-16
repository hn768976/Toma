import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { createSpiralScene, type SceneHandle } from "./scene";

export const spiralFlowSchema = z.object({
  /** Colour grade. `violet` matches the reference plate, `blue` is the sibling. */
  grade: z.enum(["violet", "blue"]),
  /**
   * Polar grid density multiplier. 1 is tuned for 1080p; UHD compositions push
   * this up so the creases between tubes stay crisp at 4x the pixel count.
   */
  meshDetail: z.number().min(0.4).max(3),
  /** MSAA samples for the scene pass. */
  samples: z.number().int().min(0).max(8),
  /**
   * Pin the WebGL2 fallback backend. `WebGPURenderer` already falls back on its
   * own when no adapter is present; this is here so a render can be forced onto
   * the same backend on every machine when you need byte-identical output.
   */
  forceWebGL: z.boolean(),
});

export type SpiralFlowProps = z.infer<typeof spiralFlowSchema>;

export const spiralFlowDefaults: SpiralFlowProps = {
  grade: "violet",
  meshDetail: 1,
  samples: 4,
  forceWebGL: false,
};

/**
 * Drives the Three.js scene from Remotion's frame clock.
 *
 * Remotion screenshots a frame only once every `delayRender` handle is
 * released, so each frame opens a handle, draws, and then releases it. Nothing
 * is tied to wall-clock time or `requestAnimationFrame`, which is what keeps
 * the render deterministic and re-runnable.
 */
export const SpiralFlow: React.FC<SpiralFlowProps> = ({
  grade,
  meshDetail,
  samples,
  forceWebGL,
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneHandle | null>(null);
  const frameRef = useRef(frame);
  frameRef.current = frame;

  const [setupHandle] = useState(() =>
    delayRender("Initialising the Spiral Flow renderer", {
      timeoutInMilliseconds: 240000,
    }),
  );

  const draw = useCallback(
    (scene: SceneHandle, at: number) =>
      scene.renderFrame(at).catch((err: unknown) => {
        cancelRender(err instanceof Error ? err : new Error(String(err)));
      }),
    [],
  );

  useEffect(() => {
    let disposed = false;
    const container = containerRef.current;
    if (!container) {
      return;
    }

    createSpiralScene({
      container,
      width,
      height,
      grade,
      durationInFrames,
      meshDetail,
      samples,
      forceWebGL,
    })
      .then(async (scene) => {
        if (disposed) {
          scene.dispose();
          return;
        }
        sceneRef.current = scene;
        // Surfaces in the render log which backend actually initialised.
         
        console.log(`[spiral-flow] three.js backend: ${scene.backend}`);
        await draw(scene, frameRef.current);
        continueRender(setupHandle);
      })
      .catch((err: unknown) => {
        cancelRender(err instanceof Error ? err : new Error(String(err)));
      });

    return () => {
      disposed = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
    // The scene is rebuilt only when its construction inputs change; the frame
    // is fed in through `frameRef` so stepping never tears the scene down.
  }, [
    width,
    height,
    grade,
    durationInFrames,
    meshDetail,
    samples,
    forceWebGL,
    draw,
    setupHandle,
  ]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) {
      // The very first frame is drawn by the setup effect above, which still
      // holds `setupHandle`, so there is nothing to wait for here.
      return;
    }
    const handle = delayRender(`Drawing Spiral Flow frame ${frame}`, {
      timeoutInMilliseconds: 240000,
    });
    draw(scene, frame).then(() => continueRender(handle));
  }, [frame, draw]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};
