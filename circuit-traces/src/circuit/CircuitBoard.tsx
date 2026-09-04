import React, { useLayoutEffect, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { buildBoard, type Board } from "./board";
import { buildLut, type Lut } from "./color";
import { BASE_H, BASE_W, OVERSCAN, PALETTES, type VariantName } from "./constants";
import { drawBaseBoard, drawPulses, drawVignette, grainTiles, TAIL_STEPS } from "./render";

// Camera drift amplitude in base px. Kept well inside OVERSCAN so the pan never
// exposes the edge of the generated board.
const CAM_X = 72;
const CAM_Y = 46;

const GRAIN_OFFSETS = [
  [0, 0], [97, 151], [203, 44], [61, 187], [139, 23], [18, 109], [231, 76], [85, 240],
  [166, 130], [42, 68], [118, 199], [7, 33], [212, 165], [74, 96], [188, 12],
] as const;

// The board is fixed geometry generated once from a seeded PRNG — not per
// frame, and never from Math.random(). Everything below is keyed so that a
// given (variant, resolution) always produces the identical picture.
const boardCache = new Map<VariantName, Board>();
const lutCache = new Map<VariantName, Lut>();
const baseCache = new Map<string, HTMLCanvasElement>();

type Scratch = { pulse: HTMLCanvasElement; glow1: HTMLCanvasElement; glow2: HTMLCanvasElement };
const scratchCache = new Map<string, Scratch>();

const SEEDS: Record<VariantName, number> = { neon: 20260904, amber: 71134902 };
const PULSE_COUNT: Record<VariantName, number> = { neon: 76, amber: 74 };

const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
};

const getBoard = (variant: VariantName) => {
  let b = boardCache.get(variant);
  if (!b) {
    b = buildBoard(SEEDS[variant], PULSE_COUNT[variant], PALETTES[variant].hotFraction);
    boardCache.set(variant, b);
  }
  return b;
};

const getLut = (variant: VariantName) => {
  let l = lutCache.get(variant);
  if (!l) {
    l = buildLut(PALETTES[variant], TAIL_STEPS);
    lutCache.set(variant, l);
  }
  return l;
};

export const CircuitBoard: React.FC<{ variant: VariantName }> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    // Remotion's --scale flag lowers the device pixel ratio, so backing the
    // canvas at min(dpr, 1) means a 1080p preview draws 1920x1080 pixels and a
    // 4K render draws 3840x2160 — the same picture, never oversampled.
    const dpr = Math.min(typeof window === "undefined" ? 1 : window.devicePixelRatio || 1, 1);
    const w = Math.max(1, Math.round(width * dpr));
    const h = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const scale = w / BASE_W;
    const palette = PALETTES[variant];
    const board = getBoard(variant);
    const lut = getLut(variant);

    const baseKey = `${variant}:${w}x${h}`;
    let base = baseCache.get(baseKey);
    if (!base) {
      base = makeCanvas((BASE_W + OVERSCAN * 2) * scale, (BASE_H + OVERSCAN * 2) * scale);
      const bctx = base.getContext("2d", { alpha: false });
      if (!bctx) return;
      drawBaseBoard(bctx, board, lut, palette, scale);
      baseCache.set(baseKey, base);
    }

    const scratchKey = `${w}x${h}`;
    let scratch = scratchCache.get(scratchKey);
    if (!scratch) {
      scratch = {
        pulse: makeCanvas(w, h),
        glow1: makeCanvas(w / 4, h / 4),
        glow2: makeCanvas(w / 12, h / 12),
      };
      scratchCache.set(scratchKey, scratch);
    }

    const th = (Math.PI * 2 * frame) / durationInFrames;
    const loopT = frame / durationInFrames;
    // Two harmonics of the loop frequency: the drift wanders rather than
    // sliding, and still lands exactly back on frame 0's position at frame 480.
    const camX = (Math.sin(th) + 0.34 * Math.sin(2 * th + 1.7)) * CAM_X * scale;
    const camY = (Math.sin(th + 2.4) + 0.3 * Math.sin(2 * th + 0.4)) * CAM_Y * scale;
    const breathe = 1 - 0.08 * Math.cos(th);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = Math.min(1, 0.95 * breathe);
    ctx.drawImage(base, camX - OVERSCAN * scale, camY - OVERSCAN * scale);
    ctx.globalAlpha = 1;

    const pctx = scratch.pulse.getContext("2d");
    if (!pctx) return;
    drawPulses(pctx, board, lut, scale, camX, camY, loopT);

    // Bloom: two downsampled, blurred copies of the pulse layer composited
    // additively. The crisp copy goes on top, so the routing keeps its edges
    // and only the pulse heads and lit components bleed.
    const g1 = scratch.glow1.getContext("2d");
    const g2 = scratch.glow2.getContext("2d");
    if (!g1 || !g2) return;
    g1.setTransform(1, 0, 0, 1, 0, 0);
    g1.clearRect(0, 0, scratch.glow1.width, scratch.glow1.height);
    g1.imageSmoothingQuality = "high";
    g1.drawImage(scratch.pulse, 0, 0, scratch.glow1.width, scratch.glow1.height);
    g2.setTransform(1, 0, 0, 1, 0, 0);
    g2.clearRect(0, 0, scratch.glow2.width, scratch.glow2.height);
    g2.imageSmoothingQuality = "high";
    g2.drawImage(scratch.glow1, 0, 0, scratch.glow2.width, scratch.glow2.height);

    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = Math.min(1, 0.86 * breathe);
    ctx.drawImage(scratch.pulse, 0, 0);
    ctx.filter = `blur(${(w * 0.0032).toFixed(2)}px)`;
    ctx.globalAlpha = Math.min(1, 0.7 * breathe);
    ctx.drawImage(scratch.glow1, 0, 0, w, h);
    ctx.filter = `blur(${(w * 0.0075).toFixed(2)}px)`;
    ctx.globalAlpha = Math.min(1, 0.56 * breathe);
    ctx.drawImage(scratch.glow2, 0, 0, w, h);
    ctx.filter = "none";

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    drawVignette(ctx, w, h, 0.5);

    // Fine grain, purely to keep H.264 from banding across the near-black
    // background. Tile and offset cycle on periods of 16 and 15 frames, so the
    // pattern repeats every 240 frames and the 480-frame loop stays seamless.
    const tiles = grainTiles();
    const [ox, oy] = GRAIN_OFFSETS[frame % GRAIN_OFFSETS.length];
    const pattern = ctx.createPattern(tiles[frame % tiles.length], "repeat");
    if (pattern) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.045;
      ctx.fillStyle = pattern;
      ctx.save();
      ctx.translate(-ox, -oy);
      ctx.fillRect(ox, oy, w, h);
      ctx.restore();
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    }
  });

  return (
    <canvas
      ref={ref}
      style={{ width, height, display: "block", backgroundColor: PALETTES[variant].background }}
    />
  );
};
