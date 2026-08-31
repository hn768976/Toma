import {useDraw} from '../canvas';
import {hexToRgb, rgbaCss} from '../colors';
import {randBool, randInt, randRange} from '../rng';
import {HEIGHT, WIDTH} from '../variants';
import type {VariantConfig, VariantName} from '../variants';

/**
 * The star field twinkles on sines whose periods all divide the 420 frame
 * loop, so the sky at frame 420 is the sky at frame 0.
 */
const PERIODS = [420, 210, 140, 105, 84, 70, 60, 42, 35, 30, 28, 21, 20, 15, 14, 12, 10, 7, 6, 5];

type Star = {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly base: number;
  readonly period: number;
  readonly phase: number;
  readonly twinkle: number;
  readonly bright: boolean;
};

const starCache = new Map<VariantName, Star[]>();

const getStars = (name: VariantName, variant: VariantConfig): Star[] => {
  const cached = starCache.get(name);
  if (cached) {
    return cached;
  }
  const stars: Star[] = [];
  for (let i = 0; i < variant.sky.starCount; i++) {
    const seed = name + ':star' + i;
    const bright = randBool(seed + ':br', 0.07);
    stars.push({
      x: randRange(seed + ':x', 0, 1) * WIDTH,
      // Squaring the vertical placement packs the field towards the top of
      // the frame and thins it out towards the horizon.
      y: Math.pow(randRange(seed + ':y', 0, 1), 1.7) * HEIGHT,
      r: bright
        ? randRange(seed + ':r', 1.7, 3.4)
        : randRange(seed + ':r', 0.7, 1.9),
      base: bright
        ? randRange(seed + ':b', 0.5, 1)
        : randRange(seed + ':b', 0.05, 0.32),
      period: PERIODS[randInt(seed + ':p', 0, PERIODS.length - 1)],
      phase: randRange(seed + ':ph', 0, Math.PI * 2),
      twinkle: randRange(seed + ':t', 0.12, 0.5),
      bright,
    });
  }
  starCache.set(name, stars);
  return stars;
};

export const NightSky: React.FC<{
  readonly frame: number;
  readonly name: VariantName;
  readonly variant: VariantConfig;
}> = ({frame, name, variant}) => {
  useDraw((ctx) => {
    const {palette, sky} = variant;

    // A full-frame opaque fill: this is also what clears the previous frame.
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = palette.skyDeep;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    if (sky.washStrength > 0) {
      // Distant city glow, upper-left.
      const wash = ctx.createRadialGradient(
        WIDTH * 0.1,
        HEIGHT * 0.02,
        0,
        WIDTH * 0.1,
        HEIGHT * 0.02,
        WIDTH * 0.66,
      );
      const washRgb = hexToRgb(palette.skyWash);
      wash.addColorStop(0, rgbaCss(washRgb, 0.95 * sky.washStrength));
      wash.addColorStop(0.45, rgbaCss(washRgb, 0.42 * sky.washStrength));
      wash.addColorStop(1, rgbaCss(washRgb, 0));
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // The horizon sits a touch darker than the sky above it.
      const floor = ctx.createLinearGradient(0, HEIGHT * 0.45, 0, HEIGHT);
      const deep = hexToRgb(palette.vignette);
      floor.addColorStop(0, rgbaCss(deep, 0));
      floor.addColorStop(1, rgbaCss(deep, 0.35 * sky.washStrength));
      ctx.fillStyle = floor;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    const stars = getStars(name, variant);
    ctx.globalCompositeOperation = 'lighter';
    const pale = hexToRgb(palette.starPale);
    const brightRgb = hexToRgb(palette.starBright);
    for (const star of stars) {
      const t =
        star.base *
        (1 -
          star.twinkle +
          star.twinkle *
            (0.5 +
              0.5 * Math.sin((Math.PI * 2 * frame) / star.period + star.phase))) *
        sky.starBrightness;
      if (t <= 0.004) {
        continue;
      }
      ctx.fillStyle = rgbaCss(star.bright ? brightRgb : pale, Math.min(1, t));
      if (star.r < 1.2) {
        ctx.fillRect(star.x, star.y, star.r * 2, star.r * 2);
      } else {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });

  return null;
};
