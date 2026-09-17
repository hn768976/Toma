import React, { useCallback, useEffect, useRef } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import * as THREE from "three/webgpu";
import { z } from "zod";

import { createNeuralFieldScene, type NeuralFieldScene } from "./scene";
import { installWebGPUCompat } from "./webgpuCompat";
import { createPresenter, type Presenter } from "./presenter";
import { PALETTES, PALETTE_NAMES, type PaletteName } from "./palettes";

export const neuralFieldSchema = z.object({
  palette: z.enum(PALETTE_NAMES as [PaletteName, ...PaletteName[]]),
  /** false = dense side on the left, as in the reference. true = flipped. */
  mirrored: z.boolean(),
  /** 1 at 1080p, 2 at 4K. Keeps detail density constant across resolutions. */
  resolutionScale: z.number().min(0.25).max(4),
  seed: z.number().int(),
  bloom: z.boolean(),
  /**
   * Skip the WebGPU backend even where it exists. Only useful for A/B
   * checking that both backends of WebGPURenderer produce the same picture.
   */
  forceWebGL: z.boolean(),
});

export type NeuralFieldProps = z.infer<typeof neuralFieldSchema>;

export const neuralFieldDefaults: NeuralFieldProps = {
  palette: "aurora",
  mirrored: false,
  resolutionScale: 1,
  seed: 20260917,
  bloom: true,
  forceWebGL: false,
};

/** Generous, because a 4K frame on a software rasteriser is not quick. */
const RENDER_TIMEOUT_MS = 300_000;

export const NeuralField: React.FC<NeuralFieldProps> = ({
  palette,
  mirrored,
  resolutionScale,
  seed,
  bloom,
  forceWebGL,
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGPURenderer | null>(null);
  const sceneRef = useRef<NeuralFieldScene | null>(null);
  const presenterRef = useRef<Presenter | null>(null);
  // Serialises renders. Remotion advances one frame at a time, but scrubbing
  // in the Studio can land a second frame on us mid-render.
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  const initialise = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) throw new Error("canvas not mounted");

    installWebGPUCompat();

    const renderer = new THREE.WebGPURenderer({
      canvas,
      antialias: true,
      alpha: false,
      forceWebGL,
    });
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    await renderer.init();

    // Worth surfacing: WebGPURenderer silently falls back to its WebGL2
    // backend when navigator.gpu is missing, which is exactly what happens in
    // most headless render environments.
    const backend = (renderer.backend as { isWebGPUBackend?: boolean })
      ?.isWebGPUBackend
      ? "WebGPU"
      : "WebGL2";
    console.log(`[neural-field] three.js backend: ${backend}`);

    rendererRef.current = renderer;
    presenterRef.current = createPresenter(renderer, canvas, width, height);
    sceneRef.current = createNeuralFieldScene({
      renderer,
      width,
      height,
      palette: PALETTES[palette],
      mirror: mirrored ? -1 : 1,
      resolutionScale,
      seed,
      bloomEnabled: bloom,
    });
  }, [palette, mirrored, resolutionScale, seed, bloom, forceWebGL, width, height]);

  // One effect per frame. The delayRender handle is taken synchronously so
  // there is never a moment where Remotion sees zero pending work and
  // screenshots a half-drawn canvas.
  useEffect(() => {
    const handle = delayRender(`neural-field frame ${frame}`, {
      timeoutInMilliseconds: RENDER_TIMEOUT_MS,
    });

    let cancelled = false;

    queueRef.current = queueRef.current
      .then(async () => {
        if (cancelled) return;
        if (!sceneRef.current) await initialise();
        if (cancelled) return;
        sceneRef.current!.render(frame / fps, presenterRef.current!.target);
        await presenterRef.current!.present();
        continueRender(handle);
      })
      .catch((err) => {
        cancelRender(err as Error);
      });

    return () => {
      cancelled = true;
      continueRender(handle);
    };
  }, [frame, fps, initialise]);

  useEffect(() => {
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
      presenterRef.current?.dispose();
      presenterRef.current = null;
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []);

  return (
    <AbsoluteFill style={{ backgroundColor: PALETTES[palette].background }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
