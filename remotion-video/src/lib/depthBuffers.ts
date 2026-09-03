/**
 * Banded depth-of-field for canvas fields.
 *
 * Blurring per element is the naive way to fake depth and it costs O(elements)
 * expensive filter operations per frame. Instead every element is drawn
 * unblurred into the buffer for its depth band, and each buffer is blurred
 * exactly once on its way to the screen: three blurs per frame whether the
 * field holds fifty elements or five thousand.
 *
 * Bands are yours to choose. A convincing lens is sharp in the middle and soft
 * at both extremes, which is not what a single "further = blurrier" ramp gives
 * you.
 *
 * Several layers can share one buffer set, which is the point: shards and
 * arrows drawn into the same buffers interleave correctly by depth instead of
 * one group sitting flatly on top of the other. The buffers clear themselves
 * the first time they are touched on a new frame, so which layer draws first
 * is a detail rather than a contract.
 */

import React, { useLayoutEffect, useMemo, useRef } from "react";
import { createCanvas } from "./sprite";

export type DepthBand = {
  name: string;
  /** Upper bound of this band's depth range. The last band should use Infinity. */
  zMax: number;
  /** Blur radius in composition pixels. 0 leaves the band crisp. */
  blur: number;
};

export type DepthBuffers = {
  bands: readonly DepthBand[];
  canvases: HTMLCanvasElement[];
  contexts: CanvasRenderingContext2D[];
  width: number;
  height: number;
  /** Clears every buffer the first time it is called for a given frame. */
  begin: (frame: number) => void;
  contextFor: (band: number) => CanvasRenderingContext2D;
};

/** Index of the band a depth falls in. Bands must be ordered by ascending zMax. */
export const bandForDepth = (bands: readonly DepthBand[], z: number) => {
  for (let i = 0; i < bands.length; i++) {
    if (z < bands[i].zMax) return i;
  }
  return bands.length - 1;
};

export const useDepthBuffers = (
  width: number,
  height: number,
  bands: readonly DepthBand[],
): DepthBuffers | null => {
  const lastFrame = useRef<number>(-1);
  return useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvases = bands.map(() => createCanvas(width, height));
    const contexts = canvases.map((c) => c.getContext("2d")!);
    return {
      bands,
      canvases,
      contexts,
      width,
      height,
      begin: (frame: number) => {
        if (lastFrame.current === frame) return;
        lastFrame.current = frame;
        for (const ctx of contexts) ctx.clearRect(0, 0, width, height);
      },
      contextFor: (band: number) => contexts[band],
    };
  }, [width, height, bands]);
};

/** Flattens the buffers onto `target`, back to front, blurring each once. */
export const compositeDepthBuffers = (
  target: CanvasRenderingContext2D,
  buffers: DepthBuffers,
) => {
  target.clearRect(0, 0, buffers.width, buffers.height);
  target.globalCompositeOperation = "source-over";
  for (let i = 0; i < buffers.bands.length; i++) {
    const blur = buffers.bands[i].blur;
    target.filter = blur > 0 ? `blur(${blur}px)` : "none";
    target.drawImage(buffers.canvases[i], 0, 0);
  }
  target.filter = "none";
};

/**
 * Runs the composite as a pipeline step. Renders no DOM: place it after the
 * layers that draw into the buffers and before anything that reads the target.
 */
export const DepthComposite: React.FC<{
  buffers: DepthBuffers | null;
  targetRef: React.RefObject<HTMLCanvasElement | null>;
  frame: number;
}> = ({ buffers, targetRef, frame }) => {
  useLayoutEffect(() => {
    const ctx = targetRef.current?.getContext("2d");
    if (!ctx || !buffers) return;
    // If no layer touched the buffers this frame they still need clearing.
    buffers.begin(frame);
    compositeDepthBuffers(ctx, buffers);
  });
  return null;
};
