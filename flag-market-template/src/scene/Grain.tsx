import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { hash3 } from "../random";

// Film grain (~2% std-dev) from a fixed hash of (pixel x, pixel y, frame),
// drawn at half the composition resolution. Breaks up banding in the dark
// flag + vignette gradients. No Math.random(): the same frame always
// produces the same grain, whatever order frames are rendered in.
const AMOUNT = 0.05; // triangular noise in [-1,1] (σ≈0.41) * 0.05 ≈ 2% σ

export const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const cw = Math.round(width / 2);
  const ch = Math.round(height / 2);

  useLayoutEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(cw, ch);
    const d = img.data;
    let o = 0;
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const n = hash3(x, y, frame * 2 + 1) + hash3(x + 7919, y + 104729, frame * 2 + 2) - 1;
        const v = n > 0 ? 255 : 0;
        d[o] = v;
        d[o + 1] = v;
        d[o + 2] = v;
        d[o + 3] = Math.round(Math.abs(n) * AMOUNT * 255);
        o += 4;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [frame, cw, ch]);

  return (
    <AbsoluteFill>
      <canvas ref={ref} width={cw} height={ch} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};
