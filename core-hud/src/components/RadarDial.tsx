import React, { useMemo } from "react";
import type { ElementRenderProps, Measurer } from "../layout";
import { THEME } from "../theme";
import type { StrokeSet } from "../theme";
import {
  circle,
  ctxOf,
  cycleIndex,
  dot,
  line,
  loopPhase,
  makeCanvas,
  rndInt,
  rndRange,
} from "../draw/util";
import { HudCanvas } from "./canvas";
import { monoFont } from "../fonts";

const DIAL_R = 210;
export const DIAL_BOX = 460;

export const measureRadarDial: Measurer = ({ scale }) => ({
  w: Math.round(DIAL_BOX * scale),
  h: Math.round(DIAL_BOX * scale),
});

const renderStatic = (
  size: number,
  scale: number,
  stroke: StrokeSet,
  seed: string,
) => {
  const canvas = makeCanvas(size, size);
  const ctx = ctxOf(canvas);
  const c = size / 2;
  const r = DIAL_R * scale;

  // A fine square grid, clipped to the circle.
  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, r - stroke.structure, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = THEME.faint;
  ctx.lineWidth = stroke.structure;
  const step = 26 * scale;
  for (let g = -r; g <= r; g += step) {
    line(ctx, c + g, c - r, c + g, c + r);
    line(ctx, c - r, c + g, c + r, c + g);
  }
  ctx.restore();

  ctx.strokeStyle = THEME.mid;
  ctx.lineWidth = stroke.emphasis;
  circle(ctx, c, c, r);

  // Fixed scatter, one of them brighter than the rest.
  for (let i = 0; i < 6; i++) {
    const a = rndRange(`${seed}-da-${i}`, 0, Math.PI * 2);
    const d = rndRange(`${seed}-dd-${i}`, 0.2, 0.88) * r;
    ctx.fillStyle = i === 2 ? THEME.bright : THEME.dim;
    dot(ctx, c + Math.cos(a) * d, c + Math.sin(a) * d, (i === 2 ? 5 : 3.5) * scale);
    if (i === 2) {
      ctx.strokeStyle = THEME.dim;
      ctx.lineWidth = stroke.structure;
      circle(ctx, c + Math.cos(a) * d, c + Math.sin(a) * d, 13 * scale);
    }
  }

  return canvas;
};

export const RadarDial: React.FC<ElementRenderProps> = ({
  frame,
  scale,
  stroke,
  config,
  width,
  height,
  dimmed,
}) => {
  const size = Math.round(DIAL_BOX * scale);
  const chrome = useMemo(
    () => renderStatic(size, scale, stroke, config.seed),
    [size, scale, stroke, config.seed],
  );

  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.globalAlpha = dimmed ? 0.3 : 1;
    ctx.drawImage(chrome, 0, 0);

    const c = size / 2;
    const r = DIAL_R * scale;

    // One tick on the circumference, one full turn per loop.
    const a = loopPhase(frame) * Math.PI * 2 - Math.PI / 2;
    ctx.strokeStyle = THEME.bright;
    ctx.lineWidth = stroke.emphasis;
    line(
      ctx,
      c + Math.cos(a) * (r - 20 * scale),
      c + Math.sin(a) * (r - 20 * scale),
      c + Math.cos(a) * (r + 14 * scale),
      c + Math.sin(a) * (r + 14 * scale),
    );
    ctx.fillStyle = THEME.bright;
    dot(ctx, c + Math.cos(a) * r, c + Math.sin(a) * r, 4 * scale);

    // The only colour in the frame: this readout and its two marker blocks.
    const idx = cycleIndex(frame, 100, 0);
    const value = rndInt(`${config.seed}-v-${idx}`, 10, 99);
    ctx.fillStyle = THEME.accent;
    ctx.font = monoFont(Math.round(30 * scale), 500);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const tx = c - r * 0.44;
    const ty = c - r * 0.06;
    ctx.fillText(`x${value}`, tx, ty);

    const bw = 13 * scale;
    for (let i = 0; i < 3; i++) {
      const on = rndInt(`${config.seed}-b-${idx}-${i}`, 0, 1) === 1;
      if (on) {
        ctx.fillRect(Math.round(tx + i * (bw + 4 * scale)), Math.round(ty + 9 * scale), Math.round(bw), Math.round(5 * scale));
      } else {
        ctx.strokeStyle = THEME.accent;
        ctx.lineWidth = stroke.structure;
        ctx.strokeRect(Math.round(tx + i * (bw + 4 * scale)) + 0.5, Math.round(ty + 9 * scale) + 0.5, Math.round(bw), Math.round(5 * scale));
      }
    }

    ctx.globalAlpha = 1;
  };

  return <HudCanvas width={width} height={height} draw={draw} />;
};
