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

  // Anything the scene is built around. Changing one of these in Studio has to
  // tear the scene down and build a new one - the palette and the mirror are
  // baked into the node graph at construction, so they cannot be swapped on a
  // live renderer.
  const sceneKey = `${width}x${height}:${variant}:${mirrored}`;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) {
      return;
    }

    const scene = createFlowRibbonScene({
      canvas,
      width,
      height,
      variant,
      mirrored,
    });
    sceneRef.current = scene;

    return () => {
      sceneRef.current = null;
      // The scene may still be initialising when this unmounts.
      scene.then((s) => s.dispose()).catch(() => undefined);
    };
    // sceneKey covers every value read here; it is listed so the scene is
    // rebuilt when any of them changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneKey]);

  const renderFrame = useCallback(
    async (at: number) => {
      const scene = sceneRef.current;
      if (scene === null) {
        // Only reachable if the canvas never mounted. Failing loudly beats
        // releasing the handle and letting Remotion capture a black frame.
        throw new Error("Flow ribbon scene was never created");
      }
      const resolved = await scene;
      // The scene can be torn down while its first render is still in flight.
      if (sceneRef.current !== scene) {
        return;
      }
      // The loop is closed: frame `durationInFrames` would land exactly on
      // frame 0, so the last rendered frame stops one step short of it.
      await resolved.render((at % durationInFrames) / durationInFrames);
    },
    [durationInFrames],
  );

  useEffect(() => {
    const handle = delayRender(`Rendering flow-ribbon frame ${frame}`);
    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        continueRender(handle);
      }
    };

    renderFrame(frame)
      .then(release)
      .catch((err) => {
        release();
        cancelRender(err);
      });

    // Releasing on cleanup keeps a frame that is abandoned mid-flight - which
    // happens when scrubbing in Studio, never during a batch render - from
    // stalling Remotion on a handle that will never be resolved.
    return release;
  }, [frame, renderFrame, sceneKey]);

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
