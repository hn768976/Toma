import React, {useEffect, useRef} from 'react';
import type {Filament, Scene, Vec} from '../geometry';
import {cubicAt} from '../geometry';
import type {CurvePts} from '../geometry';
import type {VariantConfig} from '../variants';
import {DUR, extensionAt, fract, lsin} from '../motion';
import {mix} from '../color';

const SAMPLES = 24;

/** Apply the per-frame undulation offsets to a filament's control points. */
const driftedCurve = (f: Filament, t01: number, amp: number, offset: Vec): CurvePts => {
  const a = f.depth === 0 ? amp : amp * 0.6;
  const o1 = a * 0.25 * lsin(t01, f.driftFreq[0], f.driftPhase[0]);
  const o2 = a * 0.7 * lsin(t01, f.driftFreq[1], f.driftPhase[1]);
  const o3 = a * lsin(t01, f.driftFreq[2], f.driftPhase[2]);
  const {curve, perp} = f;
  return {
    p0: {x: curve.p0.x + offset.x, y: curve.p0.y + offset.y},
    c1: {x: curve.c1.x + perp.x * o1 + offset.x, y: curve.c1.y + perp.y * o1 + offset.y},
    c2: {x: curve.c2.x + perp.x * o2 + offset.x, y: curve.c2.y + perp.y * o2 + offset.y},
    p3: {x: curve.p3.x + perp.x * o3 + offset.x, y: curve.p3.y + perp.y * o3 + offset.y},
  };
};

const drawFilament = (
  ctx: CanvasRenderingContext2D,
  f: Filament,
  ext: number,
  offset: Vec,
  cfg: VariantConfig,
  t01: number
): void => {
  if (ext <= 0.03) {
    return;
  }
  const {palette} = cfg;
  const drifted = driftedCurve(f, t01, cfg.filament.driftAmp, offset);

  const nSeg = Math.max(3, Math.ceil(SAMPLES * ext));
  const pts: Vec[] = [];
  for (let i = 0; i <= nSeg; i++) {
    pts.push(cubicAt(drifted, (ext * i) / nSeg));
  }

  let flashVal = 0;
  if (f.flash) {
    const ph = fract(t01 * f.flashFreq + f.flashPhase);
    const framesFromPeak = (ph - 0.5) * (DUR / f.flashFreq);
    flashVal = Math.exp(-((framesFromPeak / 5) ** 2));
  }

  for (let i = 0; i < nSeg; i++) {
    // Taper relative to the visible length so the tip always dissolves
    const u = (i + 1) / nSeg;
    const w = f.width * Math.pow(1 - u, 1.15) + 0.3;
    const a = f.alpha * cfg.filamentAlphaScale * Math.pow(1 - u, 1.05);
    if (a < 0.004) {
      continue;
    }
    const col = Math.min(1, u * 1.7);

    ctx.beginPath();
    ctx.moveTo(pts[i].x, pts[i].y);
    ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
    // Faint bloom pass under the main stroke
    ctx.strokeStyle = mix(palette.filamentPale, palette.filament, col, a * 0.13);
    ctx.lineWidth = w * 2.8;
    ctx.stroke();
    ctx.strokeStyle = mix(palette.filamentPale, palette.filament, col, a);
    ctx.lineWidth = w;
    ctx.stroke();

    if (flashVal > 0.03 && u > 0.68) {
      ctx.strokeStyle = mix(palette.nodeWhite, palette.filamentPale, 0.3, flashVal * 0.65 * ((u - 0.68) / 0.32));
      ctx.lineWidth = w * 1.5;
      ctx.stroke();
    }
  }

  for (const child of f.children) {
    if (ext <= child.branchT + 0.02) {
      continue;
    }
    const childExt = Math.min(1, (ext - child.branchT) / (1 - child.branchT));
    // The branch base rides the parent's drifted curve
    const attach = cubicAt(drifted, child.branchT);
    const staticAttach = cubicAt(f.curve, child.branchT);
    drawFilament(
      ctx,
      child,
      childExt,
      {x: offset.x + attach.x - staticAttach.x, y: offset.y + attach.y - staticAttach.y},
      cfg,
      t01
    );
  }
};

/** All free (non-connecting) dendrite trees, every node, one canvas. */
export const FilamentBundle: React.FC<{
  scene: Scene;
  cfg: VariantConfig;
  frame: number;
  width: number;
  height: number;
}> = ({scene, cfg, frame, width, height}) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    const t01 = frame / DUR;
    const ext = extensionAt(frame, cfg);
    const zero = {x: 0, y: 0};
    for (const nodeFilaments of scene.filaments) {
      for (const f of nodeFilaments) {
        drawFilament(ctx, f, ext, zero, cfg, t01);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }, [scene, cfg, frame, width, height]);

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{position: 'absolute', top: 0, left: 0, width: '100%', height: '100%'}}
    />
  );
};
