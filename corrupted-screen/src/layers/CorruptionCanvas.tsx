import React, { useLayoutEffect, useMemo, useRef } from "react";
import {
  Block,
  Slab,
  buildBlocks,
  buildSlabs,
  drawBlocks,
  makeDitherPattern,
  slabGlow,
} from "./dataBlocks";
import { drawBaseFlicker, drawBaseStatic } from "./baseContent";
import { bandRange, TEAR_BANDS } from "../lib/plane";
import { Theme } from "../lib/theme";

/**
 * Layers 1-4 of the screen: base debris, data blocks, slice tearing and the RGB
 * channel split.
 *
 * The split is done by drawing the finished composite into two identical
 * canvases and letting the compositor keep one channel of each (a solid colour
 * multiplied over an opaque canvas) before screening them back together a few
 * pixels apart. Red plus cyan - or green plus magenta - partition RGB exactly,
 * so a zero offset would reproduce the original frame untouched.
 */

type Props = {
  theme: Theme;
  planeWidth: number;
  planeHeight: number;
  frame: number;
  level: number;
  /** Per band horizontal offsets, shared with the message layer. */
  tear: number[];
  split: number;
  pixelRatio: number;
};

type Buffers = {
  key: string;
  band: HTMLCanvasElement;
  bloom: HTMLCanvasElement;
  dither: CanvasPattern | null;
};

const BLOOM_DIVISOR = 4;

export const CorruptionCanvas: React.FC<Props> = ({
  theme,
  planeWidth,
  planeHeight,
  frame,
  level,
  tear,
  split,
  pixelRatio,
}) => {
  const canvasA = useRef<HTMLCanvasElement>(null);
  const canvasB = useRef<HTMLCanvasElement>(null);
  const buffers = useRef<Buffers | null>(null);

  const blocks: Block[] = useMemo(
    () => buildBlocks(planeWidth, planeHeight),
    [planeWidth, planeHeight],
  );
  const slabs: Slab[] = useMemo(() => buildSlabs(planeWidth, planeHeight), [planeWidth, planeHeight]);

  const deviceWidth = Math.round(planeWidth * pixelRatio);
  const deviceHeight = Math.round(planeHeight * pixelRatio);

  useLayoutEffect(() => {
    const a = canvasA.current;
    const b = canvasB.current;
    if (!a || !b) return;

    const ctx = a.getContext("2d", { alpha: false });
    const ctxB = b.getContext("2d", { alpha: false });
    if (!ctx || !ctxB) return;

    const key = `${deviceWidth}x${deviceHeight}`;
    if (!buffers.current || buffers.current.key !== key) {
      const band = document.createElement("canvas");
      band.width = deviceWidth;
      band.height = Math.ceil((planeHeight / TEAR_BANDS + 4) * pixelRatio);
      const bloom = document.createElement("canvas");
      bloom.width = Math.max(1, Math.round(deviceWidth / BLOOM_DIVISOR));
      bloom.height = Math.max(1, Math.round(deviceHeight / BLOOM_DIVISOR));
      buffers.current = { key, band, bloom, dither: makeDitherPattern(ctx) };
    }
    const bufs = buffers.current;

    // --- content ------------------------------------------------------------
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, planeWidth, planeHeight);

    drawBaseStatic(ctx, planeWidth, planeHeight, theme);
    drawBaseFlicker(ctx, planeWidth, planeHeight, theme, frame, level);
    const bloom = drawBlocks(
      ctx,
      blocks,
      theme,
      frame,
      level,
      bufs.dither,
      planeWidth,
      planeHeight,
    );

    // --- bloom on the hottest blocks and the blown out patches --------------
    const glow = slabGlow(slabs, frame, level);
    const bctx = bufs.bloom.getContext("2d");
    if (bctx && bloom.length + glow.length > 0) {
      const s = pixelRatio / BLOOM_DIVISOR;
      bctx.setTransform(s, 0, 0, s, 0, 0);
      bctx.clearRect(0, 0, planeWidth, planeHeight);
      bctx.fillStyle = theme.hot;
      for (const r of bloom) {
        bctx.fillRect(r.x, r.y, r.width, r.height);
      }
      bctx.fillStyle = theme.mid;
      bctx.globalAlpha = 0.34;
      for (const r of glow) {
        bctx.fillRect(r.x, r.y, r.width, r.height);
      }
      bctx.globalAlpha = 1;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.38;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.filter = `blur(${(planeWidth * 0.0026).toFixed(2)}px)`;
      ctx.drawImage(bufs.bloom, 0, 0, planeWidth, planeHeight);
      ctx.filter = "none";
      ctx.restore();
    }

    // --- slice tearing ------------------------------------------------------
    // Hard edged band copies. The band is snapshotted, the source is wiped to
    // the ground colour, then the snapshot is blitted back at an offset.
    const bandCtx = bufs.band.getContext("2d");
    if (bandCtx) {
      for (let i = 0; i < TEAR_BANDS; i++) {
        const dx = tear[i];
        if (!dx) continue;
        const { top, height } = bandRange(i, planeHeight);
        const dTop = Math.round(top * pixelRatio);
        const dHeight = Math.round(height * pixelRatio);

        bandCtx.setTransform(1, 0, 0, 1, 0, 0);
        bandCtx.clearRect(0, 0, bufs.band.width, bufs.band.height);
        bandCtx.drawImage(a, 0, dTop, deviceWidth, dHeight, 0, 0, deviceWidth, dHeight);

        ctx.fillStyle = theme.bg;
        ctx.fillRect(0, top, planeWidth, height);

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(
          bufs.band,
          0,
          0,
          deviceWidth,
          dHeight,
          Math.round(dx * pixelRatio),
          dTop,
          deviceWidth,
          dHeight,
        );
        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      }
    }

    // --- second copy for the other channel ----------------------------------
    ctxB.setTransform(1, 0, 0, 1, 0, 0);
    ctxB.globalCompositeOperation = "source-over";
    ctxB.drawImage(a, 0, 0);
  });

  const canvasStyle: React.CSSProperties = {
    position: "absolute",
    left: 0,
    top: 0,
    width: planeWidth,
    height: planeHeight,
    display: "block",
  };

  const passStyle = (offset: number): React.CSSProperties => ({
    position: "absolute",
    left: offset,
    top: 0,
    width: planeWidth,
    height: planeHeight,
    isolation: "isolate",
  });

  const maskStyle = (color: string): React.CSSProperties => ({
    position: "absolute",
    inset: 0,
    background: color,
    mixBlendMode: "multiply",
  });

  return (
    <div style={{ position: "absolute", inset: 0, isolation: "isolate" }}>
      <div style={passStyle(-split)}>
        <canvas ref={canvasA} width={deviceWidth} height={deviceHeight} style={canvasStyle} />
        <div style={maskStyle(theme.splitA)} />
      </div>
      <div style={{ ...passStyle(split), mixBlendMode: "screen" }}>
        <canvas ref={canvasB} width={deviceWidth} height={deviceHeight} style={canvasStyle} />
        <div style={maskStyle(theme.splitB)} />
      </div>
    </div>
  );
};
