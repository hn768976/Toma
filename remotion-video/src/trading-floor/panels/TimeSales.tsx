import React from "react";
import { SALES_ROW_HEIGHT } from "../constants";
import { fmtClock, fmtInt, fmtPrice } from "../data/format";
import { FocusPrint } from "../data/market";
import { lastArrivedIndex } from "../data/tape";
import { CLOCK_START_HOUR, CLOCK_START_MINUTE, FPS } from "../constants";
import { NUM_FONT, UI_FONT } from "../fonts";
import { useTheme } from "../components/ThemeContext";

const ROWS = 12;

export const TimeSales: React.FC<{
  frame: number;
  width: number;
  prints: FocusPrint[];
}> = ({ frame, width, prints }) => {
  const t = useTheme();
  const end = lastArrivedIndex(prints, frame);
  const visible =
    end < 0 ? [] : prints.slice(Math.max(0, end - ROWS + 1), end + 1).reverse();

  const head: React.CSSProperties = {
    fontFamily: UI_FONT,
    fontSize: 11,
    color: t.columnHeader,
    letterSpacing: 0.3,
  };
  const cell: React.CSSProperties = {
    fontFamily: NUM_FONT,
    fontSize: 12,
    fontVariantNumeric: "tabular-nums",
  };

  // The newest print is briefly held under a highlight, the way a live
  // blotter flashes the row it just received.
  const flashRow = visible.length > 0 && frame - visible[0].frame < 3;

  return (
    <div
      style={{
        width,
        padding: "0 8px",
        boxSizing: "border-box",
        borderLeft: `1px solid ${t.divider}`,
      }}
    >
      <div style={{ display: "flex", height: 22, alignItems: "center" }}>
        <span style={{ ...head, width: "26%" }}>Time</span>
        <span style={{ ...head, width: "13%", textAlign: "center" }}>Side</span>
        <span style={{ ...head, width: "23%", textAlign: "right" }}>Volume</span>
        <span style={{ ...head, width: "21%", textAlign: "right" }}>Price</span>
        <span style={{ ...head, width: "17%", textAlign: "right" }}>Change</span>
      </div>

      {visible.map((p, i) => {
        const tickColour = p.change > 0 ? t.up : p.change < 0 ? t.down : t.flat;
        const mark = p.change > 0 ? "\u25b2" : p.change < 0 ? "\u25bc" : "\u25c6";
        return (
        <div
          key={p.frame + "-" + i}
          style={{
            display: "flex",
            alignItems: "center",
            height: SALES_ROW_HEIGHT,
            background: i === 0 && flashRow ? t.rowHighlight : "transparent",
          }}
        >
          <span style={{ ...cell, width: "26%", color: t.textMuted }}>
            {fmtClock(CLOCK_START_HOUR, CLOCK_START_MINUTE, p.frame / FPS)}
          </span>
          <span
            style={{
              ...cell,
              width: "13%",
              textAlign: "center",
              color: p.side === "B" ? t.sideBuy : t.sideSell,
            }}
          >
            {p.side}
          </span>
          <span style={{ ...cell, width: "23%", textAlign: "right", color: t.volume }}>
            {fmtInt(p.volume)}
          </span>
          <span
            style={{ ...cell, width: "21%", textAlign: "right", color: tickColour }}
          >
            {fmtPrice(p.price)}
            <span style={{ fontSize: 8, marginLeft: 2 }}>{mark}</span>
          </span>
          <span
            style={{ ...cell, width: "17%", textAlign: "right", color: tickColour }}
          >
            {fmtPrice(p.change)}
          </span>
        </div>
        );
      })}
    </div>
  );
};
