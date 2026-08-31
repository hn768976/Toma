import {useDraw} from '../canvas';
import {
  brightnessAt,
  emberMixAt,
  getBurstParticles,
  positionAt,
} from '../particles';
import {BURST_TYPES} from '../physics';
import type {Burst as BurstType} from '../schedule';
import {emberStepOf, getSprites} from '../sprites';
import {HEIGHT, WIDTH} from '../variants';
import type {VariantConfig, VariantName} from '../variants';

const MARGIN = 240;

/**
 * The heads of one burst's particles, plus the flash of the break itself.
 * Trails are drawn underneath by <TrailLayer>.
 */
export const Burst: React.FC<{
  readonly burst: BurstType;
  readonly frame: number;
  readonly name: VariantName;
  readonly variant: VariantConfig;
}> = ({burst, frame, name, variant}) => {
  useDraw((ctx) => {
    const age = frame - burst.start;
    if (age < 0 || age > burst.maxLife) {
      return;
    }
    const sprites = getSprites(name, variant);
    const spec = BURST_TYPES[burst.type];
    const particles = getBurstParticles(burst, variant);

    ctx.globalCompositeOperation = 'lighter';

    // The break itself: a short, very bright flash at the origin. This is what
    // makes a detonation feel like an explosion rather than an appearance.
    if (age < 14) {
      const t = 1 - age / 14;
      const alpha = Math.pow(t, 2.1) * 0.5 * burst.brightness;
      const size = 900 * burst.scale * (0.4 + age * 0.16);
      ctx.globalAlpha = alpha;
      ctx.drawImage(
        sprites.flash,
        burst.x - size / 2,
        burst.y - size / 2,
        size,
        size,
      );
      const colorSize = size * 1.9;
      ctx.globalAlpha = alpha * 0.85;
      ctx.drawImage(
        sprites.glow[burst.colorIndex][0],
        burst.x - colorSize / 2,
        burst.y - colorSize / 2,
        colorSize,
        colorSize,
      );
    }

    // Atmospheric haze: the air around a fresh break lights up. It is what
    // separates a photographed firework from a scatter of bright dots.
    const haze = 0.17 * Math.exp(-age / 16) * burst.brightness;
    if (haze > 0.004) {
      const hazeSize = (620 + age * 34) * burst.scale;
      ctx.globalAlpha = haze;
      ctx.drawImage(
        sprites.glow[burst.colorIndex][0],
        burst.x - hazeSize / 2,
        burst.y - hazeSize / 2,
        hazeSize,
        hazeSize,
      );
    }

    for (const p of particles) {
      const b = brightnessAt(p, age) * burst.brightness;
      if (b <= 0.012) {
        continue;
      }
      const {x, y} = positionAt(burst, p, age);
      if (
        x < -MARGIN ||
        x > WIDTH + MARGIN ||
        y < -MARGIN ||
        y > HEIGHT + MARGIN
      ) {
        continue;
      }
      const sprite =
        sprites.glow[p.colorIndex][emberStepOf(emberMixAt(p, age))];
      const d = p.size * spec.glow;

      // The wide halo goes down first so the tighter head sits on top of it
      // and the particle keeps its colour instead of blowing out to white.
      if (b > 0.5) {
        const wide = d * 2.8;
        ctx.globalAlpha = Math.min(0.32, (b - 0.5) * 0.34);
        ctx.drawImage(sprite, x - wide / 2, y - wide / 2, wide, wide);
      }
      ctx.globalAlpha = Math.min(1, b);
      ctx.drawImage(sprite, x - d / 2, y - d / 2, d, d);
    }
  });

  return null;
};
