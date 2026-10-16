import React, { useCallback } from "react";
import { CanvasStage, DrawInfo, LH, LW } from "../../lib/CanvasStage";
import { INTER } from "../../lib/fonts";
import { clamp01, easeInOutCubic, easeOutBack, easeOutCubic, smoothstep } from "../../lib/random";
import { GHOSTS, LINKS, NODES, NODE_PHASE, PULSES, SPECKS } from "./graph";
import { NetworkVersion } from "./versions";

const COUNTER_END = 2088;
const fmt = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const drawPerson = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => {
  ctx.beginPath();
  ctx.arc(x, y - r * 0.26, r * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - r * 0.5, y + r * 0.52);
  ctx.bezierCurveTo(x - r * 0.5, y + r * 0.08, x - r * 0.24, y + r * 0.04, x, y + r * 0.04);
  ctx.bezierCurveTo(x + r * 0.24, y + r * 0.04, x + r * 0.5, y + r * 0.08, x + r * 0.5, y + r * 0.52);
  ctx.closePath();
  ctx.fill();
};

export const NetworkGrowth: React.FC<{ v: NetworkVersion }> = ({ v }) => {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, { frame, fps }: DrawInfo) => {
      const t = frame / fps;
      ctx.fillStyle = v.background;
      ctx.fillRect(0, 0, LW, LH);

      // Camera: slow zoom out while growing, then a gentle drift + breathing.
      const grow = easeInOutCubic(clamp01((t - 0.5) / 13.5));
      const hold = smoothstep(13.5, 15.5, t);
      const z = (1.45 - 0.45 * grow) * (1 + 0.008 * hold * Math.sin(((t - 14) / 6) * Math.PI * 2));
      const cx = 665 + 6 * Math.sin((t / 20) * Math.PI * 2);
      const cy = 300 + 4 * Math.sin((t / 20) * Math.PI * 4 + 1);

      const pos = (i: number) => {
        const n = NODES[i];
        const ph = NODE_PHASE[i];
        const wob = i === 0 ? 0 : 1.4 * (0.35 + 0.65 * hold);
        return [cx + n.x * z + wob * Math.sin(t * 0.9 + ph[0]), cy + n.y * z + wob * Math.sin(t * 0.7 + ph[1])] as const;
      };

      // Links.
      ctx.lineCap = "round";
      for (const l of LINKS) {
        const p = clamp01((t - l.t0) / (l.t1 - l.t0));
        if (p <= 0) continue;
        const e = easeOutCubic(p);
        const [ax, ay] = pos(l.a);
        const [bx, by] = pos(l.b);
        ctx.strokeStyle = l.dashed ? v.dashed : v.line;
        ctx.globalAlpha = l.dashed ? 0.85 : 0.9;
        ctx.lineWidth = l.a === 0 ? 2 : 1.7;
        ctx.setLineDash(l.dashed ? [7, 5] : []);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax + (bx - ax) * e, ay + (by - ay) * e);
        ctx.stroke();
        if (p < 1) {
          // spark at the tip of a growing line
          ctx.globalAlpha = 1;
          ctx.fillStyle = v.badges[0];
          ctx.beginPath();
          ctx.arc(ax + (bx - ax) * e, ay + (by - ay) * e, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Pulses during the hold.
      const pulseA = smoothstep(14, 15, t);
      if (pulseA > 0) {
        ctx.fillStyle = v.badges[0];
        for (const pu of PULSES) {
          const u = (pu.phase + (t - 14) * pu.speed) % 1;
          const [ax, ay] = pos(pu.link.a);
          const [bx, by] = pos(pu.link.b);
          ctx.globalAlpha = pulseA * Math.sin(u * Math.PI);
          ctx.beginPath();
          ctx.arc(ax + (bx - ax) * u, ay + (by - ay) * u, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // A few loose dots and hollow rings.
      for (const s of SPECKS) {
        const a = smoothstep(s.t, s.t + 0.6, t);
        if (a <= 0) continue;
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(cx + s.x * z, cy + s.y * z + 3 * Math.sin(t * 0.6 + s.x), s.ring ? s.r * 0.7 : s.r, 0, Math.PI * 2);
        if (s.ring) {
          ctx.strokeStyle = v.line;
          ctx.lineWidth = 1.3;
          ctx.stroke();
        } else {
          ctx.fillStyle = v.badges[s.shade];
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // Ghosted badges (half transparent, may overlap).
      for (const g of GHOSTS) {
        const p = (t - g.t) / 0.5;
        if (p <= 0) continue;
        const r = g.r * z * easeOutBack(p, 1.3);
        ctx.globalAlpha = g.alpha * (0.75 + 0.25 * Math.sin(t * 0.8 + g.x));
        ctx.fillStyle = v.badges[2];
        ctx.beginPath();
        ctx.arc(cx + g.x * z, cy + g.y * z, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = v.pictogram;
        drawPerson(ctx, cx + g.x * z, cy + g.y * z, r);
      }
      ctx.globalAlpha = 1;

      // Badges.
      for (let i = NODES.length - 1; i >= 0; i--) {
        const n = NODES[i];
        const p = (t - n.t) / 0.38;
        if (p <= 0) continue;
        const s = easeOutBack(p, 1.5);
        const [x, y] = pos(i);
        const breathe = 1 + 0.025 * hold * Math.sin(t * 1.6 + NODE_PHASE[i][0]);
        const r = n.r * z * s * breathe;
        if (r <= 0.2) continue;
        ctx.fillStyle = v.badges[n.shade];
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = v.pictogram;
        drawPerson(ctx, x, y, r);
      }

      // Counter.
      const cval = Math.round(1 + (COUNTER_END - 1) * easeInOutCubic(clamp01((t - 0.3) / 13.7)));
      const [x0, y0] = pos(0);
      ctx.fillStyle = v.counter;
      ctx.font = `400 24px ${INTER}`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      ctx.fillText(fmt(cval), x0 + NODES[0].r * z + 3, y0 - 1);
    },
    [v],
  );
  return <CanvasStage draw={draw} post={{ grain: v.grain }} />;
};
