import {useDraw} from '../canvas';
import {
  brightnessAt,
  emberMixAt,
  getBurstParticles,
  positionAt,
} from '../particles';
import {BURST_TYPES} from '../physics';
import type {Burst} from '../schedule';
import {emberStepOf, getSprites} from '../sprites';
import {HEIGHT, WIDTH} from '../variants';
import type {VariantConfig, VariantName} from '../variants';

/** Samples behind the head, at t-1, t-2, t-3 (times the type's spacing). */
const SAMPLES = 3;
const MARGIN = 260;
const ALPHA_STEPS = 10;

/**
 * The short streak every particle drags behind it. Sampling the same closed
 * form physics at earlier frames means a trail bends exactly the way the
 * particle's path bends — it curls over as the particle starts to fall.
 *
 * Strokes are batched into paths sharing a colour, width and opacity, so a
 * burst of 360 particles costs a few dozen strokes instead of a thousand.
 */
export const TrailLayer: React.FC<{
  readonly bursts: readonly Burst[];
  readonly frame: number;
  readonly name: VariantName;
  readonly variant: VariantConfig;
}> = ({bursts, frame, name, variant}) => {
  useDraw((ctx) => {
    const sprites = getSprites(name, variant);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';

    const batches = new Map<
      string,
      {path: Path2D; color: string; alpha: number; width: number}
    >();

    for (const burst of bursts) {
      const age = frame - burst.start;
      if (age < 1 || age > burst.maxLife) {
        continue;
      }
      const spec = BURST_TYPES[burst.type];
      const particles = getBurstParticles(burst, variant);

      for (const p of particles) {
        const head = brightnessAt(p, age) * burst.brightness;
        if (head <= 0.03) {
          continue;
        }
        let prev = positionAt(burst, p, age);
        if (
          prev.x < -MARGIN ||
          prev.x > WIDTH + MARGIN ||
          prev.y < -MARGIN ||
          prev.y > HEIGHT + MARGIN
        ) {
          continue;
        }
        const colorStep = emberStepOf(emberMixAt(p, age));
        const color = sprites.css[p.colorIndex][colorStep];

        for (let s = 1; s <= SAMPLES; s++) {
          const sampleAge = age - s * spec.trailSpacing;
          if (sampleAge < 0) {
            break;
          }
          const point = positionAt(burst, p, sampleAge);
          // The trail is dimmer and thinner than the head, and both fall away
          // along its length.
          const falloff = 1 - (s - 1) / (SAMPLES + 0.6);
          const alpha = Math.min(
            1,
            head * spec.trailStrength * falloff * falloff,
          );
          if (alpha > 0.02) {
            const width = Math.max(1, p.size * 0.5 * falloff);
            const alphaBucket = Math.max(
              1,
              Math.round(alpha * ALPHA_STEPS),
            );
            const widthBucket = Math.round(width * 2) / 2;
            const key =
              p.colorIndex + '|' + colorStep + '|' + alphaBucket + '|' + widthBucket;
            let batch = batches.get(key);
            if (!batch) {
              batch = {
                path: new Path2D(),
                color,
                alpha: alphaBucket / ALPHA_STEPS,
                width: widthBucket,
              };
              batches.set(key, batch);
            }
            batch.path.moveTo(prev.x, prev.y);
            batch.path.lineTo(point.x, point.y);
          }
          prev = point;
        }
      }
    }

    for (const batch of batches.values()) {
      ctx.globalAlpha = batch.alpha;
      ctx.strokeStyle = batch.color;
      ctx.lineWidth = batch.width;
      ctx.stroke(batch.path);
    }
  });

  return null;
};
