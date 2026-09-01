import React, { useLayoutEffect, useRef } from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import {
  ICON_CENTER_X,
  ICON_CENTER_Y,
  ICON_RADIUS,
  ICON_STROKE,
  RING_GAP_CENTER_DEG,
  RING_GAP_HALF_DEG,
  TIMING,
} from "../layout";
import { iconPulse } from "../motion";
import type { Variant } from "../variants";
import { tracePartialPolyline, withAlpha } from "../util";
import type { Point } from "../util";

/** Square buffer around the icon, with room for the bloom to spread. */
const CANVAS_SIZE = 1120;
const ANCHOR = CANVAS_SIZE / 2;

const DEG = Math.PI / 180;
const RING_START = (RING_GAP_CENTER_DEG + RING_GAP_HALF_DEG) * DEG;
const RING_SWEEP = (360 - RING_GAP_HALF_DEG * 2) * DEG;

/**
 * Two strokes meeting at a sharp angle, the second 2.5x the first. The long
 * stroke exits at -42 degrees - the middle of the ring's gap - and carries on
 * about 90px past the outer edge, which is what makes it read as drawn rather
 * than lifted from an icon set.
 */
const CHECK_POINTS: readonly Point[] = [
  [-182, -31],
  [-45, 118],
  [290, -261],
];

/**
 * The two strokes cross at (-38, -46) - up and to the left of the icon's
 * centre, about a third of the way along each stroke rather than at their
 * midpoints. A cross meeting at exact midpoints reads as a mathematical
 * symbol; this reads as a struck-out mark. The second stroke carries on
 * through the ring's gap and overshoots, as the checkmark's does.
 */
const CROSS_STROKES: readonly (readonly Point[])[] = [
  [
    [-151, -159],
    [171, 163],
  ],
  [
    [-176, 92],
    [223, -307],
  ],
];

type Props = { variant: Variant };

type DrawArgs = {
  ctx: CanvasRenderingContext2D;
  variant: Variant;
  ringProgress: number;
  symbolProgress: number;
  symbolScale: number;
  glowPass: boolean;
};

const drawIcon = ({
  ctx,
  variant,
  ringProgress,
  symbolProgress,
  symbolScale,
  glowPass,
}: DrawArgs): void => {
  const { palette, verdict } = variant;
  const color = glowPass ? palette.iconGlow : palette.icon;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.lineWidth = ICON_STROKE + (glowPass ? 10 : 0);

  if (!glowPass) {
    ctx.shadowColor = palette.iconGlow;
    ctx.shadowBlur = 46;
  }

  if (ringProgress > 0) {
    ctx.beginPath();
    ctx.arc(0, 0, ICON_RADIUS, RING_START, RING_START + RING_SWEEP * ringProgress);
    ctx.stroke();
  }

  if (symbolProgress > 0) {
    ctx.save();
    ctx.scale(symbolScale, symbolScale);
    if (verdict.mode === "check") {
      tracePartialPolyline(ctx, CHECK_POINTS, symbolProgress);
      ctx.stroke();
    } else {
      for (const stroke of CROSS_STROKES) {
        ctx.beginPath();
        ctx.moveTo(stroke[0][0], stroke[0][1]);
        ctx.lineTo(stroke[1][0], stroke[1][1]);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  ctx.shadowBlur = 0;
};

/**
 * The central verdict icon. Bloom comes from a blurred copy of the same draw
 * screened underneath a crisp one - the same trick a real glow pass uses, and
 * far cheaper than a per-pixel filter at 4K.
 */
export const VerdictIcon: React.FC<Props> = ({ variant }) => {
  const frame = useCurrentFrame();
  const glowRef = useRef<HTMLCanvasElement>(null);
  const sharpRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const glowCtx = glowRef.current?.getContext("2d");
    const sharpCtx = sharpRef.current?.getContext("2d");
    if (!glowCtx || !sharpCtx) return;

    const ringProgress = interpolate(frame, TIMING.ringDraw, [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });

    let symbolProgress: number;
    let symbolScale: number;
    if (variant.verdict.entrance === "stamp") {
      // No easing and no fade: it lands at 1.25x and snaps down over four
      // frames. A smooth draw-on would read as approval.
      symbolProgress = frame >= TIMING.stampAt ? 1 : 0;
      symbolScale = interpolate(
        frame,
        [TIMING.stampAt, TIMING.stampAt + TIMING.stampFrames],
        [1.25, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      );
    } else {
      symbolProgress = interpolate(frame, TIMING.symbolDraw, [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.inOut(Easing.quad),
      });
      symbolScale = 1;
    }

    // Runs on every frame, not just during the hold, so that the phase at
    // frame 600 is exactly the phase at frame 0.
    const { scale: pulseScale, glow: pulseGlow } = iconPulse(frame);

    for (const [ctx, glowPass] of [
      [glowCtx, true],
      [sharpCtx, false],
    ] as const) {
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.save();
      ctx.translate(ANCHOR, ANCHOR);
      ctx.scale(pulseScale, pulseScale);
      ctx.globalAlpha = glowPass ? pulseGlow : 1;
      drawIcon({ ctx, variant, ringProgress, symbolProgress, symbolScale, glowPass });
      ctx.restore();
    }
  });

  const common: React.CSSProperties = {
    position: "absolute",
    left: ICON_CENTER_X - ANCHOR,
    top: ICON_CENTER_Y - ANCHOR,
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
  };

  return (
    <>
      <canvas
        ref={glowRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        style={{
          ...common,
          filter: "blur(34px)",
          mixBlendMode: "screen",
          // Keeps the bloom from washing the map out to a flat field.
          opacity: 0.9,
          background: withAlpha(variant.palette.backgroundDeep, 0),
        }}
      />
      <canvas ref={sharpRef} width={CANVAS_SIZE} height={CANVAS_SIZE} style={common} />
    </>
  );
};
