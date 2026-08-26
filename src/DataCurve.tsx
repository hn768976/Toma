import React, { useLayoutEffect, useMemo, useRef } from 'react';
import { useCurrentFrame } from 'remotion';
import { ensureFont, FONT_FAMILY } from './font';
import { CONFIG, HEIGHT, WIDTH } from './config';
import { ctx2d, makeCanvas, PLANE } from './plane';
import { buildCurve, buildScene, layerMatrix } from './scene';
import { VARIANTS, type VariantId } from './variants';
import { bakeGridPlane, drawGridPlane } from './layers/GridPlane';
import { bakeCountryShape, drawCountryShape } from './layers/CountryShape';
import { drawDataCurve } from './layers/DataCurveLayer';
import { drawCounterStack, drawCountryLabel } from './layers/CounterStack';
import { bakeChartCards, drawChartCards } from './layers/ChartCards';
import { buildParticles, drawParticleField } from './layers/ParticleField';
import { bakeBackground, bakeGrain, drawGrain, drawVignette } from './layers/finish';

ensureFont();

export type DataCurveProps = { variant: VariantId };

/**
 * The whole scene is drawn into one canvas at 3840x2160.
 *
 * Depth of field is done with three buffers rather than per-element blurring,
 * which would be unusably slow at this resolution: far and mid render at half
 * scale and are blurred once each on the way back up, sharp renders at full
 * scale and is not blurred at all. A final radial pass softens the frame edges
 * so focus falls off away from the country and the curve.
 */
export const DataCurve: React.FC<DataCurveProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  const v = VARIANTS[variant];
  const R = CONFIG.bufferScale;

  const baked = useMemo(() => {
    const half = { w: Math.round(WIDTH * R), h: Math.round(HEIGHT * R) };
    return {
      grid: bakeGridPlane(variant, v),
      country: bakeCountryShape(v),
      cards: bakeChartCards(variant, v),
      particles: buildParticles(variant),
      curve: buildCurve(variant, v),
      background: bakeBackground(v),
      grain: bakeGrain(variant),
      far: makeCanvas(half.w, half.h),
      mid: makeCanvas(half.w, half.h),
      sharp: makeCanvas(WIDTH, HEIGHT),
      veil: makeCanvas(half.w, half.h),
      bloom: makeCanvas(half.w, half.h),
    };
  }, [variant, v, R]);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = ctx2d(canvas);
    const scene = buildScene(frame, variant, v);
    const P = CONFIG.parallax;
    const fam = FONT_FAMILY;

    const reset = (c: HTMLCanvasElement) => {
      const x = ctx2d(c);
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.clearRect(0, 0, c.width, c.height);
      return x;
    };
    const plane = (x: CanvasRenderingContext2D, depthFactor: number, res: number) => {
      const m = layerMatrix(scene, depthFactor, res);
      x.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
    };

    /* ── FAR ─────────────────────────────────────────────────────── */
    const far = reset(baked.far);
    plane(far, P.far, R);
    drawGridPlane(far, baked.grid, 0.4);
    drawChartCards(far, baked.cards, 'far');
    drawParticleField(far, scene, baked.particles, 'far');

    /* ── MID ─────────────────────────────────────────────────────── */
    const mid = reset(baked.mid);
    plane(mid, P.mid, R);
    drawChartCards(mid, baked.cards, 'mid');
    drawParticleField(mid, scene, baked.particles, 'mid');

    /* ── SHARP ───────────────────────────────────────────────────── */
    const sh = reset(baked.sharp);
    plane(sh, P.sharp, 1);
    drawGridPlane(sh, baked.grid, 1);
    drawCountryShape(sh, baked.country);
    drawCountryLabel(sh, scene, fam);
    drawCounterStack(sh, scene, fam);
    drawDataCurve(sh, scene, baked.curve, fam);
    plane(sh, P.near, 1);
    drawParticleField(sh, scene, baked.particles, 'sharp');

    /* ── composite ───────────────────────────────────────────────── */
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.drawImage(baked.background, 0, 0);

    ctx.filter = `blur(${CONFIG.blurFar * R}px)`;
    ctx.drawImage(baked.far, 0, 0, WIDTH, HEIGHT);
    ctx.filter = `blur(${CONFIG.blurMid * R}px)`;
    ctx.drawImage(baked.mid, 0, 0, WIDTH, HEIGHT);
    ctx.filter = 'none';
    ctx.drawImage(baked.sharp, 0, 0);

    /* ── bloom on the curve, nodes and the brightest counters ────── */
    const bl = reset(baked.bloom);
    bl.filter = `blur(${CONFIG.bloomBlur * R}px)`;
    bl.drawImage(baked.sharp, 0, 0, baked.bloom.width, baked.bloom.height);
    bl.filter = 'none';
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = CONFIG.bloomAmount;
    ctx.drawImage(baked.bloom, 0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    /* ── radial focus falloff toward the frame edges ─────────────── */
    // Focus is held over the country and the curve and falls away toward every
    // edge. Built as one heavily blurred copy of the composite, masked by an
    // elliptical gradient, then laid back on top.
    const veil = reset(baked.veil);
    const vw = baked.veil.width;
    const vh = baked.veil.height;
    veil.filter = `blur(${CONFIG.blurCeiling * R}px)`;
    veil.drawImage(canvas, 0, 0, vw, vh);
    veil.filter = 'none';

    const cxv = vw * 0.44;
    const cyv = vh * 0.48;
    const rx = vw * CONFIG.focusRadiusX;
    const ry = vh * CONFIG.focusRadiusY;
    veil.save();
    veil.translate(cxv, cyv);
    veil.scale(1, ry / rx);
    const g = veil.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(CONFIG.focusFalloffStart, 'rgba(0,0,0,0)');
    g.addColorStop(CONFIG.focusFalloffEnd, 'rgba(0,0,0,0.94)');
    g.addColorStop(1, 'rgba(0,0,0,1)');
    veil.globalCompositeOperation = 'destination-in';
    veil.fillStyle = g;
    // The gradient is drawn in the squashed space, so cover generously.
    veil.fillRect(-vw * 2, -vh * 3, vw * 4, vh * 6);
    veil.restore();
    veil.globalCompositeOperation = 'source-over';
    ctx.drawImage(baked.veil, 0, 0, WIDTH, HEIGHT);

    drawVignette(ctx, v);
    drawGrain(ctx, baked.grain, frame);
  });

  return (
    <canvas
      ref={ref}
      width={WIDTH}
      height={HEIGHT}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
};

/** Exported for tooling that wants the plane extent without importing plane.ts. */
export const PLANE_EXTENT = PLANE;
