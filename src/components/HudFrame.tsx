import React, {useEffect, useMemo, useRef} from 'react';
import {
  BORDER,
  BOTTOM,
  H,
  LEFT,
  RIGHT,
  TOP,
  VIEWPORT,
  W,
} from '../lib/layout';
import {rgba} from '../lib/color';
import {brackets, hline, offscreen, toPal, vline} from '../lib/chrome';
import type {Pal} from '../lib/chrome';
import {reveal} from '../lib/rand';
import type {Palette} from '../variants';

type Ctx = CanvasRenderingContext2D;

const drawBrackets = (ctx: Ctx, p: Pal) => {
  brackets(ctx, 8, 8, W - 16, H - 16, 150, p.accent, 0.95, 4);
  brackets(ctx, 8, 8, W - 16, H - 16, 60, p.line, 0.6, 10);
};

const drawDividers = (ctx: Ctx, p: Pal) => {
  const gapL = LEFT.x + LEFT.w + (VIEWPORT.x - (LEFT.x + LEFT.w)) / 2;
  const gapR = RIGHT.x - (RIGHT.x - (VIEWPORT.x + VIEWPORT.w)) / 2;
  vline(ctx, gapL, LEFT.y, LEFT.h, p.line, 0.35);
  vline(ctx, gapR, RIGHT.y, RIGHT.h, p.line, 0.35);
  hline(ctx, TOP.x, TOP.y + TOP.h + 8, TOP.w, p.line, 0.35);
  hline(ctx, BOTTOM.x, BOTTOM.y - 9, BOTTOM.w, p.line, 0.35);

  // tick runs along the two long dividers
  for (let y = LEFT.y + 24; y < LEFT.y + LEFT.h; y += 46) {
    const long = ((y - LEFT.y) / 46) % 4 === 0;
    hline(ctx, gapL - (long ? 12 : 6), y, long ? 24 : 12, p.line, 0.5);
    hline(ctx, gapR - (long ? 12 : 6), y, long ? 24 : 12, p.line, 0.5);
  }
};

const drawViewport = (ctx: Ctx, p: Pal) => {
  const {x, y, w, h} = VIEWPORT;

  // faint graph grid behind the subject
  ctx.fillStyle = rgba(p.line, 0.055);
  for (let gx = x + 120; gx < x + w; gx += 120) ctx.fillRect(gx, y, 1, h);
  for (let gy = y + 120; gy < y + h; gy += 120) ctx.fillRect(x, gy, w, 1);

  ctx.fillStyle = rgba(p.line, 0.62);
  ctx.fillRect(x, y, w, BORDER);
  ctx.fillRect(x, y + h - BORDER, w, BORDER);
  ctx.fillRect(x, y, BORDER, h);
  ctx.fillRect(x + w - BORDER, y, BORDER, h);
  brackets(ctx, x, y, w, h, 96, p.accent, 1, 4);

  // rulers along the top and bottom inside edges
  for (let i = 0; i * 42 < w - 60; i++) {
    const tx = x + 30 + i * 42;
    const long = i % 5 === 0;
    ctx.fillStyle = rgba(p.line, long ? 0.75 : 0.4);
    ctx.fillRect(tx, y + 10, 2, long ? 22 : 11);
    ctx.fillRect(tx, y + h - 10 - (long ? 22 : 11), 2, long ? 22 : 11);
  }
  for (let i = 0; i * 42 < h - 60; i++) {
    const ty = y + 30 + i * 42;
    const long = i % 5 === 0;
    ctx.fillStyle = rgba(p.line, long ? 0.75 : 0.4);
    ctx.fillRect(x + 10, ty, long ? 22 : 11, 2);
    ctx.fillRect(x + w - 10 - (long ? 22 : 11), ty, long ? 22 : 11, 2);
  }

  // centre reticle
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.fillStyle = rgba(p.accent, 0.8);
  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]) {
    ctx.fillRect(cx + dx * 240 - (dx < 0 ? 60 : 0), cy + dy * 150 - 1, dx ? 60 : 2, dx ? 2 : 60);
    if (dy) ctx.fillRect(cx - 1, cy + dy * 150 - (dy < 0 ? 60 : 0), 2, 60);
  }

  // corner keys just inside the window
  ctx.fillStyle = rgba(p.line, 0.55);
  for (const [ox, oy, sx, sy] of [
    [x + 40, y + 40, 1, 1],
    [x + w - 40, y + 40, -1, 1],
    [x + 40, y + h - 40, 1, -1],
    [x + w - 40, y + h - 40, -1, -1],
  ]) {
    ctx.fillRect(sx > 0 ? ox : ox - 46, oy, 46, 2);
    ctx.fillRect(ox, sy > 0 ? oy : oy - 46, 2, 46);
  }
};

/**
 * The static frame: bracket corners, hairline dividers and the central
 * viewport window. Rasterised once into three offscreen layers and blitted,
 * so the only per-frame cost is the draw-on reveal.
 */
export const HudFrame: React.FC<{frame: number; palette: Palette}> = ({
  frame,
  palette,
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const p = useMemo(() => toPal(palette), [palette]);

  const layers = useMemo(() => {
    const mk = (fn: (c: Ctx) => void) => {
      const c = offscreen(W, H);
      fn(c.getContext('2d')!);
      return c;
    };
    return [
      {c: mk((ctx) => drawBrackets(ctx, p)), delay: 0, dur: 10},
      {c: mk((ctx) => drawDividers(ctx, p)), delay: 6, dur: 12},
      {c: mk((ctx) => drawViewport(ctx, p)), delay: 11, dur: 14},
    ];
  }, [p]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);
    for (const l of layers) {
      const a = reveal(frame, l.delay, l.dur);
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      ctx.drawImage(l.c, 0, 0);
    }
    ctx.globalAlpha = 1;
  }, [frame, layers]);

  return (
    <canvas
      ref={ref}
      width={W}
      height={H}
      style={{position: 'absolute', left: 0, top: 0, width: W, height: H}}
    />
  );
};
