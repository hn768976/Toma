import React from "react";
import { fmtInt } from "../data/format";
import { gauges } from "../data/market";
import { NUM_FONT, UI_FONT } from "../fonts";
import { useTheme } from "../components/ThemeContext";

// Buy versus sell value, as a single stacked bar per sector. The bar is
// the whole message here, so the numbers sit above it rather than
// competing with it.
export const Gauges: React.FC<{ frame: number; width: number }> = ({
  frame,
  width,
}) => {
  const t = useTheme();
  const rows = gauges(frame);

  return (
    <div
      style={{
        width,
        padding: "6px 10px 0",
        boxSizing: "border-box",
        borderLeft: `1px solid ${t.divider}`,
      }}
    >
      {rows.map((g) => (
        <div key={g.label} style={{ marginBottom: 16 }}>
          <div
            style={{
              fontFamily: UI_FONT,
              fontSize: 11.5,
              color: t.textMuted,
              marginBottom: 2,
            }}
          >
            {g.label}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontFamily: NUM_FONT,
              fontSize: 10.5,
              fontVariantNumeric: "tabular-nums",
              marginBottom: 2,
            }}
          >
            <span style={{ color: t.gaugeBuyText }}>{fmtInt(g.buyValue)}</span>
            <span style={{ color: t.gaugeSellText }}>{fmtInt(g.sellValue)}</span>
          </div>
          <div
            style={{
              display: "flex",
              height: 13,
              borderRadius: 1,
              overflow: "hidden",
              background: t.gaugeTrack,
            }}
          >
            <div
              style={{
                width: `${g.buyShare * 100}%`,
                background: t.gaugeBuy,
                display: "flex",
                alignItems: "center",
                paddingLeft: 4,
                fontFamily: UI_FONT,
                fontSize: 8.5,
                color: t.name === "dark" ? "#053a44" : "#ffffff",
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              Buy {Math.round(g.buyShare * 100)}%
            </div>
            <div
              style={{
                flex: 1,
                background: t.gaugeSell,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                paddingRight: 4,
                fontFamily: UI_FONT,
                fontSize: 8.5,
                color: t.name === "dark" ? "#4a1130" : "#ffffff",
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              Sell {100 - Math.round(g.buyShare * 100)}%
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
