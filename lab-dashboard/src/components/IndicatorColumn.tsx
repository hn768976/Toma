import React from "react";
import { FONT, INDICATOR_PANELS, STRIP_H } from "../layout";
import { MONO } from "../fonts";
import type { FrameState } from "../lib/frame";
import { resetCtx, setFont, withAlpha } from "../lib/canvas";
import { LOOPING_PERIODS, epochAt } from "../lib/schedule";
import { rnd, rndInt } from "../lib/rand";

const CIRCLE_COLS = 6;
const CIRCLE_R = 26;

/**
 * The far-right control column: rows of small circular indicators over short
 * bar strips, running off the right edge of the frame so the console reads as
 * continuing off-screen. The circles blink on irregular, looping periods.
 */
export const IndicatorColumn: React.FC<{ state: FrameState; index: number }> = ({
  state,
  index,
}) => {
  const { ctx, cfg, frame } = state;
  const p = cfg.palette;
  const r = INDICATOR_PANELS[index];

  resetCtx(ctx);
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x + 4, r.y + STRIP_H + 4, r.w - 8, r.h - STRIP_H - 8);
  ctx.clip();

  const top = r.y + STRIP_H + 34;
  const bandH = (r.h - STRIP_H - 46) / 2;
  const colW = (r.w - 60) / CIRCLE_COLS;

  for (let band = 0; band < 2; band++) {
    const by = top + band * bandH;
    for (let c = 0; c < CIRCLE_COLS; c++) {
      const id = `${index}-${band}-${c}`;
      const period = LOOPING_PERIODS[(index + band * 2 + c * 3) % LOOPING_PERIODS.length];
      const epoch = epochAt(frame, period, (c * 47 + band * 23 + index * 13) % period);
      const lit = rnd(`ic-${id}-${epoch}`) > 0.42;
      const cx = r.x + 44 + c * colW;
      const cyc = by + CIRCLE_R + 12;

      ctx.strokeStyle = withAlpha(p.panelBorder, lit ? 1 : 0.5);
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(cx, cyc, CIRCLE_R, 0, Math.PI * 2);
      ctx.stroke();
      if (lit) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = withAlpha(p.trace, 0.16);
        ctx.beginPath();
        ctx.arc(cx, cyc, CIRCLE_R * 1.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      setFont(ctx, { family: MONO, size: FONT.indicator, weight: 500 }, 0);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = withAlpha(lit ? p.tracePale : p.text, lit ? 1 : 0.55);
      ctx.fillText(String(rndInt(`ic-n-${id}`, 1, 9)), cx, cyc + 1);

      // The short bar strip under each circle.
      for (let bar = 0; bar < 3; bar++) {
        const on = rnd(`ic-b-${id}-${bar}-${epoch}`) > 0.35;
        ctx.fillStyle = withAlpha(p.panelBorder, on ? 0.95 : 0.35);
        ctx.fillRect(cx - 34, cyc + CIRCLE_R + 30 + bar * 21, 68, 8);
      }
    }
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.restore();
  return null;
};
