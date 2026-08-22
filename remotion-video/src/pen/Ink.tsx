// Renders one mark at one frame.
//
// Strokes draw on with stroke-dashoffset. The <path> carries pathLength={1},
// so the dash maths is exact regardless of how the quadratic smoothing
// changed the true arc length. Text writes on behind a clip rect that opens
// left to right. Fills wipe the same way. Nothing anywhere fades.

import React from "react";
import { FONT_STACK } from "./constants";
import { bounds, toD } from "./geometry";
import {
  isVisible,
  progressOf,
  textLeft,
  textWidth,
  type Mark,
} from "./sheet";

/** Shake offsets for the scene-6 bell, stepping every 4 frames. */
const SHAKE = [
  [-3, 0],
  [3, -2],
  [-2, 2],
  [3, 1],
] as const;

export const shakeAt = (frame: number): readonly [number, number] =>
  SHAKE[Math.floor(frame / 4) % SHAKE.length];

export const InkMark: React.FC<{ mark: Mark; frame: number; id: string }> = ({
  mark,
  frame,
  id,
}) => {
  if (!isVisible(mark, frame)) return null;

  const progress = progressOf(mark, frame);
  if (progress <= 0) return null;

  const shake = mark.shake ? shakeAt(frame) : null;
  const wrap = (node: React.ReactNode) =>
    shake ? <g transform={`translate(${shake[0]} ${shake[1]})`}>{node}</g> : <>{node}</>;

  if (mark.kind === "stroke") {
    return wrap(
      <path
        d={toD(mark.pts)}
        pathLength={1}
        strokeDasharray="1 1"
        strokeDashoffset={1 - progress}
        stroke={mark.color}
        strokeWidth={mark.width}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />,
    );
  }

  if (mark.kind === "fill") {
    const b = bounds(mark.pts);
    return wrap(
      <>
        <clipPath id={id}>
          <rect
            x={b.minX - 4}
            y={b.minY - 4}
            width={(b.maxX - b.minX + 8) * progress}
            height={b.maxY - b.minY + 8}
          />
        </clipPath>
        <path d={toD(mark.pts)} fill={mark.color} stroke="none" clipPath={`url(#${id})`} />
      </>,
    );
  }

  const width = textWidth(mark.text, mark.size);
  const left = textLeft(mark);
  return wrap(
    <>
      <clipPath id={id}>
        <rect
          x={left - 8}
          y={mark.y - mark.size * 1.05}
          width={width * progress + 10}
          height={mark.size * 1.5}
        />
      </clipPath>
      <text
        x={mark.x}
        y={mark.y}
        textAnchor={mark.anchor}
        fontFamily={FONT_STACK}
        fontSize={mark.size}
        fontWeight={600}
        fill={mark.color}
        // Forcing the advance to our own estimate keeps the write-on clip in
        // step with the glyphs. "spacing" adjusts the gaps, never the shapes.
        {...(mark.text.length > 1
          ? { textLength: width, lengthAdjust: "spacing" as const }
          : {})}
        clipPath={`url(#${id})`}
      >
        {mark.text}
      </text>
    </>,
  );
};
