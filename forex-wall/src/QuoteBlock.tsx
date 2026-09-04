import React from "react";
import {
  BLOCK_H,
  BLOCK_W,
  CHANGE_FS,
  COL_A,
  COL_B,
  COL_GAP,
  LINE_1_H,
  LINE_2_H,
  PAIR_FS,
  PCT_FS,
  RATE_FS,
  TRIANGLE_H,
  TRIANGLE_W,
} from "./constants";
import { TABULAR } from "./load-fonts";
import type { Quote } from "./quote";
import type { Theme } from "./theme";

/**
 * Drawn with borders rather than a glyph: the arrow must never depend on a
 * character that the subsetted Latin font does not carry.
 */
const Triangle: React.FC<{ up: boolean; color: string; u: number }> = ({
  up,
  color,
  u,
}) => (
  <div
    style={{
      width: 0,
      height: 0,
      borderLeft: `${(TRIANGLE_W / 2) * u}px solid transparent`,
      borderRight: `${(TRIANGLE_W / 2) * u}px solid transparent`,
      ...(up
        ? { borderBottom: `${TRIANGLE_H * u}px solid ${color}` }
        : { borderTop: `${TRIANGLE_H * u}px solid ${color}` }),
      flex: "none",
    }}
  />
);

export type QuoteBlockProps = {
  quote: Quote;
  theme: Theme;
  /** Brightness for this depth, 0..1. */
  depth: number;
  /** Reference-px -> composition-px factor. */
  u: number;
};

/**
 * Note there is deliberately no `filter` anywhere in this component: any
 * filter here would force the browser to rasterise the block and then
 * magnify that raster through the perspective, softening the type. Depth of
 * field is applied a level up, per depth slice, in screen space.
 */
export const QuoteBlock: React.FC<QuoteBlockProps> = ({
  quote,
  theme,
  depth,
  u,
}) => {
  const move = quote.up ? theme.up : theme.down;

  return (
    <div
      style={{
        position: "relative",
        width: BLOCK_W * u,
        height: BLOCK_H * u,
        opacity: depth,
      }}
    >
      {quote.flash > 0 ? (
        <div
          style={{
            position: "absolute",
            left: -22 * u,
            top: -6 * u,
            width: (BLOCK_W + 44) * u,
            height: (BLOCK_H + 16) * u,
            background: move,
            opacity: quote.flash * theme.flashAlpha,
          }}
        />
      ) : null}

      <div style={{ position: "relative" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            height: LINE_1_H * u,
          }}
        >
          <div
            style={{
              width: COL_A * u,
              fontSize: PAIR_FS * u,
              lineHeight: 1,
              color: theme.text,
              letterSpacing: 0.5 * u,
              whiteSpace: "nowrap",
            }}
          >
            {quote.code}
          </div>
          <div style={{ width: COL_GAP * u }} />
          <div
            style={{
              width: COL_B * u,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 22 * u,
            }}
          >
            <Triangle up={quote.up} color={move} u={u} />
            <span
              style={{
                fontSize: CHANGE_FS * u,
                lineHeight: 1,
                color: move,
                ...TABULAR,
              }}
            >
              {quote.change}
            </span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            height: LINE_2_H * u,
          }}
        >
          <div
            style={{
              width: COL_A * u,
              fontSize: RATE_FS * u,
              lineHeight: 1,
              color: theme.text,
              textShadow:
                theme.bloom > 0
                  ? `0 0 ${13 * u}px rgba(190, 220, 255, ${0.2 * theme.bloom * depth})`
                  : undefined,
              ...TABULAR,
            }}
          >
            {quote.rate}
          </div>
          <div style={{ width: COL_GAP * u }} />
          <div
            style={{
              width: COL_B * u,
              fontSize: PCT_FS * u,
              lineHeight: 1,
              color: move,
              textAlign: "right",
              ...TABULAR,
            }}
          >
            {quote.pct}
          </div>
        </div>
      </div>
    </div>
  );
};
