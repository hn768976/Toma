// Remotion component wrapping the WebGPU scene.
//
// Remotion screenshots the page once every delayRender() handle has been
// released, so the bridge between the two is: open a handle for the current
// frame, await the asynchronous WebGPU submit, then release it. WebGPU has no
// synchronous render, so this handshake is what guarantees Remotion never
// captures a half-drawn or stale canvas.

import { useCallback, useEffect, useRef } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { DURATION_IN_FRAMES } from "./constants";
import { createFlowRibbonScene } from "./scene";
import type { FlowRibbonScene } from "./scene";

export const flowRibbonSchema = z.object({
  variant: z.enum(["reference", "cyan"]),
  mirrored: z.boolean(),
});

export type FlowRibbonProps = z.infer<typeof flowRibbonSchema>;

export const flowRibbonDefaults: FlowRibbonProps = {
  variant: "reference",
  mirrored: false,
};

export const FlowRibbon: React.FC<FlowRibbonProps> = ({ variant, mirrored }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Promise<FlowRibbonScene> | null>(null);
  const disposedRef = useRef(false);

  // One scene per mount, created lazily and shared by every frame effect.
  const getScene = useCallback((): Promise<FlowRibbonScene> => {
    if (sceneRef.current === null) {
      const canvas = canvasRef.current;
      if (canvas === null) {
        return Promise.reject(new Error("Canvas was not mounted"));
      }
      sceneRef.current = createFlowRibbonScene({
        canvas,
        width,
        height,
        variant,
        mirrored,
      });
    }
    return sceneRef.current;
  }, [width, height, variant, mirrored]);

  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
      const pending = sceneRef.current;
      sceneRef.current = null;
      // The scene may still be initialising when the component unmounts.
      pending?.then((scene) => scene.dispose()).catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    const handle = delayRender(`Rendering flow-ribbon frame ${frame}`);
    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        continueRender(handle);
      }
    };

    getScene()
      .then(async (scene) => {
        if (disposedRef.current) {
          return;
        }
        // The loop is closed: frame `durationInFrames` would land exactly on
        // frame 0, so the last rendered frame stops one step short of it.
        await scene.render((frame % durationInFrames) / durationInFrames);
      })
      .then(release)
      .catch((err) => {
        release();
        cancelRender(err);
      });

    return release;
  }, [frame, durationInFrames, getScene]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};

export { DURATION_IN_FRAMES };
