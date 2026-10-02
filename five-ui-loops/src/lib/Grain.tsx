// Monochrome film grain as a canvas overlay for the CSS looks.
// Value = fixed hash of (device pixel x, y, frame) — never Math.random().
// Drawn at device resolution so it stays one-pixel fine at 1080p, 4K and stills.
import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

const hash3 = (x: number, y: number, f: number) => {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(f + 1, 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

export const grainAt = hash3;

export const Grain: React.FC<{ amount: number; frameModulo?: number }> = ({ amount, frameModulo }) => {
  const frame = useCurrentFrame();
  const f = frameModulo ? frame % frameModulo : frame;
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = ref.current!;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(width * dpr);
    const h = Math.round(height * dpr);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    const img = ctx.createImageData(w, h);
    const d = img.data;
    const a = amount * 2 * 255; // triangular noise in [-0.5, 0.5] -> alpha up to `amount`
    let i = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = (hash3(x, y, f) + hash3(x + 7919, y + 104729, f) - 1) * 0.5;
        const c = v > 0 ? 255 : 0;
        d[i] = c;
        d[i + 1] = c;
        d[i + 2] = c;
        d[i + 3] = Math.abs(v) * a + 0.5;
        i += 4;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [f, width, height, amount]);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <canvas ref={ref} style={{ width, height }} />
    </AbsoluteFill>
  );
};
