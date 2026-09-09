import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import {
  ARCS,
  blurRadiusAt,
  brightnessAt,
  bucketCenterT,
  CENTER_X,
  CENTER_Y,
  dotRadiusAt,
  DURATION,
  FOCUS_T,
  N_BUCKETS,
  opacityAt,
  resolveColors,
} from './layout';
import type { Palette } from './palettes';
import { getSprites } from './sprites';
import { clamp } from './rng';

const TAU = Math.PI * 2;

const rgbStr = (rgb: [number, number, number], mul: number) =>
  `rgb(${Math.round(rgb[0] * mul)},${Math.round(rgb[1] * mul)},${Math.round(
    rgb[2] * mul,
  )})`;

const paintBackground = (
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  w: number,
  h: number,
) => {
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, w, h);

  // Glow bleeding in from beyond the upper-right corner.
  const gx = w * 1.02;
  const gy = h * 0.02;
  const gr = h * 1.6;
  const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
  const [r, gg, b] = palette.glow;
  for (let i = 0; i <= 12; i++) {
    const s = i / 12;
    const a = palette.glowStrength * Math.pow(1 - s, 2.4);
    g.addColorStop(s, `rgba(${r},${gg},${b},${a.toFixed(4)})`);
  }
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
};

const paintVignette = (
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
) => {
  // Pulled toward the upper right so the glow corner stays clean.
  const cx = w * 0.72;
  const cy = h * 0.26;
  const r1 = Math.hypot(w, h) * 0.86;
  const g = ctx.createRadialGradient(cx, cy, r1 * 0.34, cx, cy, r1);
  for (let i = 0; i <= 10; i++) {
    const s = i / 10;
    const a = 0.55 * Math.pow(s, 1.8);
    g.addColorStop(s, `rgba(0,0,0,${a.toFixed(4)})`);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
};

type Props = {
  palette: Palette;
};

export const DotArcs: React.FC<Props> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);

  const colors = useMemo(
    () => resolveColors(palette.accentWeights, palette.accentAmount),
    [palette],
  );

  // Colour strings for the sharp band, with the layer brightness baked in.
  const sharpFills = useMemo(() => {
    const out: string[][] = [];
    for (let b = 0; b < N_BUCKETS; b++) {
      const mul = brightnessAt(bucketCenterT(b));
      out.push(palette.dots.map((c) => rgbStr(c, mul)));
    }
    return out;
  }, [palette]);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    // Backing store follows the real device pixels, so --scale=0.5 renders a
    // 1920x1080 canvas and every size/blur (all fractions of frame height)
    // scales with it.
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const backingW = Math.max(
      2,
      Math.round((rect.width > 1 ? rect.width : width) * dpr),
    );
    const pxScale = backingW / width;
    const backingH = Math.max(2, Math.round(height * pxScale));
    if (canvas.width !== backingW || canvas.height !== backingH) {
      canvas.width = backingW;
      canvas.height = backingH;
    }

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const H = height;
    const W = width;
    const sprites = getSprites(palette, backingH);

    ctx.setTransform(pxScale, 0, 0, pxScale, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    paintBackground(ctx, palette, W, H);

    // Phase is taken modulo the loop, so frame 300 is bit-identical to frame 0
    // rather than merely equal to within floating-point drift.
    const p = (((frame % DURATION) + DURATION) % DURATION) / DURATION;
    const wp = TAU * p;

    // A whole-field drift that returns exactly to its start.
    const driftX = 0.011 * H * Math.sin(wp);
    const driftY = 0.008 * H * Math.sin(wp + 1.7);
    const driftRot = 0.0035 * Math.sin(wp + 0.6);

    const cx = CENTER_X * H + driftX;
    const cy = CENTER_Y * H + driftY;

    // Back to front: far arcs first, near bokeh composited last so it lies over
    // the sharp band at low opacity.
    for (let b = 0; b < N_BUCKETS; b++) {
      const isSharp = sprites.sharp[b];
      for (let ai = 0; ai < ARCS.length; ai++) {
        const arc = ARCS[ai];
        if (arc.bucket !== b) continue;

        const t = arc.t;
        const dotR = dotRadiusAt(t) * H;
        const blurR = blurRadiusAt(t) * H;
        const layerAlpha = opacityAt(t);
        const bloomable = Math.abs(t - FOCUS_T) < 0.1;
        const arcColors = colors[ai];
        const margin = dotR * 1.7 + blurR + 4;
        const rot = arc.m * arc.dTheta * p + driftRot;
        const period = arc.period;

        for (let k = 0; k < arc.K; k++) {
          const j = k % period;
          if (arc.present[j] === 0) continue;
          const th =
            arc.phase0 + (k + arc.angJit[j]) * arc.dTheta + rot;
          const rad = (arc.radius + arc.radJit[j] * arc.gap) * H;
          const x = cx + rad * Math.cos(th);
          if (x < -margin || x > W + margin) continue;
          const y = cy + rad * Math.sin(th);
          if (y < -margin || y > H + margin) continue;

          const shim =
            arc.shimAmp[j] === 0
              ? 1
              : 1 +
                arc.shimAmp[j] *
                  Math.sin(TAU * arc.shimRate[j] * p + arc.shimPhase[j]);
          const lum = arc.bright[j] * shim;
          const alpha = clamp(layerAlpha * lum, 0, 1);
          const ci = arcColors[j];

          if (isSharp) {
            ctx.globalAlpha = alpha;
            ctx.fillStyle = sharpFills[b][ci];
            ctx.beginPath();
            ctx.arc(x, y, dotR * arc.sizeMul[j], 0, TAU);
            ctx.fill();
            if (bloomable && lum > 1.02) {
              const br = sprites.bloomRadiusPx / pxScale;
              ctx.globalCompositeOperation = 'lighter';
              ctx.globalAlpha = clamp((lum - 1.02) * 1.1, 0, 0.2);
              ctx.drawImage(
                sprites.bloom[ci],
                x - br,
                y - br,
                br * 2,
                br * 2,
              );
              ctx.globalCompositeOperation = 'source-over';
            }
          } else {
            const R = dotR * arc.sizeMul[j] + blurR;
            ctx.globalAlpha = alpha;
            ctx.drawImage(
              sprites.disc[b][ci],
              x - R,
              y - R,
              R * 2,
              R * 2,
            );
          }
        }
      }
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    paintVignette(ctx, W, H);

    // Grain last, at device resolution: 6 tiles cycled so frame 300 == frame 0.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const tile = sprites.grain[frame % sprites.grain.length];
    const pat = ctx.createPattern(tile, 'repeat');
    if (pat) {
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, backingW, backingH);
    }
  }, [frame, width, height, palette, colors, sharpFills]);

  return (
    <canvas
      ref={ref}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
};
