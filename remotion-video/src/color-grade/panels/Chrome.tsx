import React from "react";
import { UI } from "../constants";
import { hash } from "../noise";
import { gradedSwatch } from "./PreviewMonitor";
import type { Grade } from "../grade";

// Secondary UI furniture: toolbars, control strips, the timeline and the
// media filmstrip.
//
// Almost all of it ends up well outside the focal plane, so it is built
// for low-frequency truth — right density, right rhythm, right colour
// temperature — rather than for detail that the defocus would destroy
// anyway. Everything is seeded off its index so it stays identical across
// frames and across render workers.

export const ToolbarRow: React.FC<{
  width: number;
  height: number;
  count: number;
  seed: number;
  accent?: string;
}> = ({ width, height, count, seed, accent = UI.cyan }) => (
  <div
    style={{
      width,
      height,
      display: "flex",
      alignItems: "center",
      gap: height * 0.42,
      padding: `0 ${height * 0.5}px`,
    }}
  >
    {Array.from({ length: count }, (_, i) => {
      const kind = hash(i, seed);
      const w = kind < 0.25 ? height * 1.6 : height * 0.62;
      const isRound = kind > 0.55;
      const lit = hash(i, seed + 3) > 0.62;
      return (
        <span
          key={i}
          style={{
            width: w,
            height: height * 0.62,
            borderRadius: isRound ? "50%" : height * 0.12,
            background: lit ? accent : "rgba(120,160,190,0.3)",
            opacity: lit ? 0.75 + hash(i, seed + 9) * 0.25 : 0.5,
            flex: "0 0 auto",
          }}
        />
      );
    })}
  </div>
);

export const ControlStrip: React.FC<{
  width: number;
  height: number;
  rows: number;
  seed: number;
}> = ({ width, height, rows, seed }) => {
  const rowH = height / rows;
  return (
    <div style={{ width, height }}>
      {Array.from({ length: rows }, (_, r) => (
        <div
          key={r}
          style={{
            height: rowH,
            display: "flex",
            alignItems: "center",
            gap: rowH * 0.3,
            padding: `0 ${rowH * 0.4}px`,
          }}
        >
          <span
            style={{
              width: rowH * 0.46,
              height: rowH * 0.46,
              borderRadius: "50%",
              background: "rgba(150,185,215,0.22)",
              border: "1px solid rgba(170,205,230,0.3)",
              flex: "0 0 auto",
            }}
          />
          <span
            style={{
              flex: 1,
              height: rowH * 0.2,
              borderRadius: rowH * 0.1,
              background: "linear-gradient(#0b1119, #182430)",
              position: "relative",
            }}
          >
            <span
              style={{
                position: "absolute",
                left: `${18 + hash(r, seed) * 62}%`,
                top: "50%",
                width: rowH * 0.16,
                height: rowH * 0.44,
                marginTop: -rowH * 0.22,
                borderRadius: rowH * 0.05,
                background: "#a8bac9",
              }}
            />
          </span>
          <span
            style={{
              width: rowH * 1.5,
              fontSize: rowH * 0.34,
              color: UI.textDim,
              textAlign: "right",
              fontVariantNumeric: "tabular-nums",
              flex: "0 0 auto",
            }}
          >
            {(hash(r, seed + 11) * 2 - 1).toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
};

export const Timeline: React.FC<{
  width: number;
  height: number;
  grade: Grade;
  frame: number;
  /** 0..1 position of the playhead. */
  playhead: number;
  lanes?: number;
}> = ({ width, height, grade, frame, playhead, lanes = 3 }) => {
  const laneH = height / lanes;
  return (
    <div
      style={{
        width,
        height,
        position: "relative",
        background: UI.panelLo,
        borderTop: `1px solid ${UI.edgeLine}`,
        borderBottom: `1px solid ${UI.edgeLine}`,
        overflow: "hidden",
      }}
    >
      {Array.from({ length: lanes }, (_, l) => {
        let x = -hash(l, 71) * 120;
        const blocks: React.ReactNode[] = [];
        let i = 0;
        while (x < width && i < 40) {
          const w = 70 + hash(i, l * 13 + 5) * 210;
          const gap = 3 + hash(i, l * 13 + 7) * 5;
          blocks.push(
            <div
              key={i}
              style={{
                position: "absolute",
                left: x,
                top: laneH * 0.14,
                width: w,
                height: laneH * 0.72,
                borderRadius: laneH * 0.08,
                overflow: "hidden",
                background: gradedSwatch(grade, frame + i * 37, l === 0 ? 1 : 0.4),
                border: "1px solid rgba(140,180,210,0.25)",
                filter: `brightness(${l === 0 ? 0.4 : 0.26}) saturate(0.4) hue-rotate(-8deg)`,
                opacity: 0.92,
              }}
            />,
          );
          x += w + gap;
          i++;
        }
        return (
          <div
            key={l}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: l * laneH,
              height: laneH,
              borderBottom: "1px solid rgba(120,160,190,0.12)",
            }}
          >
            {blocks}
          </div>
        );
      })}
      {/* Playhead */}
      <div
        style={{
          position: "absolute",
          left: playhead * width,
          top: 0,
          bottom: 0,
          width: 2,
          background: UI.orange,
          boxShadow: `0 0 ${height * 0.06}px rgba(232,99,44,0.9)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: playhead * width,
          top: -height * 0.02,
          width: height * 0.12,
          height: height * 0.12,
          marginLeft: -height * 0.06,
          borderRadius: "50%",
          background: UI.orange,
          boxShadow: `0 0 ${height * 0.1}px rgba(232,99,44,0.85)`,
        }}
      />
    </div>
  );
};

export const Filmstrip: React.FC<{
  width: number;
  height: number;
  grade: Grade;
  frame: number;
  count: number;
  selected?: number;
}> = ({ width, height, grade, frame, count, selected = -1 }) => {
  const gap = height * 0.06;
  const thumbW = (width - gap * (count - 1)) / count;
  return (
    <div style={{ width, height, display: "flex", gap }}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          style={{
            width: thumbW,
            height,
            borderRadius: height * 0.05,
            overflow: "hidden",
            background: gradedSwatch(grade, frame + i * 91, i === selected ? 1 : 0.2),
            filter: `brightness(${i === selected ? 0.72 : 0.38}) saturate(0.45) hue-rotate(-8deg)`,
            border: `${i === selected ? 2 : 1}px solid ${
              i === selected ? UI.selection : "rgba(140,180,210,0.22)"
            }`,
            flex: "0 0 auto",
          }}
        />
      ))}
    </div>
  );
};

export const MenuBar: React.FC<{
  width: number;
  height: number;
  items: string[];
}> = ({ width, height, items }) => (
  <div
    style={{
      width,
      height,
      display: "flex",
      alignItems: "center",
      gap: height * 0.9,
      padding: `0 ${height * 0.8}px`,
      background: "linear-gradient(#141d27, #0c131a)",
      borderBottom: `1px solid ${UI.edgeLine}`,
      fontSize: height * 0.44,
      color: UI.textDim,
      letterSpacing: height * 0.02,
    }}
  >
    {items.map((it) => (
      <span key={it}>{it}</span>
    ))}
  </div>
);
