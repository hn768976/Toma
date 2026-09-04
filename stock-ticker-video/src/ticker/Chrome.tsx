import React from "react";
import { COMPANY_NAME, SESSION_DATE, SESSION_OPEN_MINUTES, TICKER } from "./constants";
import { formatChange, formatPercent, formatPrice, TABULAR } from "./format";
import type { Layout } from "./geometry";
import { minuteLabel } from "./series";
import type { Palette } from "./themes";

/**
 * Terminal chrome: identity on the left, last price on the right, and the
 * session line whose end time advances with the playhead.
 */
export const Chrome: React.FC<{
  layout: Layout;
  palette: Palette;
  fontFamily: string;
  price: number;
  change: number;
  changePercent: number;
  minuteIndex: number;
  headerOpacity: number;
}> = ({
  layout,
  palette,
  fontFamily,
  price,
  change,
  changePercent,
  minuteIndex,
  headerOpacity,
}) => {
  const { height, marginLeft, marginRight, width } = layout;
  const rightInset = width - marginRight;

  return (
    <div style={{ position: "absolute", inset: 0, fontFamily }}>
      <div
        style={{
          position: "absolute",
          left: marginLeft,
          top: height * 0.072,
          display: "flex",
          alignItems: "baseline",
          gap: width * 0.019,
          opacity: headerOpacity,
        }}
      >
        <span
          style={{
            fontSize: height * 0.115,
            fontWeight: 800,
            letterSpacing: "-0.025em",
            lineHeight: 1,
            color: palette.price,
          }}
        >
          {TICKER}
        </span>
        <span
          style={{
            fontSize: height * 0.031,
            fontWeight: 400,
            fontStyle: "italic",
            letterSpacing: "0.005em",
            color: palette.text,
          }}
        >
          {COMPANY_NAME}
        </span>
      </div>

      <div
        style={{
          position: "absolute",
          right: rightInset,
          top: height * 0.078,
          textAlign: "right",
          opacity: headerOpacity,
          ...TABULAR,
        }}
      >
        <div
          style={{
            fontSize: height * 0.046,
            fontWeight: 600,
            lineHeight: 1.1,
            color: palette.price,
          }}
        >
          {formatPrice(price)}
        </div>
        <div
          style={{
            fontSize: height * 0.031,
            fontWeight: 600,
            lineHeight: 1.3,
            color: palette.accent,
          }}
        >
          {formatChange(change)} ({formatPercent(changePercent)})
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          right: rightInset,
          top: height * 0.212,
          opacity: headerOpacity,
          fontSize: height * 0.024,
          fontWeight: 500,
          letterSpacing: "0.01em",
          color: palette.text,
          ...TABULAR,
        }}
      >
        {`${SESSION_DATE}, ${minuteLabel(1, SESSION_OPEN_MINUTES)} – ${minuteLabel(
          minuteIndex,
          SESSION_OPEN_MINUTES,
        )}`}
      </div>

      <div
        style={{
          position: "absolute",
          left: marginLeft,
          right: rightInset,
          top: height * 0.268,
          height: layout.unit * 2,
          background: palette.grid,
        }}
      />
    </div>
  );
};
