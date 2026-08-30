import React, { useMemo } from "react";
import type { ElementRenderProps, Measurer } from "../layout";
import { THEME } from "../theme";
import type { StrokeSet } from "../theme";
import {
  ctxOf,
  loopPhase,
  makeCanvas,
  pick,
  rnd,
} from "../draw/util";
import { HudCanvas } from "./canvas";
import { monoFont } from "../fonts";

const STRIP_H = 32;

export const measureBarStrip: Measurer = ({ scale }, frameWidth) => ({
  w: frameWidth,
  h: Math.round(STRIP_H * scale),
});

const WIDTHS = [6, 9, 12, 16, 20, 26, 34, 42] as const;
const GAPS = [4, 6, 8, 11, 15, 20] as const;
const GLYPHS = ["0", "1", "7", "A", "F", "X", "#", "%", ":"] as const;

/**
 * A data tape rather than a barcode: widths, gaps, heights and fills are all
 * drawn from different pools, so no repeating cadence emerges. The tile is
 * exactly one frame wide, so scrolling it by its own width across the loop
 * closes seamlessly and never shows the same run twice on screen.
 */
const renderTile = (
  tileWidth: number,
  h: number,
  scale: number,
  stroke: StrokeSet,
  seed: string,
) => {
  const canvas = makeCanvas(tileWidth, h);
  const ctx = ctxOf(canvas);
  ctx.font = monoFont(Math.round(17 * scale), 500);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  let x = 0;
  let i = 0;
  while (i < 4000) {
    const w = Math.round(pick(`${seed}-w-${i}`, WIDTHS) * scale);
    if (x + w > tileWidth) {
      break;
    }

    const roll = rnd(`${seed}-r-${i}`);
    const hMul = pick(`${seed}-h-${i}`, [1, 1, 0.62, 0.4, 0.78] as const);
    const bh = Math.round(h * hMul);
    const align = pick(`${seed}-v-${i}`, ["top", "bottom", "mid", "mid"] as const);
    const y =
      align === "top" ? 0 : align === "bottom" ? h - bh : Math.round((h - bh) / 2);

    if (roll < 0.07) {
      ctx.fillStyle = THEME.mid;
      ctx.globalAlpha = 0.8;
      ctx.fillText(pick(`${seed}-g-${i}`, GLYPHS), x, h / 2);
      ctx.globalAlpha = 1;
    } else if (roll < 0.42) {
      ctx.fillStyle = rnd(`${seed}-c-${i}`) < 0.25 ? THEME.bright : THEME.mid;
      ctx.fillRect(x, y, w, bh);
    } else if (roll < 0.68) {
      ctx.strokeStyle = THEME.dim;
      ctx.lineWidth = stroke.structure;
      ctx.strokeRect(x + 0.5 * (stroke.structure % 2), y + 0.5 * (stroke.structure % 2), w, bh);
    } else if (roll < 0.86) {
      ctx.fillStyle = THEME.dim;
      ctx.fillRect(x, y, w, bh);
    } else {
      // A pair of hairlines reading as a split block.
      ctx.strokeStyle = THEME.mid;
      ctx.lineWidth = stroke.structure;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, y);
      ctx.lineTo(x + 0.5, y + bh);
      ctx.moveTo(x + w - 0.5, y);
      ctx.lineTo(x + w - 0.5, y + bh);
      ctx.stroke();
    }

    x += w + Math.round(pick(`${seed}-gp-${i}`, GAPS) * scale);
    i++;
  }

  return canvas;
};

export const BarStrip: React.FC<ElementRenderProps> = ({
  frame,
  scale,
  stroke,
  config,
  width,
  height,
  dimmed,
}) => {
  const tile = useMemo(
    () => renderTile(width, height, scale, stroke, config.seed),
    [width, height, scale, stroke, config.seed],
  );

  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.globalAlpha = dimmed ? 0.3 : 1;
    // One tile width of travel across the loop, so frame 600 lands on frame 0.
    const offset = Math.round(loopPhase(frame) * width);
    ctx.drawImage(tile, -offset, 0);
    ctx.drawImage(tile, width - offset, 0);
    ctx.globalAlpha = 1;
  };

  return <HudCanvas width={width} height={height} draw={draw} />;
};
