/**
 * <BloomPass> — bloom gathered from a reduced-resolution copy of a layer.
 *
 * The trick is that no thresholding code is needed when the source layer is
 * transparent except where its content is, and its content is translucent:
 * alpha is ALREADY the threshold. Overlapping translucent shapes reach high
 * alpha, a lone shape does not, and screen-blending a blurred copy therefore
 * lights up exactly the dense overlaps and anything genuinely bright, while
 * leaving isolated elements alone.
 *
 * This pass only downsamples. The blur, gain and blend belong in CSS on the
 * target canvas (see `bloomLayerStyle`), where they run on the compositor
 * instead of the main thread — and where blur radii are in composition pixels
 * regardless of the canvas's backing store size.
 */

import React, { useLayoutEffect } from "react";

export const BloomPass: React.FC<{
  sourceRef: React.RefObject<HTMLCanvasElement | null>;
  targetRef: React.RefObject<HTMLCanvasElement | null>;
  width: number;
  height: number;
}> = ({ sourceRef, targetRef, width, height }) => {
  useLayoutEffect(() => {
    const source = sourceRef.current;
    const ctx = targetRef.current?.getContext("2d");
    if (!source || !ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(source, 0, 0, width, height);
  });
  return null;
};

export const bloomLayerStyle = (opts: {
  blur: number;
  brightness?: number;
  contrast?: number;
  opacity?: number;
  transform?: string;
}): React.CSSProperties => ({
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  display: "block",
  transform: opts.transform,
  filter: `blur(${opts.blur}px) brightness(${opts.brightness ?? 1.5}) contrast(${
    opts.contrast ?? 1.35
  })`,
  mixBlendMode: "screen",
  opacity: opts.opacity ?? 0.45,
});
