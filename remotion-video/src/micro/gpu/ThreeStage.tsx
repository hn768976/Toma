// Frame-locked three.js stage for Remotion.
//
// Two things make this safe for an offline render:
//
//  1. Nothing animates itself. `world.update(frame)` must compute the world's
//     absolute state from the frame number alone, so frame N looks the same
//     whether it is rendered first, last, or twice on different machines.
//  2. Every frame holds a `delayRender()` handle until the GPU has actually
//     finished drawing, so Remotion never screenshots a half-drawn canvas.
//
// Depth of field is done by splitting the world into depth layers, each with
// its own scene, renderer and canvas, and blurring the canvases in CSS. That
// keeps the look identical across all three renderer tiers -- a postprocessing
// bokeh pass would have to be written twice, once in GLSL and once in TSL.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame } from "remotion";
import type { PerspectiveCamera, Scene } from "three";
import { createStageRenderer, type RendererTier, type StageRenderer } from "./createRenderer";
import { MASTER_WIDTH } from "../constants";

export interface StageLayer {
  /** Objects at this depth, with their own lights. */
  scene: Scene;
  /**
   * Blur radius in master (4K) pixels. ThreeStage rescales it to whatever
   * resolution the composition is actually running at, so a native 1080p
   * composition and a 4K one rendered at --scale 0.5 look the same.
   */
  blur: number;
  /** Optional constant opacity for the whole layer. */
  opacity?: number;
}

export interface StageWorld {
  camera: PerspectiveCamera;
  layers: StageLayer[];
  /** Pure function of frame: sets positions, rotations, colours, camera. */
  update: (frame: number) => void;
  dispose?: () => void;
}

export interface ThreeStageProps {
  width: number;
  height: number;
  /** Built once per mount; must not capture frame state. */
  build: (opts: { width: number; height: number }) => StageWorld;
  /** Pin a renderer tier, mostly to exercise the fallbacks. */
  preferredTier?: RendererTier;
  /** Reported once the renderers exist, for the debug overlay. */
  onTierResolved?: (tier: RendererTier) => void;
}

/**
 * Widens a camera so a blurred layer can be drawn with a margin outside the
 * frame. Without this, a CSS blur pulls transparency in from the canvas edge
 * and leaves a soft dark border around the picture.
 */
const applyOverscan = (
  camera: PerspectiveCamera,
  width: number,
  height: number,
  pad: number,
) => {
  const paddedW = width + pad * 2;
  const paddedH = height + pad * 2;
  const innerHalf = Math.tan(((camera.fov * Math.PI) / 180) / 2);
  const paddedHalf = (innerHalf * paddedH) / height;
  camera.fov = (2 * Math.atan(paddedHalf) * 180) / Math.PI;
  camera.aspect = paddedW / paddedH;
  camera.updateProjectionMatrix();
};

export const ThreeStage: React.FC<ThreeStageProps> = ({
  width,
  height,
  build,
  preferredTier = "webgpu",
  onTierResolved,
}) => {
  const frame = useCurrentFrame();
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<{
    world: StageWorld;
    renderers: StageRenderer[];
    cameras: PerspectiveCamera[];
    pads: number[];
  } | null>(null);
  const bootRef = useRef<Promise<void> | null>(null);
  const [initHandle] = useState(() =>
    delayRender("micro-stage: first frame", { timeoutInMilliseconds: 300000 }),
  );
  const initDoneRef = useRef(false);

  // Built once, then reused for every frame of this mount.
  const boot = useCallback(async () => {
    const container = containerRef.current;
    if (!container) throw new Error("ThreeStage container missing");

    const world = build({ width, height });
    // Render at the composition's true pixel size. Remotion's --scale lowers
    // devicePixelRatio, so a 4K composition rendered at --scale 0.5 fills a
    // 1920x1080 drawing buffer without any change to the scene.
    const dpr = Math.min(typeof window === "undefined" ? 1 : window.devicePixelRatio || 1, 1);

    const renderers: StageRenderer[] = [];
    const cameras: PerspectiveCamera[] = [];
    const pads: number[] = [];

    // Blur is authored against the 4K master; smaller compositions scale it
    // down so the depth of field covers the same fraction of the frame.
    const blurScale = width / MASTER_WIDTH;

    for (const layer of world.layers) {
      const blur = layer.blur * blurScale;
      const pad = Math.ceil(blur * 3);
      const renderer = await createStageRenderer({
        width: width + pad * 2,
        height: height + pad * 2,
        pixelRatio: dpr,
        preferred: preferredTier,
      });

      const canvas = renderer.domElement;
      canvas.style.position = "absolute";
      canvas.style.left = `${-pad}px`;
      canvas.style.top = `${-pad}px`;
      canvas.style.width = `${width + pad * 2}px`;
      canvas.style.height = `${height + pad * 2}px`;
      if (blur > 0) canvas.style.filter = `blur(${blur}px)`;
      if (layer.opacity !== undefined) canvas.style.opacity = String(layer.opacity);
      container.appendChild(canvas);

      renderers.push(renderer);
      cameras.push(world.camera.clone());
      pads.push(pad);
    }

    onTierResolved?.(renderers[0]?.tier ?? "webgl");
    stateRef.current = { world, renderers, cameras, pads };
  }, [build, width, height, preferredTier, onTierResolved]);

  const drawFrame = useCallback(
    async (f: number) => {
      if (!bootRef.current) bootRef.current = boot();
      await bootRef.current;
      const state = stateRef.current;
      if (!state) return;

      state.world.update(f);
      state.world.camera.updateMatrixWorld(true);

      for (let i = 0; i < state.world.layers.length; i++) {
        const cam = state.cameras[i];
        // Track the shared camera, then re-apply this layer's overscan.
        cam.position.copy(state.world.camera.position);
        cam.quaternion.copy(state.world.camera.quaternion);
        cam.fov = state.world.camera.fov;
        cam.near = state.world.camera.near;
        cam.far = state.world.camera.far;
        applyOverscan(cam, width, height, state.pads[i]);
        cam.updateMatrixWorld(true);

        await state.renderers[i].render(state.world.layers[i].scene, cam);
      }
    },
    [boot, width, height],
  );

  useEffect(() => {
    let cancelled = false;
    const handle = delayRender(`micro-stage: frame ${frame}`, {
      timeoutInMilliseconds: 300000,
    });

    drawFrame(frame)
      .then(() => {
        if (cancelled) return;
        continueRender(handle);
        if (!initDoneRef.current) {
          initDoneRef.current = true;
          continueRender(initHandle);
        }
      })
      .catch((err) => {
        // Surface the real error instead of a render timeout.
        if (!cancelled) {
          continueRender(handle);
          if (!initDoneRef.current) {
            initDoneRef.current = true;
            continueRender(initHandle);
          }
        }
        throw err;
      });

    return () => {
      cancelled = true;
      continueRender(handle);
    };
  }, [frame, drawFrame, initHandle]);

  useEffect(() => {
    return () => {
      const state = stateRef.current;
      if (!state) return;
      state.renderers.forEach((r) => r.dispose());
      state.world.dispose?.();
      stateRef.current = null;
    };
  }, []);

  return (
    <AbsoluteFill>
      <div
        ref={containerRef}
        style={{ position: "absolute", inset: 0, overflow: "hidden" }}
      />
    </AbsoluteFill>
  );
};
