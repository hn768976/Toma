import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { revealAt } from "../animation";
import { CHIP_FILL, FONT_LABEL, FONT_MONO } from "../constants";

export type LabelChipProps = {
  x: number;
  y: number;
  label: string;
  value?: string;
  percent?: string;
  appearAt?: number;
  appearDuration?: number;
  fontSize?: number;
  color?: string;
  chip?: boolean;
  chipColor?: string;
  valueColor?: string;
  // Where the value sits relative to the label.
  valuePlacement?: "below" | "right";
  anchor?: "start" | "middle";
};

// The tagged series callouts: a bold name riding a flat blue chip, with
// an optional mono value and percentage. Chip width is derived from the
// glyph count rather than measured in the DOM, which keeps the render
// deterministic and identical at 1080p and 4K.
export const LabelChip: React.FC<LabelChipProps> = ({
  x,
  y,
  label,
  value,
  percent,
  appearAt = 0,
  appearDuration = 18,
  fontSize = 34,
  color = "#ffffff",
  chip = true,
  chipColor = CHIP_FILL,
  valueColor = "#9fd6ff",
  valuePlacement = "below",
  anchor = "start",
}) => {
  const frame = useCurrentFrame();
  const reveal = revealAt(frame, appearAt, appearDuration);
  if (reveal <= 0) {
    return null;
  }

  const textWidth = label.length * fontSize * 0.455;
  const chipHeight = fontSize * 1.26;
  // The chip wipes open from the left behind the type.
  const chipWidth =
    (textWidth + fontSize * 0.52) * interpolate(reveal, [0, 1], [0.1, 1]);
  const chipX =
    anchor === "middle"
      ? x - textWidth / 2 - fontSize * 0.2
      : x - fontSize * 0.22;

  return (
    <g opacity={reveal}>
      {chip ? (
        <rect
          x={chipX + fontSize * 0.34}
          y={y - chipHeight * 0.78}
          width={chipWidth}
          height={chipHeight}
          fill={chipColor}
          opacity={0.9}
        />
      ) : null}
      <text
        x={x}
        y={y}
        fill={color}
        fontFamily={FONT_LABEL}
        fontSize={fontSize}
        fontWeight={700}
        textAnchor={anchor}
        letterSpacing={fontSize * 0.005}
      >
        {label}
      </text>
      {value ? (
        <text
          x={valuePlacement === "below" ? x : x + textWidth + fontSize * 0.9}
          y={valuePlacement === "below" ? y + fontSize * 1.5 : y}
          fill={valueColor}
          fontFamily={FONT_MONO}
          fontSize={fontSize * 0.82}
          fontWeight={500}
          textAnchor={anchor}
        >
          {value}
        </text>
      ) : null}
      {percent ? (
        <text
          x={valuePlacement === "below" ? x : x + textWidth + fontSize * 0.9}
          y={y + fontSize * (valuePlacement === "below" ? 2.62 : 1.3)}
          fill={valueColor}
          fontFamily={FONT_MONO}
          fontSize={fontSize * 0.74}
          fontWeight={400}
          textAnchor={anchor}
          opacity={0.85}
        >
          {percent}
        </text>
      ) : null}
    </g>
  );
};
