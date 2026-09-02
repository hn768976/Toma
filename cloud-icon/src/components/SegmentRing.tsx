import React, { useMemo } from "react";
import { interpolate } from "remotion";
import {
  CLOUD,
  FINISH,
  CLOUD_CENTER_Y,
  CLOUD_WIDTH,
  DURATION_IN_FRAMES,
  HEIGHT,
  RING,
  TIMING,
  WIDTH,
} from "../config";
import { brokenArcRing } from "../lib/brokenArcRing";
import { bloomPass, mixColors } from "../lib/postFx";
import type { Theme } from "../theme";
import { layerStyle, useCanvasDraw, useScratchCanvas } from "../lib/canvas";

export const RING_RADIUS = (CLOUD_WIDTH * RING.diameterFactor) / 2;

/**
 * Rounded arc segments of unequal length, separated by unequal gaps, turning
 * once across the composition while a brightness pulse travels around them.
 */
export const SegmentRing: React.FC<{ frame: number; theme: Theme }> = ({ frame, theme }) => {
  const segments = useMemo(
    () =>
      brokenArcRing({
        count: RING.segmentCount,
        seed: "cloud-icon/ring",
        longIndices: RING.longSegments,
        longFactor: RING.longFactor,
        lengthJitter: RING.lengthJitter,
      }),
    [],
  );
  const scratch = useScratchCanvas();

  const ref = useCanvasDraw(WIDTH, HEIGHT, (ctx, canvas) => {
    if (frame < TIMING.ringStart) return;

    // Exactly one turn across the 480 frames.
    const rotation = (frame / DURATION_IN_FRAMES) * Math.PI * 2 * RING.rotationTurns;

    // The bright pulse walks through the segment sequence; the period divides
    // the composition length so the wave stays regular throughout.
    const pulseHead =
      ((frame % RING.pulsePeriod) / RING.pulsePeriod) * RING.segmentCount;

    ctx.lineWidth = RING.lineWidth;
    ctx.lineCap = "round";

    for (const segment of segments) {
      const appearAt = TIMING.ringStart + segment.index * TIMING.ringStagger;
      const appear = interpolate(
        frame,
        [appearAt, appearAt + TIMING.ringSegmentFade],
        [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      );
      if (appear <= 0) continue;

      // Shortest signed distance in wrapped segment-index space.
      let delta = segment.index - pulseHead;
      delta -= Math.round(delta / RING.segmentCount) * RING.segmentCount;
      const pulse = Math.exp(-Math.pow(delta / RING.pulseWidth, 2));

      const lit = Math.min(1, (segment.long ? 0.3 : 0.16) + pulse * 0.95);
      ctx.strokeStyle = mixColors(
        theme.ringDim,
        theme.ringCyan,
        lit,
        appear * (0.55 + 0.45 * lit),
      );
      ctx.beginPath();
      ctx.arc(
        CLOUD.centerX,
        CLOUD_CENTER_Y,
        RING_RADIUS,
        segment.start + rotation,
        segment.start + segment.length + rotation,
      );
      ctx.stroke();
    }

    bloomPass(canvas, ctx, {
      downscale: 4,
      scratch,
      layers: FINISH.bloom.ring,
    });
  });

  return <canvas ref={ref} style={layerStyle(4)} />;
};
