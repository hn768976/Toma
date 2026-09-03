/**
 * <BokehLayer> — soft out-of-focus discs drifting near the camera.
 *
 * Rendered as radial gradients rather than blurred sprites, so no buffer and
 * no filter is needed. Each disc drifts on a closed Lissajous path with
 * integer frequencies over the loop, so the layer is seamless. The set is
 * split into a rear group behind the corridor and a front group that passes in
 * front of it.
 */
import React, { useMemo } from "react";
import { useCanvasLayer } from "../lib/canvasLayers";
import { mixRgba } from "../lib/color";
import { TAU } from "../lib/math";
import { CorridorGeometry } from "../lib/perspective";
import { randInt, randRange } from "../lib/seededRandom";

interface Disc {
  x: number;
  y: number;
  r: number;
  alpha: number;
  tone: number;
  ax: number;
  ay: number;
  fx: number;
  fy: number;
  phase: number;
  rimPhase: number;
}

export interface BokehLayerProps {
  id: string;
  order: number;
  geo: CorridorGeometry;
  palette: Record<string, string>;
  frame: number;
  loop: number;
  seed: string;
  /** Index range of the shared 0..count-1 disc set this layer draws. */
  from: number;
  to: number;
  count: number;
  minR: number;
  maxR: number;
  alpha: number;
  /** Front discs sit closer to the camera: bigger, softer, slightly stronger. */
  front?: boolean;
}

export const BokehLayer: React.FC<BokehLayerProps> = ({
  id,
  order,
  geo,
  palette,
  frame,
  loop,
  seed,
  from,
  to,
  count,
  minR,
  maxR,
  alpha,
  front = false,
}) => {
  const discs = useMemo<Disc[]>(() => {
    const out: Disc[] = [];
    for (let i = 0; i < count; i++) {
      const s = `${seed}-bokeh-${i}`;
      const near = i / count;
      out.push({
        x: randRange(`${s}-x`, -0.08, 1.08) * geo.width,
        y: randRange(`${s}-y`, -0.06, 1.06) * geo.height,
        r: randRange(`${s}-r`, minR, maxR) * (0.7 + near * 0.6),
        alpha: randRange(`${s}-a`, 0.35, 1) * alpha,
        tone: randRange(`${s}-t`, 0, 1),
        ax: randRange(`${s}-ax`, 0.02, 0.08) * geo.width,
        ay: randRange(`${s}-ay`, 0.02, 0.07) * geo.height,
        fx: randInt(`${s}-fx`, 1, 3),
        fy: randInt(`${s}-fy`, 1, 3),
        phase: randRange(`${s}-p`, 0, 1),
        rimPhase: randRange(`${s}-rp`, 0, 1),
      });
    }
    return out;
  }, [count, seed, geo.width, geo.height, minR, maxR, alpha]);

  useCanvasLayer({
    id,
    order,
    draw: (ctx) => {
      const t = frame / loop;
      ctx.globalCompositeOperation = "lighter";
      for (let i = from; i < to && i < discs.length; i++) {
        const b = discs[i];
        const x = b.x + Math.cos((t * b.fx + b.phase) * TAU) * b.ax;
        const y = b.y + Math.sin((t * b.fy + b.phase) * TAU) * b.ay;
        const r = b.r * (front ? 1.45 : 1);
        const a = b.alpha * (front ? 1.15 : 1);
        const rim = 0.55 + 0.4 * Math.sin((t * 2 + b.rimPhase) * TAU);

        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, mixRgba(palette.bokehBlue, palette.horizonGlow, b.tone, a * 0.5));
        g.addColorStop(0.55, mixRgba(palette.bokehBlue, palette.horizonGlow, b.tone, a * 0.34));
        // A faint rim: real bokeh is brighter at the edge of the disc.
        g.addColorStop(0.88, mixRgba(palette.bokehBlue, palette.horizonGlow, b.tone, a * 0.46 * rim));
        g.addColorStop(1, mixRgba(palette.bokehBlue, palette.horizonGlow, b.tone, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
      }
    },
  });
  return null;
};
