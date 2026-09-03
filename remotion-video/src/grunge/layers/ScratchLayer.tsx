import React, { useLayoutEffect, useMemo } from "react";
import { clamp, smoothstep } from "../lib/canvas";
import { rgba } from "../lib/color";
import { createNoise1D } from "../lib/noiseField";
import type { FlickerEvent } from "../lib/flickerSchedule";
import { flickerEnvelope, scheduleFlickerEvents } from "../lib/flickerSchedule";
import { rnd, rndBell, rndBool, rndInt, rndRange } from "../lib/rng";
import type { LayerBaseProps } from "./types";
import { layerContext } from "./types";
import type { LayerSettings } from "../variants";

/**
 * Emulsion scratches: near-vertical hairlines running the height of the frame.
 *
 * The detail that sells them is that they are not permanent. A scratch that
 * persists for the whole clip reads as a rendering fault; real gate damage
 * appears for a handful of frames, vanishes, and turns up somewhere else. So
 * every scratch is a scheduled event (see flickerSchedule), and the schedule
 * is built so no event straddles the loop point.
 *
 * Along its length a scratch is not uniform either: a 1D noise field breaks it
 * into bright runs separated by stretches where it fades out completely, and a
 * pair of sines gives it a slow horizontal wander so it never reads as a
 * ruler-straight line.
 */

/** Distance between the quads a streak is drawn from, in px at 4K. */
const SEGMENT_PX = 32;
const CLUSTER_COUNT = 5;

type Streak = {
  event: FlickerEvent;
  /** Centre of the streak in frame coordinates. */
  cx: number;
  cy: number;
  angle: number;
  length: number;
  width: number;
  ragged: boolean;
  /** Horizontal wander along the streak's length. */
  wanderA1: number;
  wanderA2: number;
  wanderF1: number;
  wanderF2: number;
  wanderP1: number;
  wanderP2: number;
  brightness: (t: number) => number;
  raggedLeft: (t: number) => number;
  raggedRight: (t: number) => number;
};

const buildBrightness = (seed: string): ((t: number) => number) => {
  const coarse = createNoise1D(seed + "|bc", 9);
  const fine = createNoise1D(seed + "|bf", 27);
  return (t: number) => {
    // t is 0..1 along the streak. The coarse octave opens the breaks; the
    // fine one gives the surviving runs an uneven brightness.
    const n = coarse(t * 9) * 0.72 + fine(t * 27) * 0.28;
    return smoothstep(0.34, 0.72, n);
  };
};

const buildStreaks = (
  events: FlickerEvent[],
  settings: LayerSettings["scratches"],
  width: number,
  height: number,
  horizontal: boolean,
): Streak[] => {
  // A few cluster centres, so scratch positions are irregular and some sit
  // close together rather than being evenly spread.
  const clusters: number[] = [];
  const span = horizontal ? height : width;
  for (let i = 0; i < CLUSTER_COUNT; i++) {
    clusters.push(rndRange("scratch|cluster" + (horizontal ? "h" : "v") + i, 0.08, 0.92) * span);
  }

  return events.map((event) => {
    const s = event.id;
    const clustered = rndBool(s + "|clustered", 0.6);
    const position = clustered
      ? clamp(
          clusters[rndInt(s + "|cluster", 0, CLUSTER_COUNT - 1)] + rndBell(s + "|spread") * span * 0.06,
          0,
          span,
        )
      : rndRange(s + "|pos", 0, span);

    const thick = rndBool(s + "|thick", settings.thickChance);
    const streakWidth = thick
      ? rndRange(s + "|w", settings.maxWidth * 0.55, settings.maxWidth)
      : rndRange(s + "|w", settings.baseWidth, Math.min(settings.maxWidth, settings.baseWidth + 2));

    // Overall tilt is deliberately tiny: +/-2 degrees reads as film weave,
    // more than that reads as a diagonal line someone drew.
    const tilt = rndRange(s + "|tilt", -2, 2) * (Math.PI / 180);
    const length = horizontal
      ? rndRange(s + "|len", width * 0.06, width * 0.24)
      : height * 1.12;

    return {
      event,
      cx: horizontal ? rndRange(s + "|hx", width * 0.05, width * 0.95) : position,
      cy: horizontal ? position : height / 2,
      angle: horizontal ? Math.PI / 2 + tilt : tilt,
      length,
      width: streakWidth,
      ragged: thick,
      wanderA1: rndRange(s + "|wa1", 6, 26),
      wanderA2: rndRange(s + "|wa2", 2, 9),
      wanderF1: rndRange(s + "|wf1", 0.8, 2.2) * Math.PI * 2,
      wanderF2: rndRange(s + "|wf2", 3, 7) * Math.PI * 2,
      wanderP1: rndRange(s + "|wp1", 0, Math.PI * 2),
      wanderP2: rndRange(s + "|wp2", 0, Math.PI * 2),
      brightness: buildBrightness(s),
      raggedLeft: createNoise1D(s + "|rl", 21),
      raggedRight: createNoise1D(s + "|rr", 21),
    };
  });
};

