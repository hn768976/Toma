import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { createRig, type Rig } from "./rig";
import { VARIANTS } from "./variants";
import type { VariantId } from "./spec";

export const studioPodiumSchema = z.object({
  /** Which reference the composition reproduces. */
  variant: z.enum(
    ["PodiumDisc", "PodiumSlab", "PodiumCylinder"] as const satisfies
      readonly VariantId[],
  ),
  /** Force the WebGL2 fallback backend, for A/B-ing the two paths. */
  forceWebGL: z.boolean(),
});

export type StudioPodiumProps = z.infer<typeof studioPodiumSchema>;

/**
 * Drives three.js imperatively rather than through react-three-fiber.
 *
 * Remotion needs one deterministic, fully-settled render per frame. Doing it by
 * hand means every frame is: set uniforms -> await renderAsync -> continueRender,
 * with no reconciler or animation loop that could land a frame early or late.
 */
export const StudioPodium: React.FC<StudioPodiumProps> = ({
  variant,
  forceWebGL,
}) => {
  const spec = useMemo(() => {
    const found = VARIANTS.find((v) => v.id === variant);
    if (!found) throw new Error(`unknown studio variant: ${variant}`);
    return found;
  }, [variant]);

  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rigPromise = useRef<Promise<Rig> | null>(null);
  const rigRef = useRef<Rig | null>(null);

  const getRig = useCallback((): Promise<Rig> => {
    if (!rigPromise.current) {
      const canvas = canvasRef.current;
      if (!canvas) return Promise.reject(new Error("canvas not mounted"));
      rigPromise.current = createRig(
        canvas,
        spec,
        width,
        height,
        forceWebGL,
      ).then((rig) => {
        rigRef.current = rig;
        return rig;
      });
    }
    return rigPromise.current;
  }, [spec, width, height, forceWebGL]);

  // Tear the rig down when the composition itself changes.
  useEffect(() => {
    return () => {
      rigRef.current?.dispose();
      rigRef.current = null;
      rigPromise.current = null;
    };
  }, [spec, forceWebGL]);

  useEffect(() => {
    const handle = delayRender(
      `studio ${spec.id} frame ${frame}`,
      // WebGPU adapter acquisition and the first shader compile are slow on a
      // software backend; the per-frame renders after that are quick.
      { timeoutInMilliseconds: 120000 },
    );
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        continueRender(handle);
      }
    };

    getRig()
      .then(async (rig) => {
        rig.setSize(width, height);
        await rig.renderFrame(frame, durationInFrames);
        finish();
      })
      .catch((err: unknown) => {
        settled = true;
        cancelRender(err instanceof Error ? err : new Error(String(err)));
      });

    return finish;
  }, [frame, width, height, durationInFrames, spec.id, getRig]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
};
