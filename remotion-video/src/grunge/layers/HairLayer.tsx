import React, { useLayoutEffect, useMemo } from "react";
import { rgba } from "../lib/color";
import type { FlickerEvent } from "../lib/flickerSchedule";
import { flickerEnvelope, scheduleFlickerEvents } from "../lib/flickerSchedule";
import { rndPick, rndRange } from "../lib/rng";
import type { LayerBaseProps } from "./types";
import { layerContext } from "./types";
import type { LayerSettings } from "../variants";

/**
 * A hair caught in the film gate: a single curved strand that shows up,
 * wobbles for a second or two, and is gone.
 *
 * These have to stay rare. At most two are present at once and they are
 * separated by long gaps, because the moment hairs appear regularly they stop
 * reading as an accident and start reading as a designed element.
 */

const SAMPLES = 28;

type Hair = {
  event: FlickerEvent;
  x: number;
  y: number;
  angle: number;
  span: number;
  width: number;
  alpha: number;
  /** Two harmonics along the strand give it two or three gentle inflections. */
  a1: number;
  a2: number;
  c1: number;
  c2: number;
  p1: number;
  p2: number;
  /** Slow wobble and drift while it is on screen. */
  wobble: number;
  driftX: number;
  driftY: number;
};

const buildHairs = (events: FlickerEvent[], width: number, height: number): Hair[] =>
  events.map((event) => {
    const s = event.id;
    return {
      event,
      // Anchored near an edge, as a real strand hangs into the gate from one.
      x: rndRange(s + "|x", -0.05, 1.05) * width,
      y: rndRange(s + "|y", -0.05, 1.05) * height,
      angle: rndPick(s + "|quad", [0, 1, 2, 3]) * (Math.PI / 2) + rndRange(s + "|a", -0.7, 0.7),
      span: rndRange(s + "|span", 0.2, 0.48) * height,
      width: rndRange(s + "|w", 1, 2),
      alpha: rndRange(s + "|alpha", 0.3, 0.62),
      a1: rndRange(s + "|a1", 60, 200),
      a2: rndRange(s + "|a2", 18, 70),
      c1: rndRange(s + "|c1", 0.55, 1.15),
      c2: rndRange(s + "|c2", 1.4, 2.4),
      p1: rndRange(s + "|p1", 0, Math.PI * 2),
      p2: rndRange(s + "|p2", 0, Math.PI * 2),
      wobble: rndRange(s + "|wob", 0.06, 0.16),
      driftX: rndRange(s + "|dx", -0.5, 0.5),
      driftY: rndRange(s + "|dy", -0.4, 0.4),
    };
  });

const drawHair = (
  ctx: CanvasRenderingContext2D,
  hair: Hair,
  localFrame: number,
  color: string,
  alpha: number,
): void => {
  const points: { x: number; y: number }[] = [];
  const dirX = Math.cos(hair.angle);
  const dirY = Math.sin(hair.angle);
  const perpX = -dirY;
  const perpY = dirX;
  const ox = hair.x + hair.driftX * localFrame;
  const oy = hair.y + hair.driftY * localFrame;
  const phase = localFrame * hair.wobble;

  for (let i = 0; i < SAMPLES; i++) {
    const u = i / (SAMPLES - 1);
    const offset =
      hair.a1 * Math.sin(Math.PI * 2 * hair.c1 * u + hair.p1 + phase * 0.35) +
      hair.a2 * Math.sin(Math.PI * 2 * hair.c2 * u + hair.p2 + phase);
    const along = u * hair.span;
    points.push({
      x: ox + dirX * along + perpX * offset,
      y: oy + dirY * along + perpY * offset,
    });
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    ctx.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
  }
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // A soft halo under a crisp core: a real hair is slightly out of focus.
  ctx.lineWidth = hair.width * 3;
  ctx.strokeStyle = rgba(color, alpha * 0.22);
  ctx.stroke();
  ctx.lineWidth = hair.width;
  ctx.strokeStyle = rgba(color, alpha);
  ctx.stroke();
};

type HairLayerProps = LayerBaseProps & {
  settings: LayerSettings["hairs"];
  loopFrames: number;
};

export const HairLayer: React.FC<HairLayerProps> = (props) => {
  const { frame, width, height, palette, intensity, settings, loopFrames } = props;
  const color = palette.hairPale ?? palette.scratchPale;

  const events = useMemo(
    () =>
      scheduleFlickerEvents({
        seed: "hair",
        duration: loopFrames,
        minConcurrent: 0,
        maxConcurrent: settings.maxConcurrent,
        minLife: settings.minLife,
        maxLife: settings.maxLife,
        minGap: settings.minGap,
        maxGap: settings.maxGap,
      }),
    [loopFrames, settings],
  );

  const hairs = useMemo(() => buildHairs(events, width, height), [events, width, height]);

  useLayoutEffect(() => {
    const ctx = layerContext(props);
    if (!ctx || !color) return;

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < hairs.length; i++) {
      const hair = hairs[i];
      const envelope = flickerEnvelope(frame, hair.event, 8);
      if (envelope <= 0) continue;
      drawHair(ctx, hair, frame - hair.event.start, color, hair.alpha * envelope * intensity);
    }
    ctx.restore();
  });

  return null;
};
