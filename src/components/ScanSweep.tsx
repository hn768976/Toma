import React, {useEffect, useRef} from 'react';
import {DURATION} from '../lib/layout';
import type {Rect} from '../lib/layout';
import {rgb, rgba} from '../lib/color';
import type {Motion, Palette} from '../variants';

export type Bounds = {x0: number; y0: number; x1: number; y1: number};

/**
 * Position of the sweep along its axis, in the same 0..1 space as a particle's
 * `axis` coordinate. Extended slightly past both ends so the band enters and
 * leaves the subject cleanly. Pure function of frame % 600.
 */
export const sweepPos = (f: number, m: Motion): number => {
  if (m.mode !== 'sweep') return -9;
  const t = (f % m.period) / m.period;
  return -m.trail + t * (1 + m.trail + m.band * 2);
};

/** How much a particle at `a` along the axis is brightened right now. */
export const sweepBoost = (a: number, pos: number, m: Motion): number => {
  if (m.mode !== 'sweep') return 0;
  const d = pos - a;
  if (d < -m.band) return 0;
  if (d <= m.band) return m.gain;
  const t = (d - m.band) / m.trail;
  if (t >= 1) return 0;
  return m.gain * (1 - t) * (1 - t);
};

/** 0..1 pulse used to make panels flash as the sweep goes by. */
export const sweepFlash = (f: number, m: Motion): number => {
  if (m.mode !== 'sweep') return 0;
  const t = (f % m.period) / m.period;
  return Math.max(0, 1 - t * 6);
};

/** Independent cluster pulse (the jet's afterburners). */
export const clusterPulse = (f: number, m: Motion): number => {
  if (m.mode !== 'sweep' || !m.clusterPulse) return 0;
  const {period, amount} = m.clusterPulse;
  return Math.sin((f / period) * Math.PI * 2) * amount;
};

export const ScanSweep: React.FC<{
  frame: number;
  motion: Motion;
  palette: Palette;
  bounds: Bounds;
  width: number;
  height: number;
  drift: [number, number];
  reveal: number;
  clip: Rect;
}> = ({frame, motion, palette, bounds, width, height, drift, reveal, clip}) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    ctx.clearRect(0, 0, width, height);
    if (motion.mode !== 'sweep' || reveal <= 0) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(clip.x, clip.y, clip.w, clip.h);
    ctx.clip();

    const f = frame % DURATION;
    const pos = sweepPos(f, motion);
    const {x0, y0, x1, y1} = bounds;
    const span = x1 - x0;
    const cx = x0 + pos * span + drift[0];
    const top = y0 - 70 + drift[1];
    const bot = y1 + 70 + drift[1];
    const half = motion.band * span;
    const trail = motion.trail * span;

    const c = rgb(palette.sweep);

    // one continuous ramp: nothing ahead of the band, a bright core at the
    // leading edge, then a decaying trail behind it
    const g = ctx.createLinearGradient(cx - half - trail, 0, cx + half * 0.9, 0);
    g.addColorStop(0, rgba(c, 0));
    g.addColorStop(0.55, rgba(c, 0.035 * reveal));
    g.addColorStop(0.86, rgba(c, 0.1 * reveal));
    g.addColorStop(0.975, rgba(c, 0.26 * reveal));
    g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g;
    ctx.fillRect(cx - half - trail, top, half * 1.9 + trail, bot - top);

    // leading edge
    ctx.fillStyle = rgba(c, 0.85 * reveal);
    ctx.fillRect(cx - 2, top, 4, bot - top);
    ctx.filter = 'blur(16px)';
    ctx.fillStyle = rgba(c, 0.45 * reveal);
    ctx.fillRect(cx - 6, top, 12, bot - top);
    ctx.filter = 'none';

    // fade the band out vertically so it has no hard rectangular edge
    ctx.globalCompositeOperation = 'destination-out';
    const vg = ctx.createLinearGradient(0, top, 0, bot);
    vg.addColorStop(0, 'rgba(0,0,0,1)');
    vg.addColorStop(0.06, 'rgba(0,0,0,0.55)');
    vg.addColorStop(0.24, 'rgba(0,0,0,0)');
    vg.addColorStop(0.76, 'rgba(0,0,0,0)');
    vg.addColorStop(0.94, 'rgba(0,0,0,0.55)');
    vg.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = vg;
    ctx.fillRect(cx - half - trail - 8, top, half * 2 + trail + 16, bot - top);
    ctx.globalCompositeOperation = 'source-over';

    // tick caps
    ctx.fillStyle = rgba(c, 0.9 * reveal);
    ctx.fillRect(cx - 26, top - 6, 52, 6);
    ctx.fillRect(cx - 26, bot, 52, 6);
    ctx.restore();
  }, [frame, motion, palette, bounds, width, height, drift, reveal, clip]);

  return (
    <canvas
      ref={ref}
      width={width}
      height={height}
      style={{position: 'absolute', left: 0, top: 0, width, height}}
    />
  );
};
