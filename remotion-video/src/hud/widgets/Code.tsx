import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { saw } from "../anim";
import { rngFor } from "../random";
import { FONT_MONO, type HudTheme } from "../theme";
import { CODE_LINES } from "../text";

// A slowly scrolling block of pseudo-source with a blinking caret. Held
// at low contrast: in the reference these panels are texture that hints
// at "a system is running", never something you are meant to read.
export const CodeBlock: React.FC<{
  theme: HudTheme;
  x: number;
  y: number;
  lines?: number;
  lineHeight?: number;
  fontSize?: number;
  /** whole scroll passes per loop */
  scrollCycles?: number;
  opacity?: number;
  /** clip width in design units */
  width?: number;
  seed: string;
}> = ({
  theme,
  x,
  y,
  lines = 22,
  lineHeight = 15,
  fontSize = 11,
  scrollCycles = 1,
  opacity = 0.42,
  width = 420,
  seed,
}) => {
  const frame = useCurrentFrame();

  const start = useMemo(
    () => Math.floor(rngFor(`${seed}:code`)() * CODE_LINES.length),
    [seed],
  );

  // Scroll by whole lines so glyphs stay on the pixel grid, and wrap
  // through the pool so the block never runs out of content.
  const scrolled = saw(frame, scrollCycles) * CODE_LINES.length;
  const offset = Math.floor(scrolled);
  const subpixel = (scrolled - offset) * lineHeight;

  const caretOn = saw(frame, 20) < 0.5;

  return (
    <g transform={`translate(${x} ${y})`} opacity={opacity}>
      <clipPath id={`code-clip-${seed}`}>
        <rect x={-4} y={-lineHeight} width={width} height={lines * lineHeight + 6} />
      </clipPath>
      <g clipPath={`url(#code-clip-${seed})`}>
        <g transform={`translate(0 ${-subpixel})`}>
          {Array.from({ length: lines + 1 }, (_, i) => {
            const line = CODE_LINES[(start + offset + i) % CODE_LINES.length];
            return (
              <text
                key={i}
                y={i * lineHeight}
                fontFamily={FONT_MONO}
                fontSize={fontSize}
                fill={theme.text}
              >
                {line}
              </text>
            );
          })}
        </g>
      </g>
      {caretOn ? (
        <rect
          x={0}
          y={lines * lineHeight - fontSize + 2}
          width={fontSize * 0.55}
          height={fontSize}
          fill={theme.accent}
        />
      ) : null}
    </g>
  );
};
