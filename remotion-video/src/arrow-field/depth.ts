/**
 * Three offscreen depth buffers — far, mid, near — and the pass that flattens
 * them onto the visible field canvas.
 *
 * Depth-of-field is the expensive part of a field like this if you do it per
 * element. Here every element is drawn, unblurred, into the buffer for its
 * depth band, and each buffer is blurred exactly ONCE on its way to the
 * screen. Three blurs per frame, whatever the element count.
 *
 * Layers share the buffer set, so shards and arrows interleave correctly by
 * depth: a near shard sits in front of a far arrow. The buffers clear
 * themselves the first time they are touched on a new frame, which makes the
 * pass order between layers a detail rather than a contract.
 */

import { useMemo, useRef } from "react";
import { BandIndex, DEPTH_BANDS, HEIGHT, WIDTH } from "./constants";
import { createCanvas } from "./sprites";

export type DepthBuffers = {
  canvases: HTMLCanvasElement[];
  contexts: CanvasRenderingContext2D[];
  /** Clears the buffers the first time it is called for a given frame. */
  begin: (frame: number) => void;
  contextFor: (band: BandIndex) => CanvasRenderingContext2D;
};

export const useDepthBuffers = (): DepthBuffers | null => {
  const lastFrame = useRef<number>(-1);
  return useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvases = DEPTH_BANDS.map(() => createCanvas(WIDTH, HEIGHT));
    const contexts = canvases.map((c) => c.getContext("2d")!);
    const begin = (frame: number) => {
      if (lastFrame.current === frame) return;
      lastFrame.current = frame;
      for (const ctx of contexts) ctx.clearRect(0, 0, WIDTH, HEIGHT);
    };
    return {
      canvases,
      contexts,
      begin,
      contextFor: (band: BandIndex) => contexts[band],
    };
  }, []);
};

/**
 * Flattens the buffers onto `target`, back to front, blurring each once.
 * The mid band has zero blur and is drawn without a filter so it stays crisp.
 */
export const compositeDepthBuffers = (
  target: CanvasRenderingContext2D,
  buffers: DepthBuffers,
) => {
  target.clearRect(0, 0, WIDTH, HEIGHT);
  target.globalCompositeOperation = "source-over";
  for (let i = 0; i < DEPTH_BANDS.length; i++) {
    const blur = DEPTH_BANDS[i].blur;
    target.filter = blur > 0 ? `blur(${blur}px)` : "none";
    target.drawImage(buffers.canvases[i], 0, 0);
  }
  target.filter = "none";
};
