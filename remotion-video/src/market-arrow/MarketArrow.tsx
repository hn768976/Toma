import React, { useId } from "react";
import { STAGE_HEIGHT, STAGE_WIDTH } from "./constants";

export type ArrowProps = {
  direction: "up" | "down";
  /** Centreline of the shaft, in stage px. */
  x: number;
  /** Where the point of the arrow sits, in stage px. */
  tipY: number;
  /** Far end of the shaft. Usually parked off-frame. */
  tailY: number;
  shaftWidth: number;
  headWidth: number;
  headHeight: number;
  /** Gradient runs tail -> tip along the shaft. */
  tailColor: string;
  tipColor: string;
  glowColor: string;
  glowBlur: number;
  glowOpacity: number;
  opacity?: number;
};

// The hero arrow for both scenes. Corners are softened by stroking the
// same path with a round line join rather than by hand-rolling arcs.
export const MarketArrow: React.FC<ArrowProps> = ({
  direction,
  x,
  tipY,
  tailY,
  shaftWidth,
  headWidth,
  headHeight,
  tailColor,
  tipColor,
  glowColor,
  glowBlur,
  glowOpacity,
  opacity = 1,
}) => {
  const dir = direction === "down" ? 1 : -1;
  const shoulderY = tipY - dir * headHeight;
  const hs = shaftWidth / 2;
  const hh = headWidth / 2;

  const d = [
    `M ${x - hs} ${tailY}`,
    `L ${x + hs} ${tailY}`,
    `L ${x + hs} ${shoulderY}`,
    `L ${x + hh} ${shoulderY}`,
    `L ${x} ${tipY}`,
    `L ${x - hh} ${shoulderY}`,
    `L ${x - hs} ${shoulderY}`,
    "Z",
  ].join(" ");

  // SVG defs are document-global, and <DepthOfField> renders the whole
  // scene twice, so these ids have to be unique per rendered copy.
  // Colons are stripped: they are legal in an id but awkward in url(#...).
  const uid = useId().replace(/:/g, "");
  const gradientId = `arrow-grad-${uid}`;
  const glowId = `arrow-glow-${uid}`;
  const round = Math.max(2, shaftWidth * 0.1);

  return (
    <svg
      width={STAGE_WIDTH}
      height={STAGE_HEIGHT}
      viewBox={`0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`}
      style={{ position: "absolute", inset: 0, overflow: "visible", opacity }}
    >
      <defs>
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1={x}
          y1={tailY}
          x2={x}
          y2={tipY}
        >
          <stop offset="0%" stopColor={tailColor} />
          <stop offset="100%" stopColor={tipColor} />
        </linearGradient>
        <filter id={glowId} x="-70%" y="-40%" width="240%" height="180%">
          <feGaussianBlur stdDeviation={glowBlur} />
        </filter>
      </defs>
      <path
        d={d}
        fill={glowColor}
        filter={`url(#${glowId})`}
        opacity={glowOpacity}
      />
      <path
        d={d}
        fill={`url(#${gradientId})`}
        stroke={`url(#${gradientId})`}
        strokeWidth={round}
        strokeLinejoin="round"
      />
    </svg>
  );
};
