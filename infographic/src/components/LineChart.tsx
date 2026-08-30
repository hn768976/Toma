import React, { useMemo } from "react";
import type { PanelSpec } from "../layout";
import { spring } from "remotion";
import { makeCanvas, rndInt, rndRange, type Ctx } from "../draw/primitives";
import { clearGlow, drawPanelHeading, withGlow } from "../draw/chrome";
import { usePanelPainter, usePlane } from "./PlaneContext";

type NodeShape = "disc" | "ring" | "square";
const SHAPES: NodeShape[] = ["disc", "ring", "square"];

/** How long a node marker takes to settle once the line reaches it. */
const POP_FRAMES = 10;

type Series = {
  tone: string;
  shape: NodeShape;
  points: { x: number; y: number }[];
  cum: number[];
  total: number;
};

export const LineChart: React.FC<{ panel: PanelSpec }> = ({ panel }) => {
  const { variant } = usePlane();
  const scale = variant.contentScale;

  const top = 70 * scale;
  const plotTop = top + 18 * scale;
  const plotBottom = panel.h - 22 * scale;
  const plotH = plotBottom - plotTop;

  const series: Series[] = useMemo(() => {
    const count = rndInt(`${panel.seed}-s`, 2, 3);
    const pointCount = Math.max(
      7,
      Math.min(16, Math.round(panel.w / (110 * scale))),
    );
    const out: Series[] = [];
    for (let s = 0; s < count; s++) {
      const points: { x: number; y: number }[] = [];
      // A jagged walk rather than a smooth curve.
      let level = rndRange(`${panel.seed}-s${s}-l0`, 0.25, 0.75);
      for (let i = 0; i < pointCount; i++) {
        level = Math.min(
          0.94,
          Math.max(
            0.06,
            level + rndRange(`${panel.seed}-s${s}-d${i}`, -0.26, 0.3),
          ),
        );
        points.push({
          x: (panel.w * i) / (pointCount - 1),
          y: plotBottom - plotH * level,
        });
      }
      const cum = [0];
      let total = 0;
      for (let i = 1; i < points.length; i++) {
        total += Math.hypot(
          points[i].x - points[i - 1].x,
          points[i].y - points[i - 1].y,
        );
        cum.push(total);
      }
      out.push({
        tone: variant.chart.seriesTones[s % variant.chart.seriesTones.length],
        shape: SHAPES[s % SHAPES.length],
        points,
        cum,
        total,
      });
    }
    return out;
  }, [panel.seed, panel.w, plotBottom, plotH, scale, variant.chart.seriesTones]);

  const staticLayer = useMemo(() => {
    const c = makeCanvas(panel.w, panel.h);
    const ctx = c.getContext("2d") as Ctx;
    drawPanelHeading(ctx, variant, panel.seed, panel.w, scale);

    ctx.strokeStyle = variant.palette.textDim;
    ctx.lineWidth = Math.max(1, 1.2 * scale);
    ctx.globalAlpha = 0.2;
    for (let i = 0; i <= 4; i++) {
      const y = plotTop + (plotH * i) / 4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(panel.w, y);
      ctx.stroke();
    }
    const cols = Math.round(panel.w / (170 * scale));
    for (let i = 0; i <= cols; i++) {
      const x = (panel.w * i) / cols;
      ctx.beginPath();
      ctx.moveTo(x, plotTop);
      ctx.lineTo(x, plotBottom);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return c;
  }, [panel.w, panel.h, panel.seed, variant, scale, plotTop, plotBottom, plotH]);

  usePanelPainter(panel, (ctx, api) => {
    ctx.drawImage(staticLayer, 0, 0);

    const lw = 6.5 * scale;
    const nodeR = 9.5 * scale;

    for (const s of series) {
      const drawn = s.total * api.t;

      if (drawn > 0.5) {
        // Lines draw on left to right via stroke-dash.
        ctx.save();
        ctx.setLineDash([drawn, s.total + 10]);
        ctx.lineDashOffset = 0;
        ctx.lineJoin = "round";
        ctx.lineCap = "butt";
        ctx.lineWidth = lw;
        ctx.strokeStyle = s.tone;
        withGlow(ctx, variant, s.tone);
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++) {
          ctx.lineTo(s.points[i].x, s.points[i].y);
        }
        ctx.stroke();
        clearGlow(ctx);
        ctx.restore();
      }

      // Markers pop in as the line reaches them.
      const popDist = Math.max(24, 40 * scale);
      for (let i = 0; i < s.points.length; i++) {
        const reach = drawn - s.cum[i];
        if (reach <= 0) {
          continue;
        }
        // Markers pop with a spring as the line arrives at them.
        const k = spring({
          frame: (Math.min(1, reach / popDist) * POP_FRAMES),
          fps: api.fps,
          config: { damping: 11, stiffness: 190, mass: 0.55 },
        });
        if (k <= 0.01) {
          continue;
        }
        const p = s.points[i];
        const r = nodeR * k;
        ctx.fillStyle = s.tone;
        ctx.strokeStyle = s.tone;
        ctx.lineWidth = 4 * scale;
        if (s.shape === "disc") {
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fill();
        } else if (s.shape === "ring") {
          ctx.fillStyle = variant.palette.background;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.fillRect(p.x - r * 0.86, p.y - r * 0.86, r * 1.72, r * 1.72);
        }
      }
    }
  });

  return null;
};
