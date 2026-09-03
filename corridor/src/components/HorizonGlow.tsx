/**
 * <HorizonGlow> — the soft bright bloom centred on the vanishing point.
 *
 * This is what makes the corridor read as receding into light rather than into
 * nothing. Built from stacked radial gradients (no filter, no buffer) plus an
 * ellipse stretched along the horizon line, and pulsed +/-8% on a sine whose
 * period divides the loop.
 */
import React from "react";
import { useCanvasLayer } from "../lib/canvasLayers";
import { rgba } from "../lib/color";
import { TAU } from "../lib/math";
import { CorridorGeometry } from "../lib/perspective";

export interface HorizonGlowProps {
  order: number;
  geo: CorridorGeometry;
  palette: Record<string, string>;
  frame: number;
  loop: number;
  radius: number;
  intensity: number;
  stretch: number;
  /** Pulse period in frames. Must divide the loop length. */
  pulsePeriod?: number;
}

export const HorizonGlow: React.FC<HorizonGlowProps> = ({
  order,
  geo,
  palette,
  frame,
  radius,
  intensity,
  stretch,
  pulsePeriod = 125,
}) => {
  useCanvasLayer({
    id: "horizon-glow",
    order,
    draw: (ctx) => {
      const pulse = 1 + 0.08 * Math.sin((frame / pulsePeriod) * TAU);
      const cx = geo.vanishX;
      const cy = geo.horizonY;
      const base = geo.height * radius * pulse;
      const glow = palette.horizonGlow;

      ctx.globalCompositeOperation = "lighter";

      // Wide halo, stretched along the horizon.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(stretch, 0.62);
      const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, base * 2.5);
      halo.addColorStop(0, rgba(glow, 0.3 * intensity));
      halo.addColorStop(0.35, rgba(glow, 0.11 * intensity));
      halo.addColorStop(0.72, rgba(glow, 0.028 * intensity));
      halo.addColorStop(1, rgba(glow, 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(0, 0, base * 2.5, 0, TAU);
      ctx.fill();
      ctx.restore();

      // Round core.
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, base);
      core.addColorStop(0, rgba(glow, 0.62 * intensity));
      core.addColorStop(0.18, rgba(glow, 0.3 * intensity));
      core.addColorStop(0.5, rgba(glow, 0.085 * intensity));
      core.addColorStop(1, rgba(glow, 0));
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, base, 0, TAU);
      ctx.fill();

      // Hot centre.
      const hot = base * 0.2;
      const centre = ctx.createRadialGradient(cx, cy, 0, cx, cy, hot);
      centre.addColorStop(0, rgba(glow, 0.95 * intensity));
      centre.addColorStop(0.45, rgba(glow, 0.4 * intensity));
      centre.addColorStop(1, rgba(glow, 0));
      ctx.fillStyle = centre;
      ctx.beginPath();
      ctx.arc(cx, cy, hot, 0, TAU);
      ctx.fill();
    },
  });
  return null;
};
