import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { buildRow, rowIndent, type Token } from "./code-matrix";
import { FONT_MONO } from "./constants";

export type MatrixColors = {
  dim: string;
  hot: string;
  accent: string;
};

type Props = {
  /** Size of the field in local (pre-transform) pixels. */
  width: number;
  height: number;
  fontSize: number;
  rowHeight: number;
  /** Vertical scroll speed in local px per frame. Negative scrolls down. */
  speed: number;
  colors: MatrixColors;
  opacity?: number;
  /** Extra brightness variation; 0 keeps every token at its base alpha. */
  flicker?: number;
};

// An endlessly scrolling field of pseudo-source-code. Only the rows that
// fit on screen exist in the DOM: as the field scrolls, row indices shift
// and each slot regenerates its text, so a 240-frame scroll costs the same
// as a single frame.
export const CodeMatrix: React.FC<Props> = ({
  width,
  height,
  fontSize,
  rowHeight,
  speed,
  colors,
  opacity = 1,
  flicker = 1,
}) => {
  const frame = useCurrentFrame();

  const scroll = frame * speed;
  const firstRow = Math.floor(scroll / rowHeight);
  const offset = scroll - firstRow * rowHeight;
  const rowCount = Math.ceil(height / rowHeight) + 2;
  // Slow bucket so churning tokens re-roll a few times a second, not every frame.
  const bucket = Math.floor(frame / 11);

  const charWidth = fontSize * 0.6;
  // Average token is ~6 glyphs plus a 1.6-glyph gap; size each row so it
  // runs past the right edge of the field whatever the resolution.
  const tokensPerRow = Math.ceil(width / (charWidth * 8.2)) + 4;

  const rows = useMemo(() => {
    const out: { index: number; tokens: Token[]; indent: number }[] = [];
    for (let i = 0; i < rowCount; i++) {
      const index = firstRow + i;
      out.push({
        index,
        tokens: buildRow(index, bucket, tokensPerRow),
        indent: rowIndent(index),
      });
    }
    return out;
  }, [firstRow, rowCount, bucket, tokensPerRow]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        width,
        height,
        overflow: "hidden",
        opacity,
        fontFamily: FONT_MONO,
        fontSize,
        lineHeight: `${rowHeight}px`,
        fontWeight: 400,
        letterSpacing: fontSize * 0.04,
      }}
    >
      {rows.map((row, i) => {
        // A slow diagonal brightness sweep keeps the field alive without
        // any single token ever popping.
        const sweep =
          0.5 +
          0.5 *
            Math.sin((row.index * 0.42 - frame * 0.075) * 0.6);

        return (
          <div
            key={row.index}
            style={{
              position: "absolute",
              top: i * rowHeight - offset,
              left: -row.indent * charWidth,
              whiteSpace: "pre",
              display: "flex",
              gap: charWidth * 1.6,
            }}
          >
            {row.tokens.map((token, t) => {
              const pulse =
                0.5 +
                0.5 * Math.sin(row.index * 1.7 + t * 2.3 + frame * 0.11);
              const alpha =
                token.alpha *
                (1 - flicker * 0.35 + flicker * 0.35 * (0.45 * pulse + 0.55 * sweep));
              const color =
                token.tone === 2
                  ? colors.accent
                  : token.tone === 1
                    ? colors.hot
                    : colors.dim;

              return (
                <span
                  key={t}
                  style={{
                    color,
                    opacity: Math.min(1, Math.max(0.06, alpha)),
                  }}
                >
                  {token.text}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
