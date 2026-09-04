import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { drawIris } from "./draw";
import { buildField } from "./field";
import { PALETTES } from "./palette";

export type IrisRingProps = {
  paletteId: keyof typeof PALETTES;
  seed: number;
};

const BLOOM_DIV = 5;

const ensure = (
  ref: React.MutableRefObject<HTMLCanvasElement | null>,
  w: number,
  h: number,
) => {
  if (!ref.current) ref.current = document.createElement("canvas");
  if (ref.current.width !== w) ref.current.width = w;
  if (ref.current.height !== h) ref.current.height = h;
  return ref.current.getContext("2d");
};

export const IrisRing: React.FC<IrisRingProps> = ({ paletteId, seed }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bloomSrcRef = useRef<HTMLCanvasElement | null>(null);
  const bloomBlurRef = useRef<HTMLCanvasElement | null>(null);

  // Strand identities are derived from the seed alone, so they are stable
  // across frames no matter what order Remotion's workers render them in.
  const field = useMemo(() => buildField(seed), [seed]);
  const palette = PALETTES[paletteId];

  // useLayoutEffect (not useEffect) so the frame is fully painted before
  // Remotion captures it.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const bw = Math.ceil(width / BLOOM_DIV);
    const bh = Math.ceil(height / BLOOM_DIV);
    const bloomSrc = ensure(bloomSrcRef, bw, bh);
    const bloomBlur = ensure(bloomBlurRef, bw, bh);
    if (!bloomSrc || !bloomBlur) return;

    drawIris({
      ctx,
      bloomSrc,
      bloomBlur,
      width,
      height,
      frame,
      durationInFrames,
      palette,
      field,
    });
  }, [frame, width, height, durationInFrames, palette, field]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
