import React, { useEffect, useRef } from "react";
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
import { GRADE_NAMES } from "./palette";

export const spiralFlowSchema = z.object({
  /** Colour grade. `violet` matches the reference plate; see `palette.ts`. */
  grade: z.enum(GRADE_NAMES),
  /**
   * Polar grid density multiplier. 1 is tuned for 1080p; UHD compositions push
   * this up so the creases between tubes stay crisp at 4x the pixel count.
   */
  meshDetail: z.number().min(0.4).max(3),
  /** MSAA samples for the scene pass. */
  samples: z.number().int().min(0).max(8),
  /**
   * Pin the WebGL2 fallback backend. The scene already probes for a usable
   * WebGPU backend; this is here so a render can be forced onto the same
   * backend on every machine when you need byte-identical output.
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
 * released, so the contract here is strict: **every** frame, including the
 * first, opens its own handle and only releases it after that exact frame has
 * been drawn. Nothing is tied to wall-clock time or `requestAnimationFrame`,
 * which is what keeps the render deterministic and re-runnable.
 *
 * An earlier version split this in two — a setup effect that drew the first
 * frame and a separate per-frame effect that skipped while the scene was still
 * building. Whichever frame a tab mounted on then escaped without a handle of
 * its own and was screenshotted showing whatever the scene had last drawn. At
 * concurrency 2 that quietly corrupted two frames per render, and the corrupt
 * frames were near-copies of neighbouring ones, so nothing downstream flagged
 * them.
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
  const sceneRef = useRef<Promise<SceneHandle> | null>(null);

  // Building the scene is expensive and must happen exactly once per page, but
  // it is also async, so frames can arrive while it is still in flight. Holding
  // it as a promise lets every frame await the same build rather than race it.
  //
  // The ref is read inside the cleanup rather than in the effect body: reading
  // it on mount captures the value from before the scene exists, which leaks
  // the renderer and its canvas.
  useEffect(() => {
    return () => {
      const built = sceneRef.current;
      sceneRef.current = null;
      built?.then((scene) => scene.dispose()).catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    const handle = delayRender(`Drawing Spiral Flow frame ${frame}`, {
      timeoutInMilliseconds: 300000,
    });
    let cancelled = false;

    if (sceneRef.current === null) {
      const container = containerRef.current;
      if (!container) {
        cancelRender(new Error("[spiral-flow] container was not mounted"));
        return;
      }
      sceneRef.current = createSpiralScene({
        container,
        width,
        height,
        grade,
        durationInFrames,
        meshDetail,
        samples,
        forceWebGL,
        onDeviceLost: (reason) => {
          cancelRender(
            new Error(
              `[spiral-flow] ${reason}. Every frame after this one would be ` +
                `blank, so the render is being failed rather than allowed to ` +
                `finish. Lower --concurrency or the meshDetail prop and retry.`,
            ),
          );
        },
      }).then((scene) => {
        // Surfaces in the render log which backend actually initialised.
        console.log(`[spiral-flow] three.js backend: ${scene.backend}`);
        return scene;
      });
    }

    sceneRef.current
      .then(async (scene) => {
        if (cancelled) {
          return;
        }
        await scene.renderFrame(frame);
        continueRender(handle);
      })
      .catch((err: unknown) => {
        cancelRender(err instanceof Error ? err : new Error(String(err)));
      });

    return () => {
      cancelled = true;
    };
  }, [
    frame,
    width,
    height,
    grade,
    durationInFrames,
    meshDetail,
    samples,
    forceWebGL,
  ]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};
