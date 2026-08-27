import React, {useLayoutEffect} from 'react';
import {shockwaveSchedule} from '../lib/motion';
import {clamp, clearCanvas, context2d, easeOutCubic, rgba} from '../lib/util';
import type {LayerProps} from './BandLayer';

/**
 * One component, three behaviours — chosen by the variant's beam config.
 *
 *   linearScan  a beam arrives and strikes the dial       ("being scanned")
 *   radialPulse shockwaves leave the centre               ("emitting a warning")
 *   sweep       a soft wedge turns about the assembly     ("listening")
 */

const drawLinearScan = (
  ctx: CanvasRenderingContext2D,
  beam: Extract<import('../variants').BeamConfig, {mode: 'linearScan'}>['beams'][number],
  accent: string,
  white: string,
  frame: number,
  cx: number,
  cy: number,
  R: number
): void => {
  const p = clamp((frame - beam.startFrame) / (beam.strikeFrame - beam.startFrame));
  if (p <= 0) return;

  const a = (beam.bearingDeg * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const ox = cx + dx * beam.origin;
  const oy = cy + dy * beam.origin;
  const tx = cx + dx * R;
  const ty = cy + dy * R;

  const eased = easeOutCubic(p);
  const hx = ox + (tx - ox) * eased;
  const hy = oy + (ty - oy) * eased;

  // Once it has struck, the beam holds and breathes.
  const hold = p >= 1 ? 1 + 0.16 * Math.sin((frame / 26) * Math.PI * 2) : 1;
  const alpha = beam.alpha * hold;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.setLineDash(beam.dash);
  ctx.lineDashOffset = -frame * 2.2;
  ctx.lineWidth = beam.thickness;
  ctx.lineCap = 'butt';
  ctx.strokeStyle = accent;
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  ctx.setLineDash([]);

  // Travelling head.
  const head = ctx.createRadialGradient(hx, hy, 0, hx, hy, beam.thickness * 7);
  head.addColorStop(0, rgba(white, 0.9));
  head.addColorStop(0.3, rgba(accent, 0.55));
  head.addColorStop(1, rgba(accent, 0));
  ctx.fillStyle = head;
  ctx.beginPath();
  ctx.arc(hx, hy, beam.thickness * 7, 0, Math.PI * 2);
  ctx.fill();

  // Impact flare at the dial's edge: a hard hit that settles to a steady glow.
  if (p >= 1) {
    const since = frame - beam.strikeFrame;
    const burst = Math.exp(-since / 9);
    const size = beam.thickness * (14 + burst * 34) * beam.flare;
    const flare = ctx.createRadialGradient(tx, ty, 0, tx, ty, size);
    flare.addColorStop(0, rgba(white, 0.95 * (0.45 + burst * 0.55)));
    flare.addColorStop(0.22, rgba(accent, 0.6 * (0.4 + burst * 0.6)));
    flare.addColorStop(1, rgba(accent, 0));
    ctx.fillStyle = flare;
    ctx.beginPath();
    ctx.arc(tx, ty, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
};

export const BeamLayer: React.FC<LayerProps> = ({
  canvas,
  variant,
  frame,
  durationInFrames,
  cx,
  cy,
  R,
}) => {
  useLayoutEffect(() => {
    const ctx = context2d(canvas);
    clearCanvas(ctx);

    const {palette} = variant;
    const cfg = variant.beam;

    if (cfg.mode === 'linearScan') {
      for (const beam of cfg.beams) {
        drawLinearScan(ctx, beam, palette.accent, palette.white, frame, cx, cy, R);
      }
      return;
    }

    if (cfg.mode === 'radialPulse') {
      const emissions = shockwaveSchedule(
        cfg.seed,
        cfg.firstFrame,
        cfg.minGap,
        cfg.maxGap,
        durationInFrames
      );
      const inner = R * 0.16;

      for (const at of emissions) {
        const age = frame - at;

        // Two-frame bright flash at the centre immediately before each ring.
        if (age >= -cfg.flashFrames && age < 0) {
          const k = 1 + age / cfg.flashFrames;
          const size = R * (0.3 + k * 0.55);
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, size);
          g.addColorStop(0, rgba(palette.white, 0.85 * k));
          g.addColorStop(0.25, rgba(palette.accent, 0.5 * k));
          g.addColorStop(1, rgba(palette.accent, 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(cx, cy, size, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }

        if (age < 0 || age > cfg.life) continue;

        const t = age / cfg.life;
        const radius = inner + (cfg.maxRadius - inner) * Math.pow(t, 0.82);
        const alpha = Math.pow(1 - t, 1.5);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.lineWidth = cfg.thickness * (1 - t * 0.55);
        ctx.strokeStyle = palette.accent;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalAlpha = alpha * 0.4;
        ctx.lineWidth = cfg.thickness * 2.6 * (1 - t * 0.55);
        ctx.strokeStyle = rgba(palette.white, 0.5);
        ctx.stroke();
        ctx.restore();
      }
      return;
    }

    // Rotating radar sweep — exactly `turns` revolutions over the whole piece.
    const fade = clamp((frame - cfg.startFrame) / cfg.fadeFrames);
    if (fade <= 0) return;

    const lead = (frame / durationInFrames) * cfg.turns * Math.PI * 2 - Math.PI / 2;
    const wedge = (cfg.wedgeDeg * Math.PI) / 180;
    const radius = R * cfg.radius;
    const frac = wedge / (Math.PI * 2);

    ctx.save();
    ctx.translate(cx, cy);

    // One conic gradient across the wedge. Stacking translucent sectors instead
    // leaves a visible seam wherever two of them overlap.
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, lead - wedge, lead);
    ctx.closePath();
    ctx.clip();

    const cone = ctx.createConicGradient(lead - wedge, 0, 0);
    cone.addColorStop(0, rgba(palette.accent, 0));
    cone.addColorStop(frac * 0.45, rgba(palette.accent, 0.16));
    cone.addColorStop(frac * 0.8, rgba(palette.accent, 0.52));
    cone.addColorStop(frac * 0.97, rgba(palette.accent, 1));
    cone.addColorStop(Math.min(1, frac), rgba(palette.accent, 1));
    ctx.globalAlpha = cfg.alpha * fade;
    ctx.fillStyle = cone;
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2);

    // Soften the far end so the wedge dissolves rather than stopping dead.
    const falloff = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius);
    falloff.addColorStop(0, 'rgba(0,0,0,0)');
    falloff.addColorStop(0.62, 'rgba(0,0,0,0.05)');
    falloff.addColorStop(0.86, 'rgba(0,0,0,0.34)');
    falloff.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 1;
    ctx.fillStyle = falloff;
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    ctx.globalCompositeOperation = 'source-over';

    // A crisp leading edge so the direction of travel is unambiguous.
    ctx.globalAlpha = cfg.alpha * fade;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    const edge = ctx.createLinearGradient(0, 0, Math.cos(lead) * radius, Math.sin(lead) * radius);
    edge.addColorStop(0, rgba(palette.accent, 0.15));
    edge.addColorStop(0.55, rgba(palette.accent, 0.9));
    edge.addColorStop(1, rgba(palette.accent, 0));
    ctx.strokeStyle = edge;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(lead) * radius, Math.sin(lead) * radius);
    ctx.stroke();
    ctx.restore();
  });

  return null;
};
