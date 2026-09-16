import React, { useEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { BACKGROUND_COLOR } from "./constants";
import { createEngine, type Engine } from "./engine";

export const blockchainChainSchema = z.object({
  // "diagonal" reproduces the reference framing; "hero" is the
  // alternate left-to-right layout with a clear lower third.
  layout: z.enum(["diagonal", "hero"]),
  // 1 = 1080p, 2 = 4K. Must match the width/height the Composition is
  // registered with, so density scales with pixel count.
  resolutionScale: z.number().positive(),
  // Changing this reshuffles every procedural detail (cube skins,
  // particle placement, readouts) without touching the composition.
  seed: z.number().int(),
  depthOfField: z.boolean(),
});

export type BlockchainChainProps = z.infer<typeof blockchainChainSchema>;

export const blockchainChainDefaults: BlockchainChainProps = {
  layout: "diagonal",
  resolutionScale: 1,
  seed: 20260916,
  depthOfField: true,
};

// WebGPU device creation plus first-frame shader compilation runs into
// minutes on a software adapter, so the init handle gets a long leash.
const INIT_TIMEOUT_MS = 300_000;
const FRAME_TIMEOUT_MS = 180_000;

export const BlockchainChain: React.FC<BlockchainChainProps> = ({
  layout,
  resolutionScale,
  seed,
  depthOfField,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [ready, setReady] = useState(false);

  const [initHandle] = useState(() =>
    delayRender("blockchain: WebGPU init", {
      timeoutInMilliseconds: INIT_TIMEOUT_MS,
    }),
  );

  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;

    createEngine({
      canvas,
      width,
      height,
      layout,
      seed,
      resolutionScale,
      depthOfField,
    })
      .then((engine) => {
        if (cancelled) {
          engine.dispose();
          return;
        }
        engineRef.current = engine;
        setReady(true);
        continueRender(initHandle);
      })
      .catch((error) => {
        if (!cancelled) cancelRender(error as Error);
      });

    return () => {
      cancelled = true;
      engineRef.current?.dispose();
      engineRef.current = null;
    };
    // The engine is built once per browser tab and then reused for
    // every frame that tab renders; rebuilding it per frame would
    // recompile every shader.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!ready || !engine) return;

    const handle = delayRender(`blockchain: frame ${frame}`, {
      timeoutInMilliseconds: FRAME_TIMEOUT_MS,
    });
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      continueRender(handle);
    };

    engine
      .renderFrame(frame)
      .then(settle)
      .catch((error) => {
        if (settled) return;
        settled = true;
        cancelRender(error as Error);
      });

    return settle;
  }, [frame, ready]);

  return (
    <AbsoluteFill style={{ backgroundColor: BACKGROUND_COLOR }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
