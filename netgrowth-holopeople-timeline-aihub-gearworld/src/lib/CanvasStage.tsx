import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, continueRender, delayRender, getRemotionEnvironment, useCurrentFrame, useVideoConfig } from "remotion";
import { fontsLoaded, loadFonts } from "./fonts";

// Every Canvas 2D look draws in a fixed 1280x720 logical space; the stage
// scales it to the real pixel buffer (4K for a full render, 1280x720 at
// --scale=1/3, 6000x3375 for the big still).
export const LW = 1280;
export const LH = 720;

export type DrawInfo = {
  frame: number; // frame within the composition (wrapped for loops)
  fps: number;
  bw: number; // buffer width in device pixels
  bh: number;
  k: number; // device pixels per logical pixel
};

export type DrawFn = (ctx: CanvasRenderingContext2D, info: DrawInfo) => void;

export type PostFx = {
  grain: number; // peak-to-peak amplitude as a fraction of full scale (0 = off)
};

// Grain + TPDF dither, a fixed formula of pixel position and frame.
const applyGrain = (ctx: CanvasRenderingContext2D, bw: number, bh: number, frame: number, amount: number) => {
  const img = ctx.getImageData(0, 0, bw, bh);
  const d = img.data;
  const amp = amount * 255;
  const fz = Math.imul(frame + 1, 0x9e3779b1);
  let i = 0;
  for (let y = 0; y < bh; y++) {
    const fy = Math.imul(y, 0xd8163841) ^ fz;
    for (let x = 0; x < bw; x++) {
      let h = Math.imul(x, 0x8da6b343) ^ fy;
      h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
      h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
      h ^= h >>> 15;
      // two 16-bit uniforms -> triangular noise in [-1, 1]
      const n = (((h & 0xffff) + (h >>> 16)) / 65535 - 1) * amp;
      d[i] = d[i] + n;
      d[i + 1] = d[i + 1] + n;
      d[i + 2] = d[i + 2] + n;
      i += 4;
    }
  }
  ctx.putImageData(img, 0, 0);
};

export const bufferSize = (width: number, height: number) => {
  const env = getRemotionEnvironment();
  // While rendering, Remotion sets devicePixelRatio to --scale.
  const dpr = env.isRendering ? window.devicePixelRatio || 1 : Math.min(1, 1920 / width);
  return { bw: Math.max(1, Math.round(width * dpr)), bh: Math.max(1, Math.round(height * dpr)) };
};

export const CanvasStage: React.FC<{ draw: DrawFn; post: PostFx; loopFrames?: number }> = ({ draw, post, loopFrames }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const { bw, bh } = bufferSize(width, height);
  const f = loopFrames ? frame % loopFrames : frame;

  useLayoutEffect(() => {
    const run = () => {
      const canvas = ref.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d", { willReadFrequently: post.grain > 0 })!;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.filter = "none";
      const k = bw / LW;
      ctx.save();
      ctx.setTransform(k, 0, 0, k, 0, 0);
      draw(ctx, { frame: f, fps, bw, bh, k });
      ctx.restore();
      if (post.grain > 0) applyGrain(ctx, bw, bh, f, post.grain);
    };
    if (fontsLoaded()) {
      run();
      return;
    }
    const handle = delayRender("Loading fonts");
    loadFonts().then(() => {
      run();
      continueRender(handle);
    });
  }, [f, fps, bw, bh, draw, post.grain]);

  return (
    <AbsoluteFill>
      <canvas ref={ref} width={bw} height={bh} style={{ width, height }} />
    </AbsoluteFill>
  );
};
