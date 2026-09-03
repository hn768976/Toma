import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { SUBTITLE_LINES, TITLE } from "../data";
import type { Layout } from "../layout";
import { FONT_FAMILY, type Theme } from "../theme";
import { SUBTITLE_TYPE, TITLE_TYPE } from "../timing";

/** How much of `text` is visible at `frame`, sliced by character. */
const typed = (text: string, frame: number, start: number, end: number) => {
  const shown = interpolate(frame, [start, end], [0, text.length], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return text.slice(0, Math.floor(shown));
};

/**
 * Title types on character by character; the two subtitle lines follow on the
 * same cadence, line one then line two.
 */
export const TitleBlock: React.FC<{
  layout: Layout;
  theme: Theme;
  ink: string;
}> = ({ layout, theme, ink }) => {
  const frame = useCurrentFrame();

  const totalSubtitleChars = SUBTITLE_LINES.reduce((n, l) => n + l.length, 0);
  const subtitleDuration = SUBTITLE_TYPE.end - SUBTITLE_TYPE.start;
  let charsBefore = 0;

  return (
    <g>
      <text
        x={layout.textLeftX}
        y={layout.titleBaselineY}
        fill={ink}
        fillOpacity={theme.alpha.title}
        fontFamily={FONT_FAMILY}
        fontSize={layout.titleSize}
        fontWeight={250}
      >
        {typed(TITLE, frame, TITLE_TYPE.start, TITLE_TYPE.end)}
      </text>

      {SUBTITLE_LINES.map((line, i) => {
        // Both lines share one character rate, so line two starts exactly
        // where line one finishes.
        const start =
          SUBTITLE_TYPE.start +
          (charsBefore / totalSubtitleChars) * subtitleDuration;
        charsBefore += line.length;
        const end =
          SUBTITLE_TYPE.start +
          (charsBefore / totalSubtitleChars) * subtitleDuration;
        return (
          <text
            key={line}
            x={layout.textLeftX}
            y={layout.subtitleBaselineY + i * layout.subtitleLineHeight}
            fill={ink}
            fillOpacity={theme.alpha.subtitle}
            fontFamily={FONT_FAMILY}
            fontSize={layout.subtitleSize}
            fontWeight={400}
          >
            {typed(line, frame, start, end)}
          </text>
        );
      })}
    </g>
  );
};
