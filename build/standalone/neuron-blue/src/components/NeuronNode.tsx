import React, {useEffect, useMemo, useRef} from 'react';
import type {NodeRT} from '../geometry';
import type {VariantConfig} from '../variants';
import {DUR, lsin} from '../motion';
import {mix, rgba} from '../color';

/**
 * A hot near-white core wrapped in layered radial gradients out to a wide
 * halo, plus a few short bright spikes. The gradient stack is rendered ONCE
 * to an offscreen canvas and blitted per frame with an alpha multiplier.
 */
export const NeuronNode: React.FC<{
  node: NodeRT;
  cfg: VariantConfig;
  frame: number;
  /** Extra core energy 0..1 (v3 draws the retracted energy in) */
  energy: number;
}> = ({node, cfg, frame, energy}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const {palette} = cfg;
  const R = node.haloR;
  const side = Math.ceil(2 * R * 1.25);

  const halo = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 2 * R;
    c.height = 2 * R;
    const ctx = c.getContext('2d');
    if (!ctx) {
      return c;
    }
    ctx.globalCompositeOperation = 'lighter';

    // Wide generous halo, spilling well beyond the filament origin
    const outer = ctx.createRadialGradient(R, R, 0, R, R, R);
    outer.addColorStop(0, rgba(palette.nodeHue, 0.34));
    outer.addColorStop(0.35, rgba(palette.nodeHue, 0.1));
    outer.addColorStop(1, rgba(palette.nodeHue, 0));
    ctx.fillStyle = outer;
    ctx.fillRect(0, 0, 2 * R, 2 * R);

    // Mid glow
    const mid = ctx.createRadialGradient(R, R, 0, R, R, R * 0.4);
    mid.addColorStop(0, mix(palette.nodeWhite, palette.nodeHue, 0.35, 0.9));
    mid.addColorStop(0.55, rgba(palette.nodeHue, 0.28));
    mid.addColorStop(1, rgba(palette.nodeHue, 0));
    ctx.fillStyle = mid;
    ctx.fillRect(0, 0, 2 * R, 2 * R);

    // The hot core - near-white, only a few pixels relative to the halo
    const core = ctx.createRadialGradient(R, R, 0, R, R, R * 0.11);
    core.addColorStop(0, rgba(palette.nodeWhite, 1));
    core.addColorStop(0.4, mix(palette.nodeWhite, palette.nodeHue, 0.45, 0.85));
    core.addColorStop(1, rgba(palette.nodeHue, 0));
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, 2 * R, 2 * R);

    return c;
  }, [R, palette]);

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.clearRect(0, 0, side, side);
    const t01 = frame / DUR;
    const pulse = 1 + 0.12 * lsin(t01, DUR / node.pulsePeriod, node.pulsePhase);
    const level = node.brightness * pulse * (1 + 0.75 * energy);
    const size = 2 * R * (1 + 0.13 * energy);
    const half = side / 2;

    // Blit the pre-rendered gradient stack; draw twice for overbright levels
    ctx.globalAlpha = Math.min(1, level);
    ctx.drawImage(halo, half - size / 2, half - size / 2, size, size);
    if (level > 1) {
      ctx.globalAlpha = Math.min(1, level - 1);
      ctx.drawImage(halo, half - size / 2, half - size / 2, size, size);
    }
    ctx.globalAlpha = 1;

    // Short bright spikes: the innermost dendrites catching the light
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const s of node.spikes) {
      const shimmer = 0.55 + 0.45 * lsin(t01, s.alphaFreq, s.alphaPhase);
      const a = Math.min(1, shimmer * Math.min(1.25, level));
      const x0 = half + Math.cos(s.angle) * R * 0.05;
      const y0 = half + Math.sin(s.angle) * R * 0.05;
      const x1 = half + Math.cos(s.angle) * s.len;
      const y1 = half + Math.sin(s.angle) * s.len;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.strokeStyle = rgba(palette.nodeHue, a * 0.35);
      ctx.lineWidth = s.width * 2.2;
      ctx.stroke();
      ctx.strokeStyle = mix(palette.nodeWhite, palette.nodeHue, 0.25, a * 0.8);
      ctx.lineWidth = s.width;
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }, [frame, node, halo, R, side, palette, energy]);

  return (
    <canvas
      ref={ref}
      width={side}
      height={side}
      style={{
        position: 'absolute',
        left: node.px - side / 2,
        top: node.py - side / 2,
        width: side,
        height: side,
        mixBlendMode: 'screen',
      }}
    />
  );
};
