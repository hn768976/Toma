import React from "react";
import { BOOK_ROW_HEIGHT } from "../constants";
import { fmtInt, fmtPrice } from "../data/format";
import { bookHighlightRow, orderBook } from "../data/market";
import { FOCUS_LAST } from "../data/symbols";
import { NUM_FONT, UI_FONT } from "../fonts";
import { useTheme } from "../components/ThemeContext";

const HEAD: React.CSSProperties = {
  fontFamily: UI_FONT,
  fontSize: 11,
  letterSpacing: 0.3,
};

const CELL: React.CSSProperties = {
  fontFamily: NUM_FONT,
  fontSize: 12.5,
  fontVariantNumeric: "tabular-nums",
};

export const DepthLadder: React.FC<{ frame: number; width: number }> = ({
  frame,
  width,
}) => {
  const t = useTheme();
  const levels = orderBook(frame);
  const highlight = bookHighlightRow(frame);

  return (
    <div style={{ width, padding: "0 9px", boxSizing: "border-box" }}>
      {/* Last traded price and the change off the previous close. */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "flex-end",
          gap: 12,
          height: 48,
          paddingRight: 4,
        }}
      >
        <span
          style={{
            ...CELL,
            fontSize: 27,
            fontWeight: 700,
            color: t.flat,
            letterSpacing: -0.5,
          }}
        >
          {fmtPrice(FOCUS_LAST)}
        </span>
        <span
          style={{
            ...CELL,
            fontSize: 12,
            lineHeight: 1.25,
            color: t.flat,
            minWidth: 58,
            textAlign: "right",
          }}
        >
          0.00
          <br />
          0.00%
        </span>
      </div>

      <div style={{ display: "flex", color: t.columnHeader, marginBottom: 3 }}>
        <span style={{ ...HEAD, width: "23%", textAlign: "right" }}>Vol</span>
        <span style={{ ...HEAD, width: "23%", textAlign: "right" }}>Bid</span>
        <span style={{ ...HEAD, width: "12%" }} />
        <span style={{ ...HEAD, width: "20%", textAlign: "right" }}>Offer</span>
        <span style={{ ...HEAD, width: "22%", textAlign: "right" }}>Vol</span>
      </div>

      {levels.map((level, i) => (
        <div
          key={i}
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            height: BOOK_ROW_HEIGHT,
            background: i === highlight ? t.rowHighlight : "transparent",
          }}
        >
          {/* Depth micro-bars, drawn behind the numbers and growing away
              from the spread, the way a depth ladder shades its rows. */}
          <div
            style={{
              position: "absolute",
              right: "48%",
              top: BOOK_ROW_HEIGHT / 2 - 1.5,
              height: 3,
              width: `${level.bidShare * 6}%`,
              background: t.bidBar,
              opacity: 0.8,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "52%",
              top: BOOK_ROW_HEIGHT / 2 - 1.5,
              height: 3,
              width: `${level.offerShare * 6}%`,
              background: t.offerBar,
              opacity: 0.8,
            }}
          />
          <span
            style={{
              ...CELL,
              width: "23%",
              textAlign: "right",
              color: t.flat,
              zIndex: 1,
            }}
          >
            {fmtInt(level.bidVolume)}
          </span>
          <span
            style={{
              ...CELL,
              width: "23%",
              textAlign: "right",
              color: t.bid,
              zIndex: 1,
            }}
          >
            {fmtPrice(level.bidPrice)}
          </span>
          <span style={{ width: "12%" }} />
          <span
            style={{
              ...CELL,
              width: "20%",
              textAlign: "right",
              color: t.offer,
              zIndex: 1,
            }}
          >
            {fmtPrice(level.offerPrice)}
          </span>
          <span
            style={{
              ...CELL,
              width: "22%",
              textAlign: "right",
              color: t.flat,
              zIndex: 1,
            }}
          >
            {fmtInt(level.offerVolume)}
          </span>
        </div>
      ))}
    </div>
  );
};
