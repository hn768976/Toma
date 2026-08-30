import { useLayoutEffect, useMemo } from "react";
import { beginWorld, context2d, makeCanvas, type Buffers } from "./buffers";
import { shade, withAlpha } from "./color";
import { CANVAS_H, CANVAS_W, DURATION } from "./layout";
import { rndInt, rndRange } from "./rng";
import type { VariantConfig } from "./variants";

/** Sprites are built at half scale and blitted at 2x; they are pure gradient. */
const STREAK_LEN = 2400;
const STREAK_WIDTH = 300;
const STREAK_COUNT = 3;

type Streak = {
  sprite: HTMLCanvasElement;
  x: number;
  y: number;
  angle: number;
  alpha: number;
  ax: number;
  ay: number;
  k: number;
  phase: number;
  scale: number;
};

type Props = {
  buffers: Buffers;
  cfg: VariantConfig;
  frame: number;
  drift: { x: number; y: number };
};

const makeStreakSprite = (color: string) => {
  const canvas = makeCanvas(STREAK_LEN, STREAK_WIDTH);
  const ctx = context2d(canvas);

  const across = ctx.createLinearGradient(0, 0, 0, STREAK_WIDTH);
  across.addColorStop(0, withAlpha(color, 0));
  across.addColorStop(0.42, withAlpha(color, 0.75));
  across.addColorStop(0.5, withAlpha(color, 1));
  across.addColorStop(0.58, withAlpha(color, 0.75));
  across.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = across;
  ctx.fillRect(0, 0, STREAK_LEN, STREAK_WIDTH);

  // Fade both ends so the streak has no hard edge.
  const along = ctx.createLinearGradient(0, 0, STREAK_LEN, 0);
  along.addColorStop(0, withAlpha(color, 0));
  along.addColorStop(0.3, withAlpha(color, 1));
  along.addColorStop(0.7, withAlpha(color, 1));
  along.addColorStop(1, withAlpha(color, 0));
  ctx.globalCompositeOperation = "destination-in";
  ctx.fillStyle = along;
  ctx.fillRect(0, 0, STREAK_LEN, STREAK_WIDTH);

  return canvas;
};

/**
 * Wide, very soft diagonals across the upper frame, suggesting light sources
 * off screen. They live in the far buffer so they pick up the heavy blur.
 */
export const LightStreak: React.FC<Props> = ({ buffers, cfg, frame, drift }) => {
  const streaks = useMemo<Streak[]>(() => {
    const cache = new Map<string, HTMLCanvasElement>();
    const out: Streak[] = [];
    for (let i = 0; i < STREAK_COUNT; i++) {
      // One warm streak among the cool ones keeps the wash from going flat.
      const color =
        i === 1
          ? shade(cfg.palette.bokehWarm, 0.1)
          : shade(cfg.palette.bokehPrimary, 0.25);
      if (!cache.has(color)) {
        cache.set(color, makeStreakSprite(color));
      }
      out.push({
        sprite: cache.get(color) as HTMLCanvasElement,
        x: rndRange(`${cfg.seed}-streak-x-${i}`, CANVAS_W * 0.1, CANVAS_W * 0.9),
        y: rndRange(`${cfg.seed}-streak-y-${i}`, CANVAS_H * 0.04, CANVAS_H * 0.42),
        angle: rndRange(`${cfg.seed}-streak-a-${i}`, -34, -18) * (Math.PI / 180),
        alpha: rndRange(`${cfg.seed}-streak-al-${i}`, 0.1, 0.2),
        ax: rndRange(`${cfg.seed}-streak-dx-${i}`, 30, 80),
        ay: rndRange(`${cfg.seed}-streak-dy-${i}`, 20, 60),
        k: rndInt(`${cfg.seed}-streak-k-${i}`, 1, 3),
        phase: rndRange(`${cfg.seed}-streak-p-${i}`, 0, Math.PI * 2),
        scale: rndRange(`${cfg.seed}-streak-s-${i}`, 1.5, 2.4),
      });
    }
    return out;
  }, [cfg]);

  useLayoutEffect(() => {
    const t = frame / DURATION;
    const ctx = beginWorld(buffers.far, drift);
    for (const s of streaks) {
      ctx.save();
      ctx.translate(
        s.x + s.ax * Math.sin(2 * Math.PI * s.k * t + s.phase),
        s.y + s.ay * Math.cos(2 * Math.PI * s.k * t + s.phase),
      );
      ctx.rotate(s.angle);
      ctx.globalAlpha = s.alpha;
      ctx.drawImage(
        s.sprite,
        (-STREAK_LEN * s.scale) / 2,
        (-STREAK_WIDTH * s.scale) / 2,
        STREAK_LEN * s.scale,
        STREAK_WIDTH * s.scale,
      );
      ctx.restore();
    }
  });

  return null;
};
