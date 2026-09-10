// Static starfield. The points never move -- the tunnel does all the
// travelling -- so the field is identical on the first and last frame by
// construction. Only brightness cycles, and every twinkle period divides
// 450 evenly so those line up at the seam too.

import { Rng, mulberry32 } from "./chalk";
import { STAR_COUNT, STAR_TWINKLE_PERIODS } from "./constants";

export type Star = {
  x: number; // 0..1 of frame width
  y: number; // 0..1 of frame height
  size: number; // 0..1, multiplied by resolution scale at draw time
  brightness: number;
  period: number;
  phase: number;
};

const TAU = Math.PI * 2;

export const generateStars = (): Star[] => {
  const rng: Rng = mulberry32(0x2c8f);
  const stars: Star[] = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    const r = rng();
    stars.push({
      x: rng(),
      y: rng(),
      // Cubed so the field is mostly pinpricks with a handful of
      // brighter grains, rather than an even dusting of same-size dots.
      size: 0.5 + r * r * r * 2.1,
      brightness: 0.18 + rng() * 0.5,
      period: STAR_TWINKLE_PERIODS[Math.floor(rng() * STAR_TWINKLE_PERIODS.length)],
      phase: rng(),
    });
  }
  return stars;
};

export const drawStars = (
  ctx: CanvasRenderingContext2D,
  stars: Star[],
  frame: number,
  width: number,
  height: number,
  resolutionScale: number,
  color: string,
) => {
  ctx.fillStyle = color;
  for (const star of stars) {
    const twinkle =
      0.62 + 0.38 * Math.sin(TAU * (frame / star.period + star.phase));
    ctx.globalAlpha = star.brightness * twinkle;
    ctx.beginPath();
    ctx.arc(
      star.x * width,
      star.y * height,
      star.size * resolutionScale,
      0,
      TAU,
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;
};
