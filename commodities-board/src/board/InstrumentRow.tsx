import React from "react";
import {
  COL_ICON_X,
  COL_NAME_X,
  COL_PCT_RIGHT,
  COL_PRICE_RIGHT,
  ICON_SIZE,
  NAME_FONT_SIZE,
  PCT_FONT_SIZE,
  PLANE_WIDTH,
  PRICE_FONT_SIZE,
  ROW_HEIGHT,
} from "../constants";
import { FONT_TEXT, TABULAR } from "../fonts";
import { InstrumentIcon } from "../icons/Icons";
import type { Instrument, PriceModel } from "../data/instruments";
import { formatPct, formatPrice, quoteAt } from "../data/quote";
import type { Theme } from "../theme";

/** Push a hex colour toward white or toward black by `amount`. */
const mixToward = (hex: string, white: boolean, amount: number) => {
  const n = parseInt(hex.slice(1), 16);
  const target = white ? 255 : 0;
  const m = (c: number) => Math.round(c + (target - c) * amount);
  return `rgb(${m((n >> 16) & 255)},${m((n >> 8) & 255)},${m(n & 255)})`;
};

const Marker: React.FC<{ up: boolean; size: number; color: string }> = ({
  up,
  size,
  color,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 10 10"
    style={{ display: "block", flexShrink: 0 }}
  >
    <path d={up ? "M5 1.6 9 8.4H1z" : "M5 8.4 1 1.6h8z"} fill={color} />
  </svg>
);

export const InstrumentRow: React.FC<{
  instrument: Instrument;
  model: PriceModel;
  frame: number;
  theme: Theme;
  /** Alternating tint, so a row still reads as one unit across the tilt. */
  band: boolean;
}> = ({ instrument, model, frame, theme, band }) => {
  const q = quoteAt(instrument, model, frame);
  const base = q.up ? theme.up : theme.down;
  // One underlying value drives all three readouts, so the price, the
  // percentage and the marker can never disagree with each other.
  const pctColor =
    q.flash > 0
      ? mixToward(base, theme.flashTowardWhite, theme.flashAmount * q.flash)
      : base;

  return (
    <div
      style={{
        position: "relative",
        width: PLANE_WIDTH,
        height: ROW_HEIGHT,
        borderBottom: `2px solid ${theme.rowRule}`,
        background: band ? theme.rowBand : undefined,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: COL_ICON_X,
          top: (ROW_HEIGHT - ICON_SIZE) / 2,
        }}
      >
        <InstrumentIcon
          kind={instrument.icon}
          color={instrument.accent}
          size={ICON_SIZE}
          glyphColor={theme.name === "dark" ? "#0d1117" : "#ffffff"}
        />
      </div>

      <div
        style={{
          position: "absolute",
          left: COL_NAME_X,
          top: 0,
          height: ROW_HEIGHT,
          display: "flex",
          alignItems: "center",
          fontFamily: FONT_TEXT,
          fontWeight: 700,
          fontSize: NAME_FONT_SIZE,
          letterSpacing: NAME_FONT_SIZE * 0.015,
          color: theme.rowText,
          whiteSpace: "nowrap",
        }}
      >
        {instrument.name}
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: COL_PRICE_RIGHT,
          height: ROW_HEIGHT,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          fontFamily: FONT_TEXT,
          fontWeight: 700,
          fontSize: PRICE_FONT_SIZE,
          color: theme.priceText,
          ...TABULAR,
        }}
      >
        {formatPrice(q.price, instrument.decimals)}
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: COL_PCT_RIGHT,
          height: ROW_HEIGHT,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: PCT_FONT_SIZE * 0.34,
          fontFamily: FONT_TEXT,
          fontWeight: 700,
          fontSize: PCT_FONT_SIZE,
          color: pctColor,
          textShadow:
            q.flash > 0 && theme.flashGlow > 0
              ? `0 0 ${PCT_FONT_SIZE * theme.flashGlow * q.flash}px ${base}`
              : "none",
          ...TABULAR,
        }}
      >
        <Marker up={q.up} size={PCT_FONT_SIZE * 0.58} color={pctColor} />
        <span>{formatPct(q.pct)}</span>
      </div>
    </div>
  );
};
