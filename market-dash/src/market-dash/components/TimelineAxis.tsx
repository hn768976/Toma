import React, { useMemo } from "react";
import { CanvasLayer } from "../CanvasLayer";
import { createOffscreen } from "../geo";
import { font } from "../fonts";
import {
  AXIS_HEIGHT,
  AXIS_QUARTER_DY,
  AXIS_RULE_DY,
  AXIS_TOP,
  AXIS_YEAR_DY,
  WIDTH,
  axisQuarterWidth,
} from "../layout";
import { quarterCount, type Palette, type Timeline } from "../variants";

const yearOf = (timeline: Timeline, index: number) =>
  timeline.startYear + Math.floor((timeline.startQuarter - 1 + index) / 4);

const quarterOf = (timeline: Timeline, index: number) =>
  ((timeline.startQuarter - 1 + index) % 4) + 1;

/**
 * The whole axis is drawn once into a strip wider than the frame and then
 * blitted at a scrolling offset, so no text is laid out per frame.
 */
const renderAxis = (
  timeline: Timeline,
  palette: Palette,
): { strip: HTMLCanvasElement; width: number } => {
  const quarters = quarterCount(timeline);
  const cell = axisQuarterWidth(quarters);
  const width = Math.ceil(quarters * cell);
  const strip = createOffscreen(width, AXIS_HEIGHT);
  const ctx = strip.getContext("2d");
  if (!ctx) return { strip, width };

  const ruleY = AXIS_RULE_DY;
  ctx.strokeStyle = palette.textPale;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, ruleY);
  ctx.lineTo(width, ruleY);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  for (let i = 0; i < quarters; i++) {
    const centre = i * cell + cell / 2;
    const quarter = quarterOf(timeline, i);
    const yearStart = quarter === 1 || i === 0;

    ctx.globalAlpha = yearStart ? 0.6 : 0.32;
    ctx.lineWidth = yearStart ? 4 : 2;
    ctx.beginPath();
    ctx.moveTo(i * cell, ruleY);
    ctx.lineTo(i * cell, ruleY + (yearStart ? 46 : 22));
    ctx.stroke();

    ctx.globalAlpha = 0.72;
    ctx.fillStyle = palette.textPale;
    ctx.font = font(36, 400);
    ctx.fillText(`Q${quarter}`, centre, AXIS_QUARTER_DY);
  }

  // Year labels sit under their own run of quarters, in a brighter weight.
  let i = 0;
  while (i < quarters) {
    const year = yearOf(timeline, i);
    let span = 0;
    while (i + span < quarters && yearOf(timeline, i + span) === year) span++;
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = palette.textBright;
    ctx.font = font(56, 700);
    ctx.fillText(
      String(year),
      i * cell + (span * cell) / 2,
      AXIS_YEAR_DY,
    );
    i += span;
  }

  return { strip, width };
};

export type TimelineAxisProps = {
  timeline: Timeline;
  palette: Palette;
  progress: number;
  reveal: number;
};

/**
 * The spine. It scrolls leftward on the same normalised progress that extends
 * the lines and adds the bars, so new periods enter from the right exactly as
 * the data reaches them.
 */
export const TimelineAxis: React.FC<TimelineAxisProps> = ({
  timeline,
  palette,
  progress,
  reveal,
}) => {
  const axis = useMemo(
    () => renderAxis(timeline, palette),
    [timeline, palette],
  );

  const draw = (ctx: CanvasRenderingContext2D) => {
    const travel = Math.max(0, axis.width - WIDTH);
    ctx.globalAlpha = reveal;
    ctx.drawImage(axis.strip, -progress * travel, AXIS_TOP);
  };

  return <CanvasLayer draw={draw} />;
};
