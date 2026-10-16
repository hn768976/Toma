import React, { useCallback } from "react";
import { CanvasStage, DrawInfo, LH, LW } from "../../lib/CanvasStage";
import { INTER, MONO } from "../../lib/fonts";
import { clamp01, easeInOutCubic, easeOutBack, easeOutCubic } from "../../lib/random";
import { TimelineVersion } from "./versions";

// Geometry in 1280x720 logical px (matches the reference proportions).
const Y = 360;
const X0 = 210;
const X1 = 1080;
const NODE_X = [362, 476, 590, 704, 818, 932];
const NODE_R = 12;
const STEM = 44;
const HATCHED = [true, false, true, false, false, false];
const DASH = [57, 63, 40, 66, 80, 30];
const LW_LINE = 1.5;

const typed = (s: string, p: number) => s.slice(0, Math.round(s.length * clamp01(p)));

export const TimelineHUD: React.FC<{ v: TimelineVersion }> = ({ v }) => {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, { frame, fps }: DrawInfo) => {
      const t = frame / fps;
      // Exactly black, no grain: made for Screen / Add blend modes.
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, LW, LH);
      ctx.strokeStyle = v.ink;
      ctx.fillStyle = v.ink;
      ctx.lineWidth = LW_LINE;
      ctx.lineCap = "butt";

      // 1-4s: the line draws left to right.
      const lp = easeInOutCubic(clamp01((t - 1) / 3));
      if (lp <= 0) return;
      const xHead = X0 + (X1 - X0) * lp;
      const gapAt = (x: number) => x; // line passes behind node rings (we clear inside the rings)
      ctx.beginPath();
      ctx.moveTo(X0, Y);
      ctx.lineTo(gapAt(xHead), Y);
      ctx.stroke();

      // Arrowheads at both ends.
      const arrow = (x: number, dir: number, a: number) => {
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.moveTo(x + dir * 7, Y);
        ctx.lineTo(x - dir * 1, Y - 4);
        ctx.lineTo(x - dir * 1, Y + 4);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      };
      arrow(X0 - 6, -1, clamp01((t - 1) / 0.25));
      if (lp >= 0.999) arrow(X1 + 6, 1, 1);
      else {
        ctx.beginPath();
        ctx.arc(xHead, Y, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      NODE_X.forEach((nx, i) => {
        const reach = 1 + 3 * easeInOutCubicInv((nx - X0) / (X1 - X0));
        const pop = (t - reach) / 0.35;
        if (pop <= 0) return;
        // Pulse once in sequence during the hold.
        const pulseT = (t - (7.4 + i * 0.25)) / 0.6;
        const pulse = pulseT > 0 && pulseT < 1 ? Math.sin(pulseT * Math.PI) : 0;
        const r = NODE_R * easeOutBack(pop, 1.6) * (1 + 0.25 * pulse);
        // clear the line inside the node
        ctx.fillStyle = "#000000";
        ctx.beginPath();
        ctx.arc(nx, Y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = v.ink;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(nx, Y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = LW_LINE;
        if (HATCHED[i]) {
          // hatched node: a few thick, widely spaced stripes
          ctx.save();
          ctx.beginPath();
          ctx.arc(nx, Y, r - 2.5, 0, Math.PI * 2);
          ctx.clip();
          ctx.lineWidth = 2;
          for (let k = -2; k <= 2; k++) {
            ctx.beginPath();
            ctx.moveTo(nx + k * 4.6 - r, Y + r);
            ctx.lineTo(nx + k * 4.6 + r, Y - r);
            ctx.stroke();
          }
          ctx.restore();
          ctx.lineWidth = LW_LINE;
        } else {
          ctx.globalAlpha = 0.85;
          ctx.beginPath();
          ctx.arc(nx, Y, r * 0.56, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        if (pulse > 0) {
          ctx.globalAlpha = 0.6 * (1 - pulseT);
          ctx.beginPath();
          ctx.arc(nx, Y, NODE_R * (1 + 1.2 * pulseT), 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // 3-7s: stems draw and labels type in, node by node.
        const s0 = 3 + i * 0.6;
        const sp = easeOutCubic(clamp01((t - s0) / 0.45));
        if (sp <= 0) return;
        const up = i % 2 === 0 ? -1 : 1;
        const yA = Y + up * (NODE_R + 1);
        const yB = Y + up * (NODE_R + STEM);
        ctx.beginPath();
        ctx.moveTo(nx, yA);
        ctx.lineTo(nx, yA + (yB - yA) * sp);
        ctx.stroke();

        const lp2 = clamp01((t - s0 - 0.35) / 1.1);
        if (lp2 <= 0) return;
        const step = v.steps[i];
        // label block sits beside the stem end
        const by = up < 0 ? yB : yB + 12;
        // stripe icon (borderless) just right of the stem end
        ctx.save();
        ctx.globalAlpha = clamp01(lp2 * 4);
        ctx.beginPath();
        ctx.rect(nx + 1, by - 13, 14, 14);
        ctx.clip();
        ctx.lineWidth = 2.6;
        for (let k = -2; k <= 2; k++) {
          ctx.beginPath();
          ctx.moveTo(nx + 1 + k * 5.5, by + 1);
          ctx.lineTo(nx + 15 + k * 5.5, by - 13);
          ctx.stroke();
        }
        ctx.restore();
        ctx.textBaseline = "alphabetic";
        ctx.textAlign = "left";
        ctx.font = `500 15px ${INTER}`;
        ctx.fillText(typed(step.num, lp2 * 3), nx + 19, by + 1);
        ctx.font = `500 7.5px ${INTER}`;
        ctx.fillText(typed(step.title.toUpperCase(), (lp2 - 0.15) * 2), nx + 41, by - 6);
        ctx.font = `400 5.5px ${MONO}`;
        ctx.globalAlpha = 0.75;
        ctx.fillText(typed(step.sub, (lp2 - 0.35) * 1.6), nx + 41, by + 1);
        ctx.globalAlpha = 1;
        // dash beside the node
        const ul = easeOutCubic(clamp01((lp2 - 0.2) * 2));
        const uy = up < 0 ? Y - 9 : Y + 9;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.moveTo(nx + NODE_R + 4, uy);
        ctx.lineTo(nx + NODE_R + 4 + DASH[i] * ul, uy);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.lineWidth = LW_LINE;
      });
    },
    [v],
  );
  return <CanvasStage draw={draw} post={{ grain: 0 }} />;
};

// Time (0..1) at which the eased line head reaches fraction u.
function easeInOutCubicInv(u: number) {
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 30; k++) {
    const mid = (lo + hi) / 2;
    if (easeInOutCubic(mid) < u) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
