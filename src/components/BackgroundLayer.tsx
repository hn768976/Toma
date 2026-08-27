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
    }
  }, [canvasRef, palette, mode, circuit, frame]);

  return null;
};
