import React, {useLayoutEffect, useMemo} from 'react';
import {rgba} from '../lib/color';
import {rnd, rndInt, rndRange, rndSigned} from '../lib/rng';
import {CANVAS_H, CANVAS_W} from '../lib/space';
import {LOOP, useLoopFrame} from '../lib/timing';
import type {BackgroundMode, Palette} from '../variants';

type Props = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  palette: Palette;
  mode: BackgroundMode;
  seed: string;
};

const CIRCUIT_COUNT = 210;

/** Illegible "data": digits and hex-ish symbols in a font that always resolves. */
const GLYPHS = '0123456789ABCDEF/\\|<>{}[]#$%&*+=~:;.-_^';
const TEXT_ROWS = 30;
// One tile spans the whole frame, so the row never visibly repeats within it.
const TEXT_TILE_W = CANVAS_W;
const TEXT_TILE_H = 44;
const TEXT_CHAR = 26;

type TextRow = {
  tile: HTMLCanvasElement;
  y: number;
  /** Whole tile-widths travelled per loop, so the scroll wraps seamlessly. */
  laps: number;
  alpha: number;
  offset: number;
};

const buildText = (seed: string, color: string): TextRow[] => {
  const rows: TextRow[] = [];
  for (let i = 0; i < TEXT_ROWS; i++) {
    const s = `${seed}:text:${i}`;
    const cv = document.createElement('canvas');
    cv.width = TEXT_TILE_W;
    cv.height = TEXT_TILE_H;
    const tctx = cv.getContext('2d');
    if (!tctx) continue;
    tctx.font = `${TEXT_CHAR}px monospace`;
    tctx.textBaseline = 'middle';
    tctx.fillStyle = color;
    const step = TEXT_CHAR * 0.78;
    for (let c = 0; c * step < TEXT_TILE_W; c++) {
      if (rnd(`${s}:gap${c}`) < 0.18) continue;
      const g = GLYPHS[rndInt(`${s}:g${c}`, GLYPHS.length)];
      tctx.globalAlpha = rndRange(`${s}:a${c}`, 0.35, 1);
      tctx.fillText(g, c * step, TEXT_TILE_H / 2);
    }
    rows.push({
      tile: cv,
      y: (i + rnd(`${s}:jy`) * 0.6) * (CANVAS_H / TEXT_ROWS),
      laps: rnd(`${s}:lap`) < 0.75 ? 1 : 2,
      alpha: rndRange(`${s}:al`, 0.07, 0.21),
      offset: rnd(`${s}:of`) * TEXT_TILE_W,
    });
  }
  return rows;
};

/** Rows of characters flowing right, the same way the data streams run. */
const drawText = (
  ctx: CanvasRenderingContext2D,
  rows: TextRow[],
  frame: number,
) => {
  ctx.save();
  for (const row of rows) {
    const shift =
      (row.offset + (frame / LOOP) * row.laps * TEXT_TILE_W) % TEXT_TILE_W;
    ctx.globalAlpha = row.alpha;
    for (let x = shift - TEXT_TILE_W; x < CANVAS_W; x += TEXT_TILE_W) {
      ctx.drawImage(row.tile, x, row.y);
    }
  }
  ctx.restore();
};

type Fragment = {
  x: number;
  y: number;
  /** Elliptical meander: seamless over the loop, no wrapping seams. */
  ax: number;
  ay: number;
  phase: number;
  period: number;
  periodY: number;
  phaseY: number;
  alpha: number;
  kind: 0 | 1 | 2;
  a: number;
  b: number;
  dir: number;
  width: number;
};

