import React from "react";
import { fmtInt, fmtPrice } from "../data/format";
import {
  FOCUS_CEILING,
  FOCUS_FLOOR,
  FOCUS_HIGH,
  FOCUS_LOW,
  FOCUS_PREV_CLOSE,
} from "../data/symbols";
import { noise2 } from "../data/random";
import { NUM_FONT, UI_FONT } from "../fonts";
import { useTheme } from "../components/ThemeContext";

export const StatsGrid: React.FC<{ frame: number; width: number }> = ({
  frame,
  width,
}) => {
  const t = useTheme();
  const epoch = Math.floor(Math.max(0, frame) / 14);
  const volume = 81600 + Math.floor(noise2(epoch, 1, 5) * 4200) * 100;
  const value = (volume * 82.46) / 1000;

  const rows: [string, string, string, string, string, string][] = [
    ["Volume", fmtInt(volume), t.text, "Value(K)", fmtInt(value), t.text],
    ["High", fmtPrice(FOCUS_HIGH), t.up, "Low", fmtPrice(FOCUS_LOW), t.up],
    [
      "Ceiling",
      fmtPrice(FOCUS_CEILING),
      t.up,
      "Floor",
      fmtPrice(FOCUS_FLOOR),
      t.down,
    ],
    [
      "Average Price",
      fmtPrice(82.4544, 4),
      t.up,
      "Previous Close",
      fmtPrice(FOCUS_PREV_CLOSE),
      t.text,
    ],
    [
      "Average Buy",
      fmtPrice(82.46),
      t.up,
      "Average Sell",
      fmtPrice(82.5),
      t.up,
    ],
  ];

  const label: React.CSSProperties = {
    fontFamily: UI_FONT,
    fontSize: 11.5,
    color: t.textMuted,
  };
  const value_: React.CSSProperties = {
    fontFamily: NUM_FONT,
    fontSize: 11.5,
    fontVariantNumeric: "tabular-nums",
    textAlign: "right",
  };

  return (
    <div
      style={{
        width,
        padding: "8px 9px 0",
        boxSizing: "border-box",
        borderTop: `1px solid ${t.divider}`,
      }}
    >
      {rows.map(([l1, v1, c1, l2, v2, c2], i) => (
        <div
          key={i}
          style={{ display: "flex", alignItems: "center", height: 19 }}
        >
          <span style={{ ...label, width: "26%" }}>{l1}</span>
          <span style={{ ...value_, width: "24%", color: c1 }}>{v1}</span>
          <span style={{ ...label, width: "28%", paddingLeft: 12 }}>{l2}</span>
          <span style={{ ...value_, width: "22%", color: c2 }}>{v2}</span>
        </div>
      ))}
    </div>
  );
};
