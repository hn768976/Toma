import React, { useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { LOOP } from "./loop";
import { canvasScale, useFrameCanvas } from "./useFrameCanvas";

/**
 * Anti-banding film grain. Every output pixel gets a value that is a fixed
 * integer hash of (x, y, frame % 600) — no Math.random(), so any frame
 * renders identically on any thread, and frame 600 == frame 0.
 *
 * Triangular-distributed noise in [-amount, +amount] is composited as white
 * (positive) or black (negative) with alpha |n|, which on dark areas adds
 * roughly ±amount·255 code values and breaks up 8-bit / H.264 contours.
 */
export const Grain: React.FC<{ amount?: number; seed?: number }> = ({ amount = 0.02, seed = 0 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const f = ((frame % LOOP) + LOOP) % LOOP;

  useFrameCanvas(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const s = canvasScale();
    const w = Math.max(1, Math.round(width * s));
    const h = Math.max(1, Math.round(height * s));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(w, h);
    const buf = new Uint32Array(img.data.buffer);
    const amp = amount * 255; // max alpha (0..255)
    const fs = Math.imul(f + 1, 0x9e3779b1) ^ Math.imul(seed + 7, 0x85ebca6b);
    for (let y = 0; y < h; y++) {
      const ys = Math.imul(y + 1, 0x27d4eb2d) ^ fs;
      const row = y * w;
      for (let x = 0; x < w; x++) {
        let v = Math.imul(x + 1, 0x165667b1) ^ ys;
        v ^= v >>> 15;
        v = Math.imul(v, 0x2c1b3c6d);
        v ^= v >>> 12;
        v = Math.imul(v, 0x297a2d39);
        v ^= v >>> 15;
        // two 16-bit uniforms → triangular in (-1, 1)
        const n = ((v & 0xffff) + (v >>> 16)) / 65535 - 1;
        const a = Math.round(Math.abs(n) * amp);
        // little-endian RGBA: A in the top byte
        buf[row + x] = n > 0 ? (a << 24) | 0x00ffffff : a << 24;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [f, width, height, amount, seed]);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <canvas ref={ref} style={{ width: "100%", height: "100%", display: "block" }} />
    </AbsoluteFill>
  );
};
