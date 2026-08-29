import React from "react";
import { BORDER_W, FONT, PROGRESS_STRIP } from "../layout";
import { MONO, SANS } from "../fonts";
import type { FrameState } from "../lib/frame";
import { resetCtx, setFont, strokeRect, withAlpha } from "../lib/canvas";
import { pad } from "../lib/rand";

/** 150 frames divides 600 exactly, so the fill resets four times per loop. */
const CYCLE = 150;

/** The narrow strip at the foot of the left column, with a percentage. */
export const ProgressStrip: React.FC<{ state: FrameState }> = ({ state }) => {
  const { ctx, cfg, frame } = state;
  const p = cfg.palette;
  const r = PROGRESS_STRIP;

  resetCtx(ctx);
  ctx.fillStyle = cfg.palette.panelFill;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  strokeRect(ctx, r, withAlpha(p.panelBorder, 0.8), BORDER_W);

  const t = (frame % CYCLE) / CYCLE;
  const barX = r.x + 96;
  const barW = r.w - 96 - 150;
  const barY = r.y + r.h / 2 - 9;

  ctx.fillStyle = withAlpha(p.gridLine, 1);
  ctx.fillRect(barX, barY, barW, 18);
  ctx.fillStyle = withAlpha(p.trace, 0.9);
  ctx.fillRect(barX, barY, barW * t, 18);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = withAlpha(p.trace, 0.22);
  ctx.fillRect(barX, barY - 6, barW * t, 30);
  ctx.restore();

  ctx.textBaseline = "middle";
  setFont(ctx, { family: SANS, size: FONT.tableTitle, weight: 500 }, 2);
  ctx.fillStyle = withAlpha(p.text, 0.9);
  ctx.fillText(cfg.labels.progressLabel, r.x + 24, r.y + r.h / 2);

  setFont(ctx, { family: MONO, size: FONT.tableTitle, weight: 500 }, 1);
  ctx.textAlign = "right";
  ctx.fillStyle = withAlpha(p.tracePale, 0.95);
  ctx.fillText(`${pad(t * 100, 2)}%`, r.x + r.w - 26, r.y + r.h / 2);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  return null;
};
