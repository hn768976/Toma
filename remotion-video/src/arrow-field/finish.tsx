/**
 * The passes that run after the field is drawn: depth composite, bloom,
 * vignette and grain.
 *
 * Each is a component that renders nothing and draws in a layout effect, so
 * the whole frame is one ordered pipeline of siblings: shards, arrows,
 * composite, sparks, bloom, grain. React flushes sibling layout effects in
 * tree order, which is the ordering guarantee the pipeline relies on.
 */

import React, { useLayoutEffect } from "react";
import { random } from "remotion";
import {
  BLOOM_DIVISOR,
  GRAIN_DIVISOR,
  HEIGHT,
  LOOP_FRAMES,
  VIGNETTE_STRENGTH,
  WIDTH,
} from "./constants";
import { DepthBuffers, compositeDepthBuffers } from "./depth";
import { hexToRgba } from "./sprites";

export const BLOOM_W = WIDTH / BLOOM_DIVISOR;
export const BLOOM_H = HEIGHT / BLOOM_DIVISOR;
export const GRAIN_W = Math.round(WIDTH / GRAIN_DIVISOR);
export const GRAIN_H = Math.round(HEIGHT / GRAIN_DIVISOR);

/** Flattens the three depth buffers onto the visible field canvas. */
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

/**
 * Gathers bloom from a quarter-resolution copy of the field.
 *
 * The field canvas is transparent except where elements are, and translucent
 * elements only reach high alpha where they overlap — so alpha is already the
 * threshold. Screen-blending a blurred copy therefore lights up exactly the
 * dense overlaps and the sparks, and leaves a lone arrow alone.
 */
export const BloomPass: React.FC<{
  sourceRef: React.RefObject<HTMLCanvasElement | null>;
  targetRef: React.RefObject<HTMLCanvasElement | null>;
}> = ({ sourceRef, targetRef }) => {
  useLayoutEffect(() => {
    const source = sourceRef.current;
    const ctx = targetRef.current?.getContext("2d");
    if (!source || !ctx) return;
    ctx.clearRect(0, 0, BLOOM_W, BLOOM_H);
    ctx.drawImage(source, 0, 0, BLOOM_W, BLOOM_H);
  });
  return null;
};

/** Fine seeded grain, recomputed every frame from `frame % LOOP_FRAMES`. */
export const GrainLayer: React.FC<{
  targetRef: React.RefObject<HTMLCanvasElement | null>;
  frame: number;
}> = ({ targetRef, frame }) => {
  useLayoutEffect(() => {
    const ctx = targetRef.current?.getContext("2d");
    if (!ctx) return;
    // One Remotion random() seeds a cheap xorshift for the ~920k samples;
    // hashing every pixel through random() would dominate the frame budget.
    let state =
      (Math.floor(random(`grain:${frame % LOOP_FRAMES}`) * 0x7fffffff) | 0) || 1;
    const image = ctx.createImageData(GRAIN_W, GRAIN_H);
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      const level = (state >>> 24) & 0xff;
      data[i] = level;
      data[i + 1] = level;
      data[i + 2] = level;
      data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  });
  return null;
};

/** ~20% corner darkening, tinted with the variant's deep tone rather than black. */
export const Vignette: React.FC<{ deep: string }> = ({ deep }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      background: `radial-gradient(ellipse 72% 72% at 50% 50%, ${hexToRgba(
        deep,
        0,
      )} 40%, ${hexToRgba(deep, VIGNETTE_STRENGTH)} 100%)`,
    }}
  />
);
