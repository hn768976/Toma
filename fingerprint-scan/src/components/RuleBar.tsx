/**
 * <RuleBar> — a thin horizontal line across the full width with small circular
 * nodes at irregular intervals. The nodes blink irregularly.
 */
import React, { useEffect, useRef } from "react";
import { useOffscreen, withAlpha } from "../shared/draw";
import { irregularPositions, rand } from "../shared/rng";
import { W } from "../layout";
import type { Palette } from "../variants";

const BAR_H = 60;
const NODES = 9;

export const RuleBar: React.FC<{
  y: number;
  palette: Palette;
  seed: string;
  frame: number;
}> = ({ y, palette, seed, frame }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const xs = irregularPositions(seed, NODES, 120, W - 120, 1.5);

  const line = useOffscreen(
    W,
    BAR_H,
    (ctx) => {
      ctx.strokeStyle = withAlpha(palette.panelBorder, 0.9);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, BAR_H / 2);
      ctx.lineTo(W, BAR_H / 2);
      ctx.stroke();
    },
    [palette.panelBorder],
  );

  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, BAR_H);
    ctx.drawImage(line, 0, 0);

    xs.forEach((x, i) => {
      // Each node has its own period and phase, so they never blink in unison.
      const period = 5 + Math.floor(rand(`${seed}-per-${i}`, 3, 14));
      const phase = Math.floor(rand(`${seed}-ph-${i}`, 0, 20));
      const bucket = Math.floor((frame + phase) / period);
      const on = rand(`${seed}-on-${i}-${bucket}`, 0, 1) > 0.42;
      const r = 8 + rand(`${seed}-r-${i}`, 0, 5);

      ctx.beginPath();
      ctx.arc(x, BAR_H / 2, r, 0, Math.PI * 2);
      ctx.fillStyle = on
        ? withAlpha(palette.textBright, 0.95)
        : withAlpha(palette.panelFill, 0.95);
      ctx.fill();
      ctx.strokeStyle = withAlpha(palette.panelBorder, on ? 1 : 0.7);
      ctx.lineWidth = 2.5;
      ctx.stroke();
    });
  });

  return (
    <canvas
      ref={ref}
      width={W}
      height={BAR_H}
      style={{ position: "absolute", left: 0, top: y - BAR_H / 2, width: W, height: BAR_H }}
    />
  );
};
