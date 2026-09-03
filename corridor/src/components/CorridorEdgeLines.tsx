/**
 * <CorridorEdgeLines> — v2's structural highlights: thin bright lines running
 * along the corridor's depth axis, following the perspective like edge
 * highlights on the room itself. Brighter near the camera, with a highlight
 * that travels along them on a whole number of cycles per loop.
 *
 * These are static in depth (cycles = 0): they are the corridor, not traffic
 * in it. Their d0 is chosen to land them in the sharp middle depth bucket,
 * and the taper along the line does the depth work instead.
 */
import React, { useMemo } from "react";
import { mixRgba } from "../lib/color";
import { frac, smoothstep } from "../lib/math";
import { Plane } from "../lib/perspective";
import { randChance, randInt, randRange } from "../lib/seededRandom";
import { TaperPoint, taperedStroke } from "../lib/taperedStroke";
import {
  CorridorElement,
  ElementRenderer,
  useCorridorGroup,
} from "./PerspectiveCorridor";

const SAMPLES = 34;

export interface EdgeLineElement extends CorridorElement {
  /** Depth range the line spans. */
  from: number;
  to: number;
  width: number;
  alpha: number;
  /** Travelling highlight: whole cycles per loop, plus a phase. */
  pulseCycles: number;
  pulsePhase: number;
  tone: number;
}

export const renderEdgeLine: ElementRenderer<EdgeLineElement> = (
  ctx,
  el,
  p,
  api,
) => {
  const { geo, palette } = api;
  const k = geo.width / 3840;
  const pulse = frac(el.pulsePhase + el.pulseCycles * (api.frame / api.loop));

  const pts: TaperPoint[] = new Array(SAMPLES);
  let visible = false;
  for (let i = 0; i < SAMPLES; i++) {
    const t = i / (SAMPLES - 1);
    const d = el.from + (el.to - el.from) * t;
    const q = api.point(el.lane, d, el.plane);
    // A soft bright travelling highlight, wrapping with the line.
    const dist = Math.min(Math.abs(t - pulse), 1 - Math.abs(t - pulse));
    const hot = 1 + 2.4 * (1 - smoothstep(0, 0.11, dist));
    const a =
      p.fade *
      api.band(q.y) *
      el.alpha *
      d *
      hot *
      smoothstep(0, 0.08, t) *
      (1 - smoothstep(0.86, 1, t));
    if (a > 0.02) visible = true;
    pts[i] = { x: q.x, y: q.y, w: Math.max(0.7, el.width * k * d), a };
  }
  if (!visible) return;

  taperedStroke(ctx, pts, {
    stops: 18,
    colorAt: (alpha) => mixRgba(palette.slabEdge, palette.slabBright, el.tone, alpha),
  });
  // A wider, fainter companion so the line glows rather than cuts.
  taperedStroke(
    ctx,
    pts.map((q) => ({ ...q, w: q.w * 4.5, a: q.a * 0.16 })),
    {
      stops: 12,
      colorAt: (alpha) => mixRgba(palette.slabEdge, palette.horizonGlow, 0.4, alpha),
    },
  );
};

export const makeEdgeLines = (count: number, seed: string): EdgeLineElement[] => {
  const out: EdgeLineElement[] = [];
  for (let i = 0; i < count; i++) {
    const s = `${seed}-edge-${i}`;
    const plane: Plane = randChance(`${s}-pl`, 0.5) ? "floor" : "ceiling";
    // Irregular lateral placement; an even fan reads as a printed grid.
    const mag = randRange(`${s}-lm`, 0.06, 0.98);
    out.push({
      seed: s,
      lane: mag * (i % 2 === 0 ? -1 : 1),
      plane,
      d0: 0.35,
      cycles: 0,
      from: 0.012,
      to: randRange(`${s}-to`, 0.72, 1.25),
      width: randRange(`${s}-w`, 2.6, 7),
      alpha: randRange(`${s}-a`, 0.4, 1),
      pulseCycles: randInt(`${s}-pc`, 1, 3),
      pulsePhase: randRange(`${s}-pp`, 0, 1),
      tone: randRange(`${s}-tn`, 0, 1),
    });
  }
  return out;
};

export interface CorridorEdgeLinesProps {
  order: number;
  count: number;
  seed: string;
}

export const CorridorEdgeLines: React.FC<CorridorEdgeLinesProps> = ({
  order,
  count,
  seed,
}) => {
  const elements = useMemo(() => makeEdgeLines(count, seed), [count, seed]);
  useCorridorGroup<EdgeLineElement>({
    id: "corridor-edge-lines",
    order,
    elements,
    render: renderEdgeLine,
    blend: "lighter",
  });
  return null;
};
