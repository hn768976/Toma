import React, { useMemo } from "react";
import type { ElementRenderProps, Measurer } from "../layout";
import { THEME } from "../theme";
import type { StrokeSet } from "../theme";
import {
  ctxOf,
  dot,
  hLine,
  loopPhase,
  makeCanvas,
  pick,
  rnd,
  rndInt,
  strokeRect,
  vLine,
} from "../draw/util";
import { HudCanvas } from "./canvas";
import { monoFont } from "../fonts";

const RULER_W = 130;
/** Where the spine sits inside the element's own box. */
const SPINE_X = 34;

export const measureSideRuler: Measurer = ({ config, scale, y }, _fw, frameHeight) => ({
  w: Math.round(RULER_W * scale),
  h: Math.round(((config.y2 ?? 0.75) - y) * frameHeight),
});

const STEPS = [26, 34, 42, 58, 70] as const;

const renderStatic = (
  w: number,
  h: number,
  scale: number,
  stroke: StrokeSet,
  seed: string,
) => {
  const canvas = makeCanvas(w, h);
  const ctx = ctxOf(canvas);
  const x = SPINE_X * scale;

  ctx.strokeStyle = THEME.dim;
  ctx.lineWidth = stroke.structure;
  vLine(ctx, x, 0, h);

  ctx.font = monoFont(Math.round(15 * scale));
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  let y = pick(`${seed}-y0`, STEPS) * scale;
  let i = 0;
  while (y < h - 8 * scale && i < 400) {
    const long = rnd(`${seed}-l-${i}`) < 0.36;
    const len = (long ? 30 : 14) * scale;
    ctx.strokeStyle = long ? THEME.mid : THEME.dim;
    hLine(ctx, x, x + len, y);

    if (long && rnd(`${seed}-t-${i}`) < 0.62) {
      ctx.fillStyle = THEME.textDim;
      ctx.globalAlpha = 0.8;
      ctx.fillText(
        String(rndInt(`${seed}-n-${i}`, 100, 999)),
        x + len + 8 * scale,
        y,
      );
      ctx.globalAlpha = 1;
    }

    y += pick(`${seed}-s-${i}`, STEPS) * scale;
    i++;
  }

  return canvas;
};

export const SideRuler: React.FC<ElementRenderProps> = ({
  frame,
  scale,
  stroke,
  config,
  width,
  height,
  dimmed,
}) => {
  const chrome = useMemo(
    () => renderStatic(width, height, scale, stroke, config.seed),
    [width, height, scale, stroke, config.seed],
  );

  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.globalAlpha = dimmed ? 0.3 : 1;
    ctx.drawImage(chrome, 0, 0);

    // A single marker, easing to each end and back so the loop closes without
    // a jump.
    const t = 0.5 - 0.5 * Math.cos(loopPhase(frame) * Math.PI * 2);
    const x = SPINE_X * scale;
    const y = 12 * scale + t * (height - 24 * scale);

    ctx.strokeStyle = THEME.bright;
    ctx.lineWidth = stroke.emphasis;
    hLine(ctx, x - 14 * scale, x + 26 * scale, y);
    ctx.fillStyle = THEME.bright;
    dot(ctx, x, y, 4.5 * scale);
    ctx.lineWidth = stroke.structure;
    ctx.strokeStyle = THEME.mid;
    strokeRect(ctx, x + 32 * scale, y - 7 * scale, 14 * scale, 14 * scale);

    ctx.globalAlpha = 1;
  };

  return <HudCanvas width={width} height={height} draw={draw} />;
};
