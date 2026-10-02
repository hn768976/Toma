import React, { useLayoutEffect, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

// Film grain for the 2D looks: a fixed integer hash of (pixel x, pixel y,
// frame) written into a canvas at device resolution and added on top with
// plus-lighter. ~2% amplitude. No Math.random(), no state between frames.
const hash = (x: number, y: number, f: number) => {
  let h = (x * 374761393 + y * 668265263 + f * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

// `seed` is the frame index the grain pattern is keyed on; looping
// compositions pass a value that wraps with the loop (default: frame).
export const Grain: React.FC<{ amount?: number; seed?: number }> = ({
  amount = 0.02,
  seed,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(width * dpr));
  const h = Math.max(1, Math.round(height * dpr));
  const f = seed ?? frame;

  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(w, h);
    const d = img.data;
    const amp = amount * 2 * 255; // value range 0..2*amount, mean = amount
    let i = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // triangular distribution: sum of two hashes
        const n = (hash(x, y, f) + hash(x + 7919, y + 104729, f)) * 0.5;
        const v = n * amp;
        d[i] = v;
        d[i + 1] = v;
        d[i + 2] = v;
        d[i + 3] = 255;
        i += 4;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [w, h, f, amount]);

  return (
    <canvas
      ref={ref}
      width={w}
      height={h}
      style={{
        position: "absolute",
        inset: 0,
        width,
        height,
        mixBlendMode: "plus-lighter",
        pointerEvents: "none",
      }}
    />
  );
};