const drawStreak = (
  ctx: CanvasRenderingContext2D,
  streak: Streak,
  color: string,
  alpha: number,
  jitter: number,
): void => {
  ctx.save();
  ctx.translate(streak.cx + jitter, streak.cy);
  ctx.rotate(streak.angle);

  const half = streak.length / 2;
  const steps = Math.max(4, Math.ceil(streak.length / SEGMENT_PX));
  const offsetAt = (t: number) =>
    streak.wanderA1 * Math.sin(t * streak.wanderF1 + streak.wanderP1) +
    streak.wanderA2 * Math.sin(t * streak.wanderF2 + streak.wanderP2);
  const widthAt = (t: number) =>
    streak.ragged
      ? streak.width * (0.6 + 0.8 * streak.raggedLeft(t * 21))
      : streak.width * (0.8 + 0.4 * streak.raggedLeft(t * 21));
  const edgeAt = (t: number) =>
    streak.ragged ? (streak.raggedRight(t * 21) - 0.5) * streak.width * 0.9 : 0;

  for (let i = 0; i < steps; i++) {
    const t0 = i / steps;
    const t1 = (i + 1) / steps;
    const mid = (t0 + t1) / 2;
    // Taper both ends so a scratch does not begin and end on a hard edge.
    const taper = smoothstep(0, 0.06, mid) * smoothstep(0, 0.06, 1 - mid);
    const a = alpha * streak.brightness(mid) * taper;
    if (a <= 0.004) continue;

    const v0 = -half + t0 * streak.length;
    const v1 = -half + t1 * streak.length;
    const o0 = offsetAt(t0);
    const o1 = offsetAt(t1);
    const w0 = widthAt(t0) / 2;
    const w1 = widthAt(t1) / 2;
    const e0 = edgeAt(t0);
    const e1 = edgeAt(t1);

    ctx.fillStyle = rgba(color, a);
    ctx.beginPath();
    ctx.moveTo(o0 - w0 + e0, v0);
    ctx.lineTo(o0 + w0 + e0, v0);
    ctx.lineTo(o1 + w1 + e1, v1);
    ctx.lineTo(o1 - w1 + e1, v1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
};

type ScratchLayerProps = LayerBaseProps & {
  settings: LayerSettings["scratches"];
  loopFrames: number;
};

export const ScratchLayer: React.FC<ScratchLayerProps> = (props) => {
  const { frame, width, height, palette, intensity, settings, loopFrames } = props;
  const color = palette.scratchPale;

  const verticalEvents = useMemo(
    () =>
      scheduleFlickerEvents({
        seed: "scratch|v",
        duration: loopFrames,
        minConcurrent: settings.minConcurrent,
        maxConcurrent: settings.maxConcurrent,
        minLife: settings.minLife,
        maxLife: settings.maxLife,
        minGap: settings.minGap,
        maxGap: settings.maxGap,
      }),
    [loopFrames, settings],
  );

  const horizontalEvents = useMemo(
    () =>
      settings.horizontalConcurrent > 0
        ? scheduleFlickerEvents({
            seed: "scratch|h",
            duration: loopFrames,
            minConcurrent: 0,
            maxConcurrent: settings.horizontalConcurrent,
            minLife: settings.minLife,
            maxLife: settings.maxLife,
            minGap: settings.minGap * 3,
            maxGap: settings.maxGap * 3,
          })
        : [],
    [loopFrames, settings],
  );

  const verticalStreaks = useMemo(
    () => buildStreaks(verticalEvents, settings, width, height, false),
    [verticalEvents, settings, width, height],
  );
  const horizontalStreaks = useMemo(
    () => buildStreaks(horizontalEvents, settings, width, height, true),
    [horizontalEvents, settings, width, height],
  );

  useLayoutEffect(() => {
    const ctx = layerContext(props);
    if (!ctx || !color) return;

    const alphaScale = 0.4 + 0.6 * intensity;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    const paint = (streaks: Streak[]) => {
      for (let i = 0; i < streaks.length; i++) {
        const streak = streaks[i];
        const envelope = flickerEnvelope(frame, streak.event, 2);
        if (envelope <= 0) continue;
        // Per-frame sparkle and a pixel or two of lateral judder, as the
        // film itself moves in the gate.
        const flicker = 0.62 + 0.38 * rnd(streak.event.id + "|f" + frame);
        const jitter = rndBell(streak.event.id + "|j" + frame) * 2.5;
        drawStreak(ctx, streak, color, envelope * flicker * alphaScale, jitter);
      }
    };

    paint(verticalStreaks);
    paint(horizontalStreaks);
    ctx.restore();
  });

  return null;
};
