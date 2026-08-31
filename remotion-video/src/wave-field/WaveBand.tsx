import { BAND_LENGTH, HEIGHT, STRAND_STEP_PX, WIDTH } from "./constants";
import { withAlpha } from "./color";
import { bandPointX, bandPointY, sampleWave, type Band } from "./field";
import type { VariantConfig } from "./variants";

export interface WaveBandProps {
  ctx: CanvasRenderingContext2D;
  cfg: VariantConfig;
  band: Band;
  /** Loop position in [0, 1). */
  t: number;
}

const MARGIN = 400;

export const drawWaveBand = (
  ctx: CanvasRenderingContext2D,
  cfg: VariantConfig,
  band: Band,
  t: number,
) => {
  const steps = Math.ceil(BAND_LENGTH / (STRAND_STEP_PX * band.scale));
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 3.2 * band.scale;

  for (let row = 0; row < cfg.strandRows; row++) {
    const dNorm = cfg.strandRows <= 1 ? 0 : row / (cfg.strandRows - 1);
    const d = dNorm * cfg.bandThickness;
    // Strands thin out downward at the same rate the particles do, so the
    // surface and its fill fade into the space below the band together.
    const alpha = cfg.strandAlpha * Math.pow(1 - dNorm, 1.5);
    if (alpha < 0.004) continue;

    ctx.strokeStyle = withAlpha(cfg.palette.strand, alpha);
    ctx.beginPath();
    let drawing = false;
    for (let i = 0; i <= steps; i++) {
      const s = -BAND_LENGTH / 2 + (i / steps) * BAND_LENGTH;
      const { h } = sampleWave(cfg, band, s, dNorm, t);
      const x = bandPointX(band, s, d);
      const y = bandPointY(band, s, d, h);
      const visible =
        x > -MARGIN && x < WIDTH + MARGIN && y > -MARGIN && y < HEIGHT + MARGIN;
      if (!visible) {
        drawing = false;
        continue;
      }
      if (drawing) ctx.lineTo(x, y);
      else {
        ctx.moveTo(x, y);
        drawing = true;
      }
    }
    ctx.stroke();
  }
};

/**
 * One band's wave surface, drawn as iso-depth strands running along the band.
 * Height at every point comes from layered sines, so the surface undulates
 * along its length with a rolling swell rather than sliding as a rigid sheet.
 */
export const WaveBand: React.FC<WaveBandProps> = ({ ctx, cfg, band, t }) => {
  drawWaveBand(ctx, cfg, band, t);
  return null;
};
