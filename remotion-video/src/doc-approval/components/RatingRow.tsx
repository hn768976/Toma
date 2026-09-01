import React, { useLayoutEffect, useMemo, useRef } from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_FAMILY, fontsReady } from "../fonts";
import {
  RATING_CENTER_Y,
  STAR_OUTER_RADIUS,
  STAR_SPACING,
  TIMING,
  WIDTH,
} from "../layout";
import type { Variant } from "../variants";
import { drawTrackedText, randRange, trackedTextWidth, withAlpha } from "../util";

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 300;
const CENTER_X = CANVAS_WIDTH / 2;
const CENTER_Y = CANVAS_HEIGHT / 2;

const SCORE_FONT_SIZE = 68;
const SCORE_TRACKING = 8;

type StarShape = {
  points: { x: number; y: number }[];
  rotation: number;
};

/**
 * A five-pointed star whose arms are deliberately a little uneven - a
 * perfectly regular star reads as clip art.
 */
const buildStar = (index: number): StarShape => {
  const seed = `star-${index}`;
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < 10; i++) {
    const isOuter = i % 2 === 0;
    const baseRadius = isOuter ? STAR_OUTER_RADIUS : STAR_OUTER_RADIUS * 0.44;
    const radius = baseRadius * randRange(`${seed}-r${i}`, 0.92, 1.08);
    const angle =
      (-Math.PI / 2 + (i * Math.PI) / 5) + randRange(`${seed}-a${i}`, -0.07, 0.07);
    points.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  }
  return { points, rotation: randRange(`${seed}-rot`, -0.09, 0.09) };
};

type Props = { variant: Variant };

/**
 * Five gold stars for the approved variant; for the rejected one the stars are
 * gone entirely and a struck-through "0 / 5" takes their place - the absence
 * is more legible than five empty outlines would be.
 */
export const RatingRow: React.FC<Props> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { palette, rating } = variant;

  const stars = useMemo(
    () =>
      rating.kind === "stars"
        ? Array.from({ length: rating.count }, (_, i) => buildStar(i))
        : [],
    [rating],
  );

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    const paint = () => {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      if (rating.kind === "stars") {
        const starColor = palette.star ?? palette.icon;
        ctx.lineJoin = "round";
        stars.forEach((star, i) => {
          const start = TIMING.ratingStart + i * TIMING.starStagger;
          // Under-damped so each star overshoots and settles back - a pop,
          // not a fade.
          const progress = spring({
            frame: frame - start,
            fps,
            config: { damping: 9, mass: 0.5 },
            durationInFrames: TIMING.starSpringDuration,
          });
          if (progress <= 0) return;
          const alpha = interpolate(frame, [start, start + 6], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const scale = 0.25 + 0.75 * progress;

          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(CENTER_X + (i - (stars.length - 1) / 2) * STAR_SPACING, CENTER_Y);
          ctx.rotate(star.rotation);
          ctx.scale(scale, scale);
          ctx.beginPath();
          star.points.forEach((p, j) => {
            if (j === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          });
          ctx.closePath();
          ctx.fillStyle = starColor;
          ctx.shadowColor = starColor;
          ctx.shadowBlur = 30;
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.restore();
        });
        return;
      }

      const alpha = interpolate(frame, TIMING.scoreFadeIn, [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      if (alpha <= 0) return;

      ctx.font = `300 ${SCORE_FONT_SIZE}px "${FONT_FAMILY}", sans-serif`;
      ctx.textBaseline = "middle";
      ctx.globalAlpha = alpha;
      ctx.fillStyle = palette.textPale;
      drawTrackedText(ctx, rating.text, CENTER_X, CENTER_Y, SCORE_TRACKING, "center");

      const textWidth = trackedTextWidth(ctx, rating.text, SCORE_TRACKING);
      const ruleProgress = interpolate(frame, TIMING.scoreRuleDraw, [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
      if (ruleProgress > 0) {
        const half = textWidth / 2 + 26;
        ctx.strokeStyle = withAlpha(palette.textPale, 0.85);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(CENTER_X - half, CENTER_Y + 2);
        ctx.lineTo(CENTER_X - half + half * 2 * ruleProgress, CENTER_Y + 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    paint();
    // Canvas text does not reflow when a webfont arrives the way DOM text
    // does, so repaint once the face is actually available.
    let cancelled = false;
    fontsReady.then(() => {
      if (!cancelled) paint();
    });
    return () => {
      cancelled = true;
    };
  });

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      style={{
        position: "absolute",
        left: WIDTH / 2 - CENTER_X,
        top: RATING_CENTER_Y - CENTER_Y,
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
      }}
    />
  );
};
