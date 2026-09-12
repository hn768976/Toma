import React from "react";
import { FONT_DISPLAY, PILL } from "./constants";
import { useTheme } from "./theme";

export type TogglePillProps = {
  /** 0 = 4G (knob left), 1 = 5G (knob right). */
  progress: number;
  reveal: number;
};

/**
 * The network switch. The knob slides across, and the label crossfades from
 * "4G" (dim, sitting to the right of the knob) to "5G" (lit, to the left).
 */
export const TogglePill: React.FC<TogglePillProps> = ({ progress, reveal }) => {
  const theme = useTheme();
  const { cx, cy, width, height, knobRadius, knobTravel, textSize } = PILL;
  const knobX = cx - knobTravel + knobTravel * 2 * progress;
  const textX = cx + knobTravel - knobTravel * 2 * progress;

  return (
    <g opacity={reveal}>
      <rect
        x={cx - width / 2}
        y={cy - height / 2}
        width={width}
        height={height}
        rx={height / 2}
        fill={theme.pillTrack}
      />
      <text
        x={textX}
        y={cy}
        fill={theme.pillTextOff}
        fontFamily={FONT_DISPLAY}
        fontWeight={700}
        fontSize={textSize}
        letterSpacing={0.5}
        textAnchor="middle"
        dominantBaseline="central"
        opacity={1 - progress}
      >
        4G
      </text>
      <text
        x={textX}
        y={cy}
        fill={theme.accent}
        fontFamily={FONT_DISPLAY}
        fontWeight={700}
        fontSize={textSize}
        letterSpacing={0.5}
        textAnchor="middle"
        dominantBaseline="central"
        opacity={progress}
      >
        5G
      </text>
      <circle cx={knobX} cy={cy} r={knobRadius} fill={theme.accent} />
    </g>
  );
};
