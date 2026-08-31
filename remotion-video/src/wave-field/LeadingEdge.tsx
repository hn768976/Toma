import { BAND_LENGTH, HEIGHT, TAU, WIDTH } from "./constants";
import { withAlpha } from "./color";
import { bandPointX, bandPointY, sampleWave, type Band, type EdgeDots } from "./field";
import type { VariantConfig } from "./variants";

export interface LeadingEdgeProps {
  ctx: CanvasRenderingContext2D;
  cfg: VariantConfig;
  band: Band;
  edge: EdgeDots;
  /** Loop position in [0, 1). */
  t: number;
}

const MARGIN = 120;

export const drawLeadingEdge = (
  ctx: CanvasRenderingContext2D,
  cfg: VariantConfig,
  band: Band,
  edge: EdgeDots,
  t: number,
) => {
  // Additive, so overlapping dot glow accumulates instead of flattening.
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 1;

  for (const s of edge.positions) {
    const { h } = sampleWave(cfg, band, s, 0, t);
    const x = bandPointX(band, s, 0);
    const y = bandPointY(band, s, 0, h);
    if (x < -MARGIN || x > WIDTH + MARGIN || y < -MARGIN || y > HEIGHT + MARGIN) {
      continue;
    }

    // A bright pulse travelling along the line of dots, so the edge appears to
    // carry a signal. `pulseTravel` whole cycles per 450 frames means the pulse
    // period is 450 / pulseTravel frames, always a divisor of 450.
    const theta =
      (s / BAND_LENGTH) * cfg.pulseCrests - cfg.pulseTravel * t + band.phase;
    const pulse = Math.pow(0.5 + 0.5 * Math.cos(TAU * theta), cfg.pulseSharpness);

    const radius = edge.radius * (1 + 0.35 * pulse);

    ctx.fillStyle = withAlpha(cfg.palette.edgeAccent, 0.55 + 0.45 * pulse);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();

    ctx.fillStyle = withAlpha(cfg.palette.edgeCore, 0.55 + 0.45 * pulse);
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.46, 0, TAU);
    ctx.fill();
  }

  ctx.globalCompositeOperation = "source-over";
};

/**
 * The signature element: a line of uniformly sized, uniformly spaced dots along
 * a band's upper edge, tracing its crest. Regularity is correct here — it reads
 * as an instrument's sampling line rather than as an object.
 */
export const LeadingEdge: React.FC<LeadingEdgeProps> = ({ ctx, cfg, band, edge, t }) => {
  drawLeadingEdge(ctx, cfg, band, edge, t);
  return null;
};
