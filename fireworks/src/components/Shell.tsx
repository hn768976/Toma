import {useDraw} from '../canvas';
import type {Burst} from '../schedule';
import {getSprites} from '../sprites';
import type {VariantConfig, VariantName} from '../variants';

const TRAIL_SAMPLES = 4;

/**
 * The rising shell: a small bright point that climbs from below the frame,
 * decelerating as it goes, and stops exactly where and when its burst breaks.
 */
export const Shell: React.FC<{
  readonly burst: Burst;
  readonly frame: number;
  readonly name: VariantName;
  readonly variant: VariantConfig;
}> = ({burst, frame, name, variant}) => {
  useDraw((ctx) => {
    const launch = burst.launch;
    if (!launch) {
      return;
    }
    const age = frame - launch.start;
    if (age < 0 || age >= launch.duration) {
      return;
    }
    const sprites = getSprites(name, variant);

    const at = (t: number) => {
      const p = Math.max(0, Math.min(1, t / launch.duration));
      // Fast off the ground, almost stopped at the top.
      const e = 1 - Math.pow(1 - p, 2.7);
      const sway = Math.sin(p * 2.4 + burst.x) * 26 * (1 - e);
      return {
        x: launch.fromX + (burst.x - launch.fromX) * e + sway,
        y: launch.fromY + (burst.y - launch.fromY) * e,
        p,
      };
    };

    const head = at(age);
    // The shell dims as it slows, so the break is the brightest thing.
    const glow =
      (0.55 + 0.45 * Math.abs(Math.sin(age * 1.9 + burst.y))) *
      (1 - 0.45 * head.p) *
      variant.brightness;

    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.strokeStyle = sprites.shellCss;

    let prev = head;
    for (let s = 1; s <= TRAIL_SAMPLES; s++) {
      const point = at(age - s * 1.5);
      const falloff = 1 - (s - 1) / (TRAIL_SAMPLES + 0.5);
      ctx.globalAlpha = Math.min(1, glow * 0.5 * falloff * falloff);
      ctx.lineWidth = 4.5 * falloff;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      prev = point;
    }

    const d = 54;
    ctx.globalAlpha = Math.min(1, glow);
    ctx.drawImage(sprites.shell, head.x - d / 2, head.y - d / 2, d, d);
  });

  return null;
};
