import React, { useLayoutEffect, useMemo } from "react";
import { bloomPass, sharpPass } from "./effects";
import { beginScratch, claim, type Stage } from "./stage";
import { DIGIT_SEGMENTS, buildSegments, type SegmentPolygon } from "./segments";

export type SevenSegmentDigitsProps = {
  stage: Stage | null;
  frame: number;
  background: string;
  /** Characters 0-9 and ':' — anything else is treated as a blank cell. */
  text: string;
  /** Centre of the whole readout. */
  centerX: number;
  centerY: number;
  digitWidth: number;
  digitHeight: number;
  thickness: number;
  /** Gap between the ends of two meeting segments. */
  gap: number;
  /** Width of a ':' cell. */
  colonWidth: number;
  /** Space between two digits inside a pair. */
  digitGap: number;
  /** Space between a pair and the colon. */
  pairGap: number;
  litColor: string;
  /** Unlit segments are drawn in this, faintly — see below. */
  dimColor: string;
  bloomBlur: number;
  bloomAlpha: number;
};

/**
 * A digital numeral readout drawn from segment geometry, not from a font.
 *
 * The point of building it this way is the UNLIT segments: they are
 * drawn too, in `dimColor`, so the full eight-segment cell ghosts faintly
 * behind whatever numeral is showing. That is the single detail that
 * makes it read as a real digital display; without it the digits look
 * like a typeface imitating one.
 */
export const SevenSegmentDigits: React.FC<SevenSegmentDigitsProps> = ({
  stage,
  frame,
  background,
  text,
  centerX,
  centerY,
  digitWidth,
  digitHeight,
  thickness,
  gap,
  colonWidth,
  digitGap,
  pairGap,
  litColor,
  dimColor,
  bloomBlur,
  bloomAlpha,
}) => {
  const segments = useMemo(
    () =>
      buildSegments({
        width: digitWidth,
        height: digitHeight,
        thickness,
        gap,
      }),
    [digitWidth, digitHeight, thickness, gap],
  );

  /** Left edge of each cell, and the block's total width. */
  const cells = useMemo(() => {
    const chars = text.split("");
    let x = 0;
    const placed = chars.map((char, i) => {
      const isColon = char === ":";
      const width = isColon ? colonWidth : digitWidth;
      const cell = { char, x, width };
      const next = chars[i + 1];
      // A colon is flanked by the wider pair gap; digits inside a pair
      // sit on the tighter one.
      x += width + (isColon || next === ":" ? pairGap : digitGap);
      return cell;
    });
    const total = placed.length
      ? placed[placed.length - 1].x + placed[placed.length - 1].width
      : 0;
    return { placed, total };
  }, [text, colonWidth, digitWidth, digitGap, pairGap]);

  useLayoutEffect(() => {
    if (!stage) return;
    const target = claim(stage, "seven-segment-digits", frame, background);
    if (!target) return;
    const ctx = beginScratch(stage);
    if (!ctx) return;

    const originX = centerX - cells.total / 2;
    const originY = centerY - digitHeight / 2;

    const fillPolygon = (poly: SegmentPolygon, dx: number, dy: number) => {
      ctx.beginPath();
      ctx.moveTo(dx + poly[0].x, dy + poly[0].y);
      for (let i = 1; i < poly.length; i++) {
        ctx.lineTo(dx + poly[i].x, dy + poly[i].y);
      }
      ctx.closePath();
      ctx.fill();
    };

    for (const cell of cells.placed) {
      const dx = originX + cell.x;

      if (cell.char === ":") {
        // Two small squares, always lit.
        const size = thickness;
        const cx = dx + cell.width / 2 - size / 2;
        ctx.fillStyle = litColor;
        ctx.fillRect(cx, originY + digitHeight * 0.3 - size / 2, size, size);
        ctx.fillRect(cx, originY + digitHeight * 0.7 - size / 2, size, size);
        continue;
      }

      const numeral = Number(cell.char);
      const lit =
        Number.isInteger(numeral) && numeral >= 0 && numeral <= 9
          ? DIGIT_SEGMENTS[numeral]
          : null;

      // Unlit first, then lit over the top.
      ctx.fillStyle = dimColor;
      segments.forEach((poly, i) => {
        if (!lit || !lit[i]) fillPolygon(poly, dx, originY);
      });
      if (!lit) continue;
      ctx.fillStyle = litColor;
      segments.forEach((poly, i) => {
        if (lit[i]) fillPolygon(poly, dx, originY);
      });
    }

    bloomPass(target, stage, bloomBlur, bloomAlpha);
    bloomPass(target, stage, bloomBlur * 0.3, bloomAlpha * 0.85);
    sharpPass(target, stage);
  }, [
    stage,
    frame,
    background,
    cells,
    segments,
    centerX,
    centerY,
    digitHeight,
    thickness,
    litColor,
    dimColor,
    bloomBlur,
    bloomAlpha,
  ]);

  return null;
};
