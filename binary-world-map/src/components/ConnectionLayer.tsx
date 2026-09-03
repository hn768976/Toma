import React from "react";
import {useCurrentFrame} from "remotion";
import {CONFIG, HEIGHT, WIDTH} from "../config";
import {withAlpha} from "../lib/color";
import {useCanvas2D} from "../lib/use-canvas";
import type {Line} from "../scene/geometry";
import type {Theme} from "../theme";

/**
 * Long, thin, near-white sightlines crossing the whole frame.
 *
 * They are straight, not arcs: a straight line laid over a curved map reads as
 * a sightline or a survey baseline rather than a flight path, which is the
 * distinction this piece is built on. Every line runs well past its endpoints
 * to the frame edges.
 *
 * Occasional travelling highlights slide along a line. Their scheduling is a
 * pure function of the frame — a per-line phase offset against a long cycle —
 * so only one or two are ever lit at once.
 */
export const ConnectionLayer: React.FC<{theme: Theme; lines: Line[]}> = ({theme, lines}) => {
  const frame = useCurrentFrame();
  const {lineWidth, opacity, overshoot, highlightLength, highlightDuration, highlightCycle} =
    CONFIG.connections;

  const ref = useCanvas2D(WIDTH, HEIGHT, (ctx) => {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.lineCap = "butt";

    lines.forEach((l, i) => {
      const ax = l.px - l.dx * overshoot;
      const ay = l.py - l.dy * overshoot;
      const bx = l.px + l.dx * overshoot;
      const by = l.py + l.dy * overshoot;

      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = withAlpha(theme.connectLine, opacity);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();

      const cyclePos = (frame + i * 29) % highlightCycle;
      if (cyclePos >= highlightDuration) return;

      const t = cyclePos / highlightDuration;
      // Fade in and out at the ends so a highlight never pops.
      const env = Math.sin(t * Math.PI);
      const total = overshoot * 2;
      const head = -overshoot + t * (total + highlightLength);
      const tail = head - highlightLength;

      const hx = l.px + l.dx * head;
      const hy = l.py + l.dy * head;
      const tx = l.px + l.dx * tail;
      const ty = l.py + l.dy * tail;

      const grad = ctx.createLinearGradient(tx, ty, hx, hy);
      grad.addColorStop(0, withAlpha(theme.connectLine, 0));
      grad.addColorStop(0.65, withAlpha(theme.connectLine, 0.5 * env));
      grad.addColorStop(1, withAlpha(theme.nodeWhite, 0.95 * env));

      ctx.lineWidth = lineWidth * 1.6;
      ctx.strokeStyle = grad;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(hx, hy);
      ctx.stroke();
    });
  });

  return <canvas ref={ref} style={{position: "absolute", inset: 0, width: "100%", height: "100%"}} />;
};
