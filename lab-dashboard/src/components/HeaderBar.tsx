import React from "react";
import { FONT, HEADER, HEADER_RULE_Y, WIDTH } from "../layout";
import { SANS } from "../fonts";
import type { FrameState } from "../lib/frame";
import { resetCtx, setFont, withAlpha } from "../lib/canvas";

/**
 * The thin full-width bar across the top. Section labels repeat across it and
 * run off both edges, so the frame reads as a crop of a wider console.
 */
export const HeaderBar: React.FC<{ state: FrameState }> = ({ state }) => {
  const { ctx, cfg } = state;
  const p = cfg.palette;
  const sections = cfg.labels.headerSections;

  resetCtx(ctx);
  ctx.fillStyle = withAlpha(p.panelBorder, 0.22);
  ctx.fillRect(HEADER.x, HEADER.y, HEADER.w, HEADER.h);

  ctx.fillStyle = withAlpha(p.panelBorder, 0.55);
  ctx.fillRect(0, HEADER_RULE_Y, WIDTH, 2);

  setFont(ctx, { family: SANS, size: FONT.header, weight: 500 }, 5);
  ctx.textBaseline = "middle";
  ctx.fillStyle = withAlpha(p.tracePale, 0.88);

  // One group of sections, repeated at a wide pitch and started off the left
  // edge, so the bar reads as a crop of a much wider console.
  const gap = 128;
  const pitch = 1560;
  for (let group = -1; group * pitch < WIDTH + pitch; group++) {
    let x = -104 + group * pitch;
    for (const label of sections) {
      if (x > -260 && x < WIDTH + 40) ctx.fillText(label, x, HEADER.h / 2 + 1);
      x += ctx.measureText(label).width + gap;
    }
  }
  ctx.textBaseline = "alphabetic";

  return null;
};
