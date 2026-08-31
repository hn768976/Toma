import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { hexToRgb, rgba } from "./color";
import { buildDots, type Dot } from "./geometry";
import { useCanvasLayer } from "./hooks";
import { HEIGHT, WIDTH, ambientDrift, type Flow } from "./layout";
import { TAU, clamp } from "./math";
import type { VariantConfig } from "./variants";

/** Above this brightness a dot gets a little bloom of its own. */
const BLOOM_ABOVE = 0.72;
/** Bloom is a pre-rendered sprite: a shadowBlur per dot is far too slow. */
const SPRITE_SIZE = 64;
const SPRITE_SPREAD = 1.9;

const spriteCache = new Map<string, HTMLCanvasElement>();

const glowSprite = (hex: string): HTMLCanvasElement => {
  const cached = spriteCache.get(hex);
  if (cached) {
    return cached;
  }
  const canvas = document.createElement("canvas");
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const rgb = hexToRgb(hex);
    const half = SPRITE_SIZE / 2;
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
    gradient.addColorStop(0, rgba(rgb, 0.6));
    gradient.addColorStop(0.3, rgba(rgb, 0.18));
    gradient.addColorStop(1, rgba(rgb, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  }
  spriteCache.set(hex, canvas);
  return canvas;
};

/**
 * Most dots breathe gently; a seeded few flash hard, a couple of times a
 * second across the whole field. Every period divides 600.
 */
const flickerAt = (dot: Dot, frame: number): number => {
  const s = 0.5 + 0.5 * Math.sin(TAU * ((frame % 600) / dot.period + dot.phase));
  if (dot.flash) {
    return dot.base * (0.14 + 2.9 * s ** 14);
  }
  return dot.base * (0.42 + 0.58 * s);
};

export const DotField: React.FC<{
  readonly config: VariantConfig;
  readonly flow: Flow;
}> = ({ config, flow }) => {
  const frame = useCurrentFrame();
  const dots = useMemo(() => buildDots(config, flow), [config, flow]);
  const sprites = useMemo(
    () => config.palette.dotHues.map(glowSprite),
    [config],
  );
  const solid = useMemo(
    () => config.palette.dotHues.map((hex) => rgba(hexToRgb(hex), 1)),
    [config],
  );

  const ref = useCanvasLayer(WIDTH, HEIGHT, (ctx) => {
    const drift = ambientDrift(frame);
    ctx.translate(drift.dx, drift.dy);
    ctx.globalCompositeOperation = "lighter";

    for (const dot of dots) {
      const level = flickerAt(dot, frame);
      const alpha = clamp(level, 0, 1);
      if (alpha < 0.02) {
        continue;
      }
      const bright = level > BLOOM_ABOVE;
      const size = dot.size * (bright ? 1.15 : 1);
      if (bright) {
        const radius = size * SPRITE_SPREAD;
        ctx.globalAlpha = alpha * 0.7;
        ctx.drawImage(
          sprites[dot.hue],
          dot.x - radius,
          dot.y - radius,
          radius * 2,
          radius * 2,
        );
      }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = solid[dot.hue];
      ctx.fillRect(dot.x - size / 2, dot.y - size / 2, size, size);
    }
    ctx.globalAlpha = 1;
  });

  return (
    <canvas
      ref={ref}
      width={WIDTH}
      height={HEIGHT}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: WIDTH,
        height: HEIGHT,
        mixBlendMode: "screen",
      }}
    />
  );
};
