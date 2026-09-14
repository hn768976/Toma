import React, {useLayoutEffect, useRef} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {getBands} from './bands';
import type {Colourway} from './colourways';
import {glyphCells} from './glyphs';
import {hash, hashInt, hashRange} from './hash';

/**
 * The failing-display field: horizontal glitch bands, digital noise, scattered
 * digits and corner blooms, on a canvas.
 *
 * Two instances run - one under the map, one over it - so the map sits inside
 * the glitch rather than on top of it. Everything is a pure function of
 * (x, y, frame); nothing is carried between frames.
 */

type Props = {
  readonly colourway: Colourway;
  readonly layer: 'under' | 'over';
};

/** Noise is generated at 1/4 scale and blown up, which also coarsens the speckle. */
const NOISE_DIVISOR = 4;

const drawField = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frame: number,
  colourway: Colourway,
  layer: 'under' | 'over',
) => {
  const over = layer === 'over';
  ctx.clearRect(0, 0, width, height);

  if (!over) {
    ctx.fillStyle = colourway.background;
    ctx.fillRect(0, 0, width, height);

    // Soft blooms upper-left and upper-right, where the field is brightest.
    ctx.globalCompositeOperation = 'lighter';
    for (const [cx, cy, strength] of [
      [0.14 * width, 0.1 * height, 0.85],
      [0.86 * width, 0.16 * height, 0.62],
    ] as const) {
      const breathe = 0.78 + 0.22 * Math.sin(frame * 0.037 + cx);
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, width * 0.46);
      gradient.addColorStop(0, colourway.bloom);
      gradient.addColorStop(1, 'transparent');
      ctx.globalAlpha = strength * 0.4 * breathe;
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.globalAlpha = 1;

    // The broad smear of faint horizontal lines that underlies everything.
    const lines = Math.round(height / 9);
    for (let i = 0; i < lines; i++) {
      const y = (i / lines) * height;
      const row = Math.round(y);
      const persistence = hash(row, Math.floor(frame / 6), 21);
      const flicker = hash(row, frame, 22);
      const alpha = Math.pow(persistence, 3) * 0.34 + flicker * 0.05;
      if (alpha < 0.02) continue;
      // Brightest through the upper-middle of the frame, as in the reference.
      const vertical = 1 - Math.abs(y / height - 0.36) * 1.5;
      ctx.globalAlpha = Math.max(0, alpha * vertical);
      ctx.fillStyle = persistence > 0.86 ? colourway.bandHot : colourway.bandCool;
      const x0 = hashRange(-0.1, 0.7, row, Math.floor(frame / 6), 23) * width;
      const runWidth = hashRange(0.05, 0.75, row, Math.floor(frame / 6), 24) * width;
      ctx.fillRect(x0, y, runWidth, Math.max(1, height / lines - 3));
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // Bands: runs of torn pixels, some persisting for several frames, some
  // flashing for one.
  const bands = getBands(frame).filter((b) => (over ? b.slot % 3 === 0 : b.slot % 3 !== 0));
  ctx.globalCompositeOperation = 'lighter';
  for (const band of bands) {
    const y = band.y * height;
    const h = Math.max(1, band.h * height);
    const colour = band.hot ? colourway.bandHot : colourway.bandCool;
    const opacityScale = over ? 0.55 : 1;

    ctx.fillStyle = colour;
    ctx.globalAlpha = band.intensity * 0.07 * opacityScale;
    ctx.fillRect(0, y, width, h);

    // The band is brightest over part of its run and fades out along it,
    // rather than reading as an even bar across the frame.
    const focus = hash(band.seed, 36);
    const reach = hashRange(0.25, 0.9, band.seed, 37);
    const envelope = (x: number) =>
      Math.max(0, 1 - Math.abs(x / width - focus) / reach);

    // Torn runs, walking across the frame in uneven steps.
    const shift = band.shift * width;
    let x = -hashRange(0, 0.2, band.seed, 38) * width;
    let step = 0;
    while (x < width && step < 90) {
      const run = hashRange(0.006, 0.16, band.seed, step, 33) * width;
      if (hash(band.seed, step, 32) < 0.72) {
        const pieces = hashInt(1, 3, band.seed, step, 39);
        for (let p = 0; p < pieces; p++) {
          const top = hashRange(0, 0.7, band.seed, step * 7 + p, 34) * h;
          const tall = Math.max(1, hashRange(0.18, 1, band.seed, step * 7 + p, 40) * (h - top));
          ctx.globalAlpha =
            band.intensity *
            envelope(x) *
            hashRange(0.18, 1, band.seed, step * 7 + p, 35) *
            opacityScale;
          ctx.fillRect(x + shift, y + top, run, tall);
        }
      }
      x += run + hashRange(0.001, 0.05, band.seed, step, 41) * width;
      step++;
    }

    // A faint chromatic split on the band edges.
    if (band.intensity > 0.6) {
      const split = Math.max(2, Math.abs(band.shift) * width * 0.6 + width * 0.001);
      const edge = Math.max(1, h * 0.12);
      const runStart = (focus - reach) * width;
      const runWidth = reach * 2 * width;
      ctx.globalAlpha = band.intensity * 0.18 * opacityScale;
      ctx.fillStyle = '#ff3030';
      ctx.fillRect(runStart - split, y, runWidth, edge);
      ctx.fillStyle = '#3070ff';
      ctx.fillRect(runStart + split, y + h - edge, runWidth, edge);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // Fine speckle across the frame, denser inside the bands.
  const nw = Math.ceil(width / NOISE_DIVISOR);
  const nh = Math.ceil(height / NOISE_DIVISOR);
  const image = ctx.createImageData(nw, nh);
  const data = image.data;
  const rowBoost = new Float32Array(nh);
  for (const band of bands) {
    const y0 = Math.max(0, Math.floor((band.y * height) / NOISE_DIVISOR));
    const y1 = Math.min(nh, Math.ceil(((band.y + band.h) * height) / NOISE_DIVISOR));
    for (let ny = y0; ny < y1; ny++) rowBoost[ny] = Math.max(rowBoost[ny], band.intensity);
  }
  const parse = (hex: string): [number, number, number] => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const [cr, cg, cb] = parse(colourway.bandCool);
  const [hr, hg, hb] = parse(colourway.bandHot);
  const baseDensity = over ? 0.018 : 0.05;
  for (let ny = 0; ny < nh; ny++) {
    const boost = rowBoost[ny];
    // Thinner towards the top and bottom of the frame, as in the reference,
    // where the speckle gathers around the bright upper-middle smear.
    const t = (ny / nh - 0.36) / 0.34;
    const profile = 0.4 + 0.85 * Math.exp(-t * t);
    const density = baseDensity * profile + boost * 0.42;
    const rowOffset = ny * nw * 4;
    for (let nx = 0; nx < nw; nx++) {
      const r = hash(nx, ny, frame * 7919);
      if (r > density) continue;
      const i = rowOffset + nx * 4;
      const warm = hash(nx, ny, frame * 31 + 5) > 0.72;
      data[i] = warm ? hr : cr;
      data[i + 1] = warm ? hg : cg;
      data[i + 2] = warm ? hb : cb;
      data[i + 3] = Math.round((0.25 + boost * 0.7) * 255 * (r / density));
    }
  }
  const noiseCanvas = new OffscreenCanvas(nw, nh);
  const noiseCtx = noiseCanvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
  noiseCtx.putImageData(image, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(noiseCanvas, 0, 0, width, height);

  // Small illegible numerals, appearing and vanishing.
  const digitCount = over ? 10 : 26;
  const cell = Math.max(1, Math.round(height / 440));
  for (let i = 0; i < digitCount; i++) {
    const life = hashInt(4, 26, i, 41);
    const epoch = Math.floor((frame + hashInt(0, 40, i, 42)) / life);
    if (hash(i, epoch, 43) > 0.55) continue;
    const x = hash(i, epoch, 44) * width;
    const y = hash(i, epoch, 45) * height;
    const digit = String(hashInt(0, 9, i, epoch));
    ctx.globalAlpha = hashRange(0.08, 0.4, i, epoch, 46);
    ctx.fillStyle = hash(i, epoch, 47) > 0.7 ? colourway.bandHot : colourway.bandCool;
    for (const c of glyphCells(digit)) ctx.fillRect(x + c.x * cell, y + c.y * cell, cell, cell);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
};

export const GlitchField: React.FC<Props> = ({colourway, layer}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);

  // useLayoutEffect, not useEffect: the canvas has to carry its pixels before
  // the browser paints the frame Remotion is about to capture.
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawField(ctx, width, height, frame, colourway, layer);
  }, [frame, width, height, colourway, layer]);

  return (
    <AbsoluteFill>
      <canvas ref={ref} width={width} height={height} style={{width: '100%', height: '100%'}} />
    </AbsoluteFill>
  );
};
