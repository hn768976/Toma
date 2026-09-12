import React from "react";
import { TAPE_ROW_HEIGHT } from "../constants";
import { fmtInt, fmtPrice } from "../data/format";
import { Print, visiblePrints } from "../data/tape";
import { noise2 } from "../data/random";
import { NUM_FONT, UI_FONT } from "../fonts";
import { useTheme } from "../components/ThemeContext";

// One Symbol / Side / Volume / Price column of the tape. Rows snap in at
// the top and push the column down — no smooth scroll, matching how a
// real tape window repaints.
export const TickerColumn: React.FC<{
  frame: number;
  prints: Print[];
  rows: number;
  width: number;
  columnIndex: number;
  showDivider: boolean;
}> = ({ frame, prints, rows, width, columnIndex, showDivider }) => {
  const t = useTheme();
  const visible = visiblePrints(prints, frame, rows);

  // A single row somewhere in the column carries a hover highlight that
  // moves every couple of seconds.
  const highlighted = Math.floor(
    noise2(Math.floor(frame / 47), columnIndex, 13) * rows,
  );

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
    whiteSpace: "nowrap",
    overflow: "hidden",
  };

  return (
    <div
      style={{
        width,
        boxSizing: "border-box",
        padding: "0 8px",
        borderLeft: showDivider ? `1px solid ${t.divider}` : undefined,
      }}
    >
      <div style={{ display: "flex", height: 24, alignItems: "center" }}>
        <span style={{ ...head, width: "38%" }}>Symbol</span>
        <span style={{ ...head, width: "12%", textAlign: "center" }}>Side</span>
        <span style={{ ...head, width: "26%", textAlign: "right" }}>Volume</span>
        <span style={{ ...head, width: "24%", textAlign: "right" }}>Price</span>
      </div>

      {visible.map((p, i) => {
        const priceColour =
          p.dir === 1 ? t.up : p.dir === -1 ? t.down : t.flat;
        return (
          <div
            key={`${p.frame}-${i}`}
            style={{
              display: "flex",
              alignItems: "center",
              height: TAPE_ROW_HEIGHT,
              background: p.block
                ? t.blockRowBg
                : i === highlighted
                  ? t.rowHighlight
                  : "transparent",
            }}
          >
            <span
              style={{
                ...cell,
                width: "38%",
                fontFamily: UI_FONT,
                fontSize: 12.5,
                color: p.block ? t.blockRowText : priceColour,
                textOverflow: "clip",
              }}
            >
              {p.symbol}
            </span>
            <span
              style={{
                ...cell,
                width: "12%",
                textAlign: "center",
                color: p.side === "B" ? t.sideBuy : t.sideSell,
              }}
            >
              {p.side}
            </span>
            <span
              style={{ ...cell, width: "26%", textAlign: "right", color: t.volume }}
            >
              {fmtInt(p.volume)}
            </span>
            <span
              style={{
                ...cell,
                width: "24%",
                textAlign: "right",
                color: p.block ? t.blockRowText : priceColour,
              }}
            >
              {fmtPrice(p.price)}
              <span style={{ fontSize: 8, marginLeft: 2 }}>
                {p.dir === 1 ? "▲" : p.dir === -1 ? "▼" : "◆"}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
};
