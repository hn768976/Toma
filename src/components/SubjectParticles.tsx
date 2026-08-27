import React, {useEffect, useMemo, useRef} from 'react';
import {DURATION, STAGE, T_ASSEMBLE_END, T_ASSEMBLE_START} from '../lib/layout';
import type {Rect} from '../lib/layout';
import {buildField, sampleParticles} from '../lib/silhouette';
import type {ParticleSet} from '../lib/silhouette';
import {ramp} from '../lib/color';
import {clamp01, easeOut} from '../lib/rand';
import {clusterPulse, sweepBoost, sweepPos} from './ScanSweep';
import type {Bounds} from './ScanSweep';
import type {Variant} from '../variants';

const LEVELS = 22;
const BLOOM_DIV = 4;

export type SubjectData = {
  particles: ParticleSet;
  bounds: Bounds;
};

/**
 * Builds the particle field for a variant. Sampled ONCE (seeded) and reused for
 * every frame of the render.
 */
export const useSubject = (variant: Variant, key: string): SubjectData =>
  useMemo(() => {
    const field = buildField(variant.silhouette, STAGE);
    const particles = sampleParticles(
      variant.silhouette,
      variant.density,
      field,
      `subject:${key}`,
    );
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < particles.n; i++) {
      if (particles.x[i] < x0) x0 = particles.x[i];
      if (particles.x[i] > x1) x1 = particles.x[i];
      if (particles.y[i] < y0) y0 = particles.y[i];
      if (particles.y[i] > y1) y1 = particles.y[i];
    }
    return {particles, bounds: {x0, y0, x1, y1}};
  }, [variant, key]);

export const SubjectParticles: React.FC<{
  frame: number;
  variant: Variant;
  subject: SubjectData;
  /** extra per-particle brightness supplied by the propagate mode */
  boost: Float32Array | null;
  width: number;
  height: number;
  drift: [number, number];
  clip: Rect;
}> = ({frame, variant, subject, boost, width, height, drift, clip}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const bloomRef = useRef<HTMLCanvasElement | null>(null);

  const cool = useMemo(() => ramp(variant.palette.particle, LEVELS), [variant]);
  const hot = useMemo(() => ramp(variant.palette.particleHot, LEVELS), [variant]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.beginPath();
    ctx.rect(clip.x, clip.y, clip.w, clip.h);
    ctx.clip();

    const f = frame % DURATION;
    const asm = easeOut(
      (f - T_ASSEMBLE_START) / (T_ASSEMBLE_END - T_ASSEMBLE_START),
    );
    if (asm <= 0) {
      ctx.restore();
      return;
    }

    if (!bloomRef.current) {
      const b = document.createElement('canvas');
      b.width = Math.ceil(width / BLOOM_DIV);
      b.height = Math.ceil(height / BLOOM_DIV);
      bloomRef.current = b;
    }
    const bl = bloomRef.current;
    const bctx = bl.getContext('2d')!;
    bctx.clearRect(0, 0, bl.width, bl.height);

    const p = subject.particles;
    const m = variant.motion;
    const pos = sweepPos(f, m);
    const cpulse = clusterPulse(f, m);
    const [dx, dy] = drift;

    // bucket particles by colour + quantised alpha so fillStyle changes 44x
    // per frame instead of 5000x
    const buckets: number[][] = [];
    for (let i = 0; i < LEVELS * 2; i++) buckets.push([]);

    const xs = new Float32Array(p.n);
    const ys = new Float32Array(p.n);

    for (let i = 0; i < p.n; i++) {
      const x = p.sx[i] + (p.x[i] - p.sx[i]) * asm + dx;
      const y = p.sy[i] + (p.y[i] - p.sy[i]) * asm + dy;
      xs[i] = x;
      ys[i] = y;

      const tw =
        0.7 + 0.3 * Math.sin((f / p.twP[i]) * Math.PI * 2 + p.twPh[i]);
      let b = p.bright[i] * tw;
      if (cpulse !== 0 && p.pulse[i] > 0) b *= 1 + cpulse * p.pulse[i];
      b += sweepBoost(p.axis[i], pos, m) * (0.25 + 0.75 * p.bright[i]);
      const pb = boost ? boost[i] : 0;
      b += pb;
      b *= asm;

      const lv = Math.min(LEVELS - 1, Math.floor(clamp01(b) * LEVELS));
      if (lv <= 0) continue;
      // a particle a pulse has just reached burns white, whatever it was
      const isHot = p.hot[i] > 0 || pb > 0.3;
      buckets[isHot ? LEVELS + lv : lv].push(i);
    }

    const bs = 1 / BLOOM_DIV;
    for (let k = 0; k < buckets.length; k++) {
      const list = buckets[k];
      if (list.length === 0) continue;
      const isHot = k >= LEVELS;
      const lv = isHot ? k - LEVELS : k;
      ctx.fillStyle = (isHot ? hot : cool)[lv];
      for (let j = 0; j < list.length; j++) {
        const i = list[j];
        const s = p.size[i];
        ctx.fillRect(xs[i] - s / 2, ys[i] - s / 2, s, s);
      }
      if (lv > LEVELS * 0.55) {
        bctx.fillStyle = (isHot ? hot : cool)[lv];
        for (let j = 0; j < list.length; j++) {
          const i = list[j];
          const s = Math.max(1, p.size[i] * bs);
          bctx.fillRect(xs[i] * bs - s / 2, ys[i] * bs - s / 2, s, s);
        }
      }
    }

    // bloom
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.6;
    ctx.filter = 'blur(9px)';
    ctx.drawImage(bl, 0, 0, width, height);
    ctx.globalAlpha = 0.3;
    ctx.filter = 'blur(28px)';
    ctx.drawImage(bl, 0, 0, width, height);
    ctx.restore();
    ctx.filter = 'none';
    ctx.restore();
  }, [frame, variant, subject, boost, width, height, drift, clip, cool, hot]);

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{position: 'absolute', left: 0, top: 0, width, height}}
    />
  );
};