const buildCircuit = (seed: string): Fragment[] => {
  const out: Fragment[] = [];
  for (let i = 0; i < CIRCUIT_COUNT; i++) {
    const s = `${seed}:circuit:${i}`;
    out.push({
      x: rnd(`${s}:x`) * CANVAS_W,
      y: rnd(`${s}:y`) * CANVAS_H,
      ax: rndRange(`${s}:ax`, 30, 130),
      ay: rndRange(`${s}:ay`, 20, 90),
      phase: rnd(`${s}:ph`),
      period: LOOP / (rndInt(`${s}:pr`, 2) + 1),
      periodY: LOOP / (rndInt(`${s}:pry`, 3) + 1),
      phaseY: rnd(`${s}:phy`),
      alpha: rndRange(`${s}:al`, 0.07, 0.36),
      kind: rndInt(`${s}:k`, 3) as 0 | 1 | 2,
      a: rndRange(`${s}:a`, 28, 200),
      b: rndRange(`${s}:b`, 22, 150),
      dir: rndSigned(`${s}:d`, 1) > 0 ? 1 : -1,
      width: rndRange(`${s}:w`, 2, 4),
    });
  }
  return out;
};

const drawCircuit = (
  ctx: CanvasRenderingContext2D,
  frags: Fragment[],
  color: string,
  frame: number,
) => {
  ctx.save();
  ctx.lineCap = 'square';
  for (const f of frags) {
    const t = (frame / f.period + f.phase) * Math.PI * 2;
    const x = f.x + Math.cos(t) * f.ax;
    const ty = (frame / f.periodY + f.phaseY) * Math.PI * 2;
    const y = f.y + Math.sin(ty) * f.ay;
    ctx.strokeStyle = rgba(color, f.alpha);
    ctx.fillStyle = rgba(color, f.alpha * 0.8);
    ctx.lineWidth = f.width;
    ctx.beginPath();
    if (f.kind === 0) {
      // right-angle trace fragment
      ctx.moveTo(x, y);
      ctx.lineTo(x + f.a, y);
      ctx.lineTo(x + f.a, y + f.b * f.dir);
      ctx.stroke();
    } else if (f.kind === 1) {
      // a bare run, sometimes vertical
      ctx.moveTo(x, y);
      if (f.dir > 0) ctx.lineTo(x + f.a, y);
      else ctx.lineTo(x, y + f.a);
      ctx.stroke();
    } else {
      // small rectangle / pad
      ctx.strokeRect(x, y, f.a * 0.35, f.b * 0.35);
      if (f.alpha > 0.26) ctx.fillRect(x + 6, y + 6, f.a * 0.35 - 12, f.b * 0.35 - 12);
    }
  }
  ctx.restore();
};

export const BackgroundLayer: React.FC<Props> = ({canvasRef, palette, mode, seed}) => {
  const frame = useLoopFrame();
  const circuit = useMemo(
    () => (mode === 'circuit' ? buildCircuit(seed) : []),
    [mode, seed],
  );
  const text = useMemo(
    () => (mode === 'text' ? buildText(seed, palette.accent) : []),
    [mode, seed, palette.accent],
  );

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = palette.bgDeep;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Two soft glows: upper-left and centre. Both breathe over the full loop.
    const pulse = 1 + 0.05 * Math.sin((2 * Math.PI * frame) / LOOP);
    const glows: [number, number, number, number][] = [
      [CANVAS_W * 0.16, CANVAS_H * 0.2, CANVAS_W * 0.46 * pulse, 0.55],
      [CANVAS_W * 0.5, CANVAS_H * 0.56, CANVAS_W * 0.4 * (2 - pulse), 0.4],
    ];
    ctx.globalCompositeOperation = 'lighter';
    for (const [gx, gy, gr, ga] of glows) {
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      g.addColorStop(0, rgba(palette.bgGlow, ga));
      g.addColorStop(0.5, rgba(palette.bgGlow, ga * 0.28));
      g.addColorStop(1, rgba(palette.bgGlow, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }
    ctx.globalCompositeOperation = 'source-over';

    if (mode === 'circuit') {
      drawCircuit(ctx, circuit, palette.accent, frame);
    } else if (mode === 'text') {
      drawText(ctx, text, frame);
    }
  }, [canvasRef, palette, mode, circuit, text, frame]);

  return null;
};
