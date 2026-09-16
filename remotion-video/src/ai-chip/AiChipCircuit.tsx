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
import { createScene, type SceneHandle } from "./scene";
import {
  createPresentation,
  requestRenderDevice,
  resolvePresentationMode,
} from "./gpu/presentation";
import { applyWebGpuCompat } from "./gpu/compat";

export const aiChipCircuitSchema = z.object({
  seed: z.number().int(),
  bloomStrength: z.number().min(0).max(4),
  bloomRadius: z.number().min(0).max(2),
  bloomThreshold: z.number().min(0).max(2),
  /** 1 for the 1080p master, 2 for the 4K master. */
  resolutionScale: z.number().min(1).max(4),
  /** MSAA samples on the scene pass. 0 disables it. */
  samples: z.number().int().min(0).max(8),
});

export type AiChipCircuitProps = z.infer<typeof aiChipCircuitSchema>;

export const aiChipCircuitDefaults: AiChipCircuitProps = {
  seed: 20240917,
  bloomStrength: 0.8,
  bloomRadius: 0.85,
  bloomThreshold: 0.35,
  resolutionScale: 1,
  samples: 4,
};

/**
 * Scene setup is expensive (route generation, texture baking and WGSL
 * compilation), so it happens once per page and every frame reuses it. Remotion
 * renders frames sequentially in a single tab, so the handle survives the whole
 * composition.
 */
export const AiChipCircuit: React.FC<AiChipCircuitProps> = ({
  seed,
  bloomStrength,
  bloomRadius,
  bloomThreshold,
  resolutionScale,
  samples,
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Promise<SceneHandle> | null>(null);
  const initHandleRef = useRef<number | null>(null);

  if (initHandleRef.current === null) {
    initHandleRef.current = delayRender("Initialising the WebGPU scene", {
      timeoutInMilliseconds: 300000,
    });
  }

  useEffect(() => {
    const container = containerRef.current;
    const initHandle = initHandleRef.current;
    if (container === null || initHandle === null) {
      return;
    }

    let disposed = false;

    const promise = (async () => {
      const { adapter, device } = await requestRenderDevice();
      applyWebGpuCompat(device);
      const presentation = createPresentation(
        device,
        width,
        height,
        resolvePresentationMode(adapter),
      );

      const scene = await createScene({
        width,
        height,
        device,
        presentation,
        seed,
        bloomStrength,
        bloomRadius,
        bloomThreshold,
        textureSize: resolutionScale >= 2 ? 4096 : 2048,
        samples,
      });

      if (!disposed) {
        const canvas = presentation.displayCanvas;
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.display = "block";
        container.appendChild(canvas);
      }

      return scene;
    })();

    sceneRef.current = promise;

    promise.then(
      () => continueRender(initHandle),
      (error) => cancelRender(error),
    );

    return () => {
      disposed = true;
      promise.then(
        (scene) => scene.dispose(),
        () => undefined,
      );
    };
    // The scene is built once for the lifetime of the page; prop changes in the
    // Studio are picked up by remounting the composition.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const promise = sceneRef.current;
    if (promise === null) {
      return;
    }

    const handle = delayRender(`Rendering frame ${frame}`, {
      timeoutInMilliseconds: 300000,
    });

    // The last frame lands one step short of a full turn, so frame 0 of a
    // repeat continues the motion exactly.
    const progress = frame / durationInFrames;

    promise
      .then((scene) => scene.renderFrame(progress))
      .then(
        () => continueRender(handle),
        (error) => cancelRender(error),
      );
  }, [frame, durationInFrames]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#010204" }}>
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};
