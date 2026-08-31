import {
  ALONG_X,
  ALONG_Y,
  BAND_LENGTH,
  DURATION_IN_FRAMES,
  HEIGHT,
  PARTICLE_TILT_LIMIT,
  WIDTH,
  type DepthBucket,
} from "./constants";
import { withAlpha } from "./color";
import {
  bandPointX,
  bandPointY,
  sampleWave,
  wrapAlong,
  type Band,
  type Particle,
  type ParticleBatch,
} from "./field";
import type { VariantConfig } from "./variants";

export interface ParticleLayerProps {
  /** One target buffer per depth bucket. */
  targets: Record<DepthBucket, CanvasRenderingContext2D>;
  cfg: VariantConfig;
  bands: Band[];
  batches: ParticleBatch[];
  /** Loop position in [0, 1). */
  t: number;
  /** Frame within the loop, an integer in [0, 450). */
  loopFrame: number;
}

const MARGIN = 160;
const FLASH_FRAMES = 4;
const FLASH_GAIN = 2.6;

interface Flash {
  bucket: DepthBucket;
  color: string;
  alpha: number;
  width: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** How far into its flash a particle is on this frame; 0 when not flashing. */
const flashStrength = (p: Particle, loopFrame: number) => {
  if (!p.flashPeriod) return 0;
  const local =
    (((loopFrame - p.flashOffset) % p.flashPeriod) + p.flashPeriod) % p.flashPeriod;
  return local < FLASH_FRAMES ? 1 - local / FLASH_FRAMES : 0;
};

export const drawParticleLayer = (
  targets: Record<DepthBucket, CanvasRenderingContext2D>,
  cfg: VariantConfig,
  bands: Band[],
  batches: ParticleBatch[],
  t: number,
  loopFrame: number,
) => {
  const flashes: Flash[] = [];

  for (const bucket of ["far", "mid", "near"] as DepthBucket[]) {
    const ctx = targets[bucket];
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.lineCap = "round";
  }

  for (const batch of batches) {
    const ctx = targets[batch.bucket];
    ctx.strokeStyle = withAlpha(batch.color, batch.alpha);
    ctx.lineWidth = batch.width;
    ctx.beginPath();

    for (const p of batch.particles) {
      const band = bands[p.band];

      // Drift along the band, wrapping at the ends. `loops` is a whole number
      // of traversals per 450 frames, so the wrap never shows as a jump.
      const s = wrapAlong(p.s0 + p.loops * BAND_LENGTH * t);
      const { h, slope } = sampleWave(cfg, band, s, p.dNorm, t);
      const x = bandPointX(band, s, p.d);
      const y = bandPointY(band, s, p.d, h);
      if (x < -MARGIN || x > WIDTH + MARGIN || y < -MARGIN || y > HEIGHT + MARGIN) {
        continue;
      }

      // Elongated along the band, tilted by the local surface slope, which is
      // what makes the field read as flowing rather than as static dots.
      const tilt = Math.max(-PARTICLE_TILT_LIMIT, Math.min(PARTICLE_TILT_LIMIT, slope));
      const tx = ALONG_X;
      const ty = ALONG_Y - tilt;
      const norm = Math.sqrt(tx * tx + ty * ty);
      const dx = (tx / norm) * p.halfLength;
      const dy = (ty / norm) * p.halfLength;

      const strength = flashStrength(p, loopFrame);
      if (strength > 0) {
        flashes.push({
          bucket: batch.bucket,
          color: batch.color,
          alpha: Math.min(1, batch.alpha * (1 + FLASH_GAIN * strength)),
          width: batch.width * (1 + 0.5 * strength),
          x1: x - dx,
          y1: y - dy,
          x2: x + dx,
          y2: y + dy,
        });
        continue;
      }

      ctx.moveTo(x - dx, y - dy);
      ctx.lineTo(x + dx, y + dy);
    }

    ctx.stroke();
  }

  for (const flash of flashes) {
    const ctx = targets[flash.bucket];
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = withAlpha(flash.color, flash.alpha);
    ctx.lineWidth = flash.width;
    ctx.beginPath();
    ctx.moveTo(flash.x1, flash.y1);
    ctx.lineTo(flash.x2, flash.y2);
    ctx.stroke();
  }

  for (const bucket of ["far", "mid", "near"] as DepthBucket[]) {
    targets[bucket].globalCompositeOperation = "source-over";
  }
};

/**
 * The surface fill: small elongated dashes in mixed hues, dense at each band's
 * leading edge and thinning downward. Generated once and only advanced here.
 */
export const ParticleLayer: React.FC<ParticleLayerProps> = ({
  targets,
  cfg,
  bands,
  batches,
  t,
  loopFrame,
}) => {
  drawParticleLayer(targets, cfg, bands, batches, t, loopFrame % DURATION_IN_FRAMES);
  return null;
};
