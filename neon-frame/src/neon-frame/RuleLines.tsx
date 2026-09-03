/**
 * Two thin, dim horizontal rules running the full composition width, one above
 * and one below the plate, with small tick marks at irregular intervals.
 *
 * Only the wide-bar variant uses these: a 5:1 bar has almost no vertical
 * extent of its own, and the rules give it the horizontal context it otherwise
 * lacks.
 */
import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { HEIGHT, WIDTH, layerStyle, loopedFrame } from "./constants";
import { TAU, rgba, useCanvas2D } from "../lib/canvas";
import { rand01, randRange } from "../lib/random";
import type { Palette, RuleLinesConfig } from "./variants";

type Tick = { x: number; length: number; alpha: number };

const buildTicks = (config: RuleLinesConfig, seedKey: string): Tick[] => {
  // Irregular intervals: a random gap walk normalised back to the full width.
  const gaps: number[] = [];
  let total = 0;
  for (let i = 0; i < config.tickCount; i++) {
    const gap = randRange(`${seedKey}-tick-gap-${i}`, 0.3, 2.1);
    gaps.push(gap);
    total += gap;
  }
  const unit = WIDTH / total;
  const ticks: Tick[] = [];
  let cursor = 0;
  for (let i = 0; i < config.tickCount; i++) {
    cursor += gaps[i] * unit;
    ticks.push({
      x: cursor,
      length: randRange(`${seedKey}-tick-len-${i}`, 10, 34),
      alpha: randRange(`${seedKey}-tick-a-${i}`, 0.4, 1),
    });
  }
  return ticks;
};

export const RuleLines: React.FC<{
  config: RuleLinesConfig;
  palette: Palette;
  seedKey: string;
}> = ({ config, palette, seedKey }) => {
  const frame = useCurrentFrame();
  const f = loopedFrame(frame);
  const ticks = useMemo(() => buildTicks(config, seedKey), [config, seedKey]);

  const ref = useCanvas2D((ctx) => {
    const offset = config.offsetFraction * HEIGHT;
    const rows = [HEIGHT / 2 - offset, HEIGHT / 2 + offset];

    // A very slow breathe, one whole cycle per loop.
    const breathe = 0.85 + 0.15 * Math.cos(TAU * (f / 360));

    ctx.globalCompositeOperation = "lighter";
    for (let r = 0; r < rows.length; r++) {
      const y = rows[r];

      const gradient = ctx.createLinearGradient(0, 0, WIDTH, 0);
      gradient.addColorStop(0, rgba(palette.frameLine, 0));
      gradient.addColorStop(0.12, rgba(palette.frameLine, config.opacity));
      gradient.addColorStop(0.5, rgba(palette.frameLine, config.opacity * 0.55));
      gradient.addColorStop(0.88, rgba(palette.frameLine, config.opacity));
      gradient.addColorStop(1, rgba(palette.frameLine, 0));

      ctx.strokeStyle = gradient;
      ctx.lineWidth = config.thickness;
      ctx.globalAlpha = breathe;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WIDTH, y);
      ctx.stroke();

      for (const tick of ticks) {
        // Ticks alternate which side of the rule they hang from.
        const up = rand01(`${seedKey}-tick-side-${r}-${tick.x}`) > 0.5 ? -1 : 1;
        ctx.globalAlpha = breathe * tick.alpha;
        ctx.strokeStyle = rgba(palette.frameLine, config.opacity * 1.6);
        ctx.lineWidth = config.thickness;
        ctx.beginPath();
        ctx.moveTo(tick.x, y);
        ctx.lineTo(tick.x, y + up * tick.length);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  });

  return <canvas ref={ref} width={WIDTH} height={HEIGHT} style={layerStyle} />;
};
