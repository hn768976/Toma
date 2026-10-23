import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Palette, rgba } from "./palettes";
import {
  BLUR_LEVELS,
  CameraVariant,
  DW,
  LEVEL_RES,
  drawBackground,
  drawScene,
  drawVignette,
} from "./scene";

export type LightWavesProps = {
  palette: Palette;
  camera: CameraVariant;
};

type Buffers = {
  w: number;
  h: number;
  levels: HTMLCanvasElement[];
  blurred: HTMLCanvasElement[];
  acc: HTMLCanvasElement;
  bloomA: HTMLCanvasElement;
  bloomB: HTMLCanvasElement;
};

const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
};

const get2d = (c: HTMLCanvasElement) => {
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  return ctx;
};

const makeBuffers = (w: number, h: number): Buffers => ({
  w,
  h,
  levels: LEVEL_RES.map((r) => makeCanvas(w * r, h * r)),
  blurred: LEVEL_RES.map((r) => makeCanvas(w * r, h * r)),
  acc: makeCanvas(w, h),
  bloomA: makeCanvas(w / 4, h / 4),
  bloomB: makeCanvas(w / 10, h / 10),
});

export const LightWaves: React.FC<LightWavesProps> = ({ palette, camera }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const buffers = useRef<Buffers | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!buffers.current || buffers.current.w !== width) {
      buffers.current = makeBuffers(width, height);
    }
    const b = buffers.current;
    const S = width / DW;
    const t = frame / fps;

    // 1. Rasterise the scene into depth-of-field layers.
    const ctxs = b.levels.map((c, i) => {
      const ctx = get2d(c);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.setTransform(S * LEVEL_RES[i], 0, 0, S * LEVEL_RES[i], 0, 0);
      ctx.lineCap = "round";
      return ctx;
    });
    drawScene({ ctxs, t, palette, camera });

    // 2. Blur each layer at its own resolution and accumulate.
    const acc = get2d(b.acc);
    acc.globalCompositeOperation = "source-over";
    acc.filter = "none";
    acc.clearRect(0, 0, width, height);
    acc.globalCompositeOperation = "lighter";
    b.levels.forEach((lvl, i) => {
      if (BLUR_LEVELS[i] === 0) {
        acc.drawImage(lvl, 0, 0, width, height);
        return;
      }
      const tmp = get2d(b.blurred[i]);
      tmp.globalCompositeOperation = "source-over";
      tmp.filter = "none";
      tmp.clearRect(0, 0, lvl.width, lvl.height);
      tmp.filter = `blur(${BLUR_LEVELS[i] * S * LEVEL_RES[i]}px)`;
      tmp.drawImage(lvl, 0, 0);
      tmp.filter = "none";
      // Blurring spreads energy; lift it a little so defocused light still reads.
      acc.globalAlpha = Math.min(1, 1 + BLUR_LEVELS[i] / 40);
      acc.drawImage(b.blurred[i], 0, 0, width, height);
      acc.globalAlpha = 1;
    });

    // 3. Compose: background, scene, bloom, vignette.
    const ctx = get2d(canvas);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.filter = "none";
    ctx.setTransform(S, 0, 0, S, 0, 0);
    drawBackground(ctx, palette, t);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(b.acc, 0, 0);

    const bloom = (target: HTMLCanvasElement, radius: number, alpha: number) => {
      const bc = get2d(target);
      bc.globalCompositeOperation = "source-over";
      bc.filter = "none";
      bc.clearRect(0, 0, target.width, target.height);
      bc.filter = `blur(${radius * (target.width / DW)}px)`;
      bc.drawImage(b.acc, 0, 0, target.width, target.height);
      bc.filter = "none";
      // Tint the glow toward the palette's bloom color.
      bc.globalCompositeOperation = "source-atop";
      bc.fillStyle = rgba(palette.bloom, 0.35);
      bc.fillRect(0, 0, target.width, target.height);
      ctx.globalAlpha = alpha;
      ctx.drawImage(target, 0, 0, width, height);
      ctx.globalAlpha = 1;
    };
    bloom(b.bloomA, 8, 1.2);
    bloom(b.bloomB, 30, 1.1);

    ctx.globalCompositeOperation = "source-over";
    ctx.setTransform(S, 0, 0, S, 0, 0);
    drawVignette(ctx);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }, [frame, fps, width, height, palette, camera]);

  return (
    <AbsoluteFill style={{ backgroundColor: rgba(palette.bgDeep, 1) }}>
      <canvas ref={canvasRef} width={width} height={height} style={{ width, height }} />
    </AbsoluteFill>
  );
};

