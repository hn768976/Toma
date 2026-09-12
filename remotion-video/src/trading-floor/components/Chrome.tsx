import React from "react";
import {
  CLOCK_DATE_LABEL,
  CLOCK_START_HOUR,
  CLOCK_START_MINUTE,
  STATUS_BAR_HEIGHT,
  TABS,
  TAB_BAR_HEIGHT,
  TOOLBAR_HEIGHT,
} from "../constants";
import { fmtClockShort } from "../data/format";
import { UI_FONT } from "../fonts";
import { useTheme } from "./ThemeContext";

/** The seven-tab header every window in the terminal carries. */
export const TabBar: React.FC<{ active: string }> = ({ active }) => {
  const t = useTheme();
  return (
    <div
      style={{
        height: TAB_BAR_HEIGHT,
        display: "flex",
        alignItems: "stretch",
        background: `linear-gradient(180deg, ${t.tabBarFrom}, ${t.tabBarTo})`,
        borderBottom: `1px solid ${t.tabBarBorder}`,
        flexShrink: 0,
      }}
    >
      {TABS.map((tab) => {
        const isActive = tab === active;
        return (
          <div
            key={tab}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: UI_FONT,
              fontSize: 13,
              letterSpacing: 0.2,
              color: isActive ? t.tabActiveText : t.tabText,
              background: isActive ? t.tabActiveBg : "transparent",
              margin: isActive ? "2px 1px" : 0,
              borderRadius: isActive ? 3 : 0,
            }}
          >
            {tab}
          </div>
        );
      })}
    </div>
  );
};

/** Symbol search field plus the three window buttons on the right. */
export const Toolbar: React.FC = () => {
  const t = useTheme();
  return (
    <div
      style={{
        height: TOOLBAR_HEIGHT,
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "0 8px",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 190,
          height: 15,
          background: t.inputBg,
          border: `1px solid ${t.inputBorder}`,
          borderRadius: 2,
          display: "flex",
          alignItems: "center",
          paddingLeft: 5,
          fontFamily: UI_FONT,
          fontSize: 9.5,
          color: t.inputText,
        }}
      >
        Enter Symbol
      </div>
      <CircleIcon glyph="search" />
      <div style={{ flex: 1 }} />
      <CircleIcon glyph="dot" />
      <CircleIcon glyph="tag" />
      <CircleIcon glyph="minus" />
    </div>
  );
};

const CircleIcon: React.FC<{ glyph: "search" | "dot" | "tag" | "minus" }> = ({
  glyph,
}) => {
  const t = useTheme();
  return (
    <div
      style={{
        width: 15,
        height: 15,
        borderRadius: "50%",
        border: `1px solid ${t.iconRing}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width={9} height={9} viewBox="0 0 12 12">
        {glyph === "search" ? (
          <g
            stroke={t.iconFill}
            strokeWidth={1.4}
            fill="none"
            strokeLinecap="round"
          >
            <circle cx={5} cy={5} r={3.1} />
            <path d="M7.4 7.4 L10 10" />
          </g>
        ) : glyph === "minus" ? (
          <path
            d="M2.5 6 H9.5"
            stroke={t.iconFill}
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        ) : glyph === "tag" ? (
          <path
            d="M2 7 L7 2 L10 5 L5 10 Z"
            fill={t.iconFill}
            opacity={0.85}
          />
        ) : (
          <circle cx={6} cy={6} r={3.4} fill={t.iconFill} opacity={0.85} />
        )}
      </svg>
    </div>
  );
};

/** All / TFEX / Both / Symbol filter above the ticker columns. */
export const SegmentedControl: React.FC<{ active: string }> = ({ active }) => {
  const t = useTheme();
  const items = ["All", "TFEX", "Both", "Symbol"];
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        paddingTop: 3,
        paddingBottom: 4,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          background: t.segmentBg,
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        {items.map((item) => (
          <div
            key={item}
            style={{
              width: 66,
              height: 15,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: UI_FONT,
              fontSize: 9.5,
              color: item === active ? t.segmentActiveText : t.segmentText,
              background: item === active ? t.segmentActiveBg : "transparent",
            }}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
};

/** Clock on the left, capture indicator on the right. */
export const StatusBar: React.FC<{ seconds: number }> = ({ seconds }) => {
  const t = useTheme();
  return (
    <div
      style={{
        height: STATUS_BAR_HEIGHT,
        display: "flex",
        alignItems: "center",
        padding: "0 7px",
        fontFamily: UI_FONT,
        fontSize: 10,
        color: t.textMuted,
        flexShrink: 0,
      }}
    >
      <span style={{ letterSpacing: 0.3 }}>
        {fmtClockShort(CLOCK_START_HOUR, CLOCK_START_MINUTE, seconds)}
      </span>
      <span style={{ marginLeft: 7, opacity: 0.75 }}>{CLOCK_DATE_LABEL}</span>
      <div style={{ flex: 1 }} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "1px 6px",
          borderRadius: 7,
          background: t.name === "dark" ? "rgba(220,40,40,0.22)" : "#fdeaea",
        }}
      >
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "#ff3b3b",
            display: "block",
          }}
        />
        <span style={{ fontSize: 9, color: t.down, letterSpacing: 0.6 }}>
          LIVE
        </span>
      </div>
    </div>
  );
};

/** One of the four monitors in the 2x2 wall. */
export const Window: React.FC<{
  x: number;
  y: number;
  width: number;
  height: number;
  filter?: string;
  children: React.ReactNode;
}> = ({ x, y, width, height, filter, children }) => {
  const t = useTheme();
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height,
        background: t.windowBg,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        filter,
      }}
    >
      {children}
    </div>
  );
};
