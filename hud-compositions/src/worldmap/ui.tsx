import React from "react";
import { FONT_LABEL, FONT_MONO } from "../common/constants";
import { hash, rng } from "../common/math";
import { WorldPalette } from "./palette";

/** Deterministic pseudo-data string, e.g. "A7F-0293 .. 41.882". */
export const fakeRow = (seed: number, len = 26) => {
  const chars = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
  const r = rng(seed * 7919 + 13);
  let s = "";
  for (let i = 0; i < len; i++) {
    const c = r();
    s += c < 0.14 ? " " : c < 0.18 ? "." : chars[Math.floor(r() * chars.length)];
  }
  return s;
};

export const Panel: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  pal: WorldPalette;
  opacity: number;
  children?: React.ReactNode;
}> = ({ x, y, w, h, title, pal, opacity, children }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: w,
      height: h,
      opacity,
      background: pal.panel,
      border: `1px solid ${pal.panelEdge}`,
      boxShadow: "0 0 18px rgba(0,0,0,0.45)",
      overflow: "hidden",
    }}
  >
    <div
      style={{
        height: 18,
        borderBottom: `1px solid ${pal.panelEdge}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 8px",
        fontFamily: FONT_LABEL,
        fontWeight: 600,
        fontSize: 11,
        letterSpacing: 1.2,
        color: pal.text,
      }}
    >
      <span>{title}</span>
      <span style={{ letterSpacing: 2, opacity: 0.8 }}>•••</span>
    </div>
    <div style={{ position: "relative", padding: "6px 8px" }}>{children}</div>
  </div>
);

/** Rows of tiny monospace data, with a scrolling highlight. */
export const DataRows: React.FC<{
  n: number;
  seed: number;
  frame: number;
  pal: WorldPalette;
  icon?: boolean;
  len?: number;
  lineH?: number;
  highlight?: number;
  accentEvery?: number;
}> = ({ n, seed, frame, pal, icon, len = 28, lineH = 12, highlight = -1, accentEvery = 0 }) => (
  <div style={{ fontFamily: FONT_MONO, fontSize: 7.5, lineHeight: `${lineH}px`, color: pal.dim, whiteSpace: "pre" }}>
    {Array.from({ length: n }, (_, i) => {
      const flick = hash(i * 3.1 + seed + Math.floor(frame / 9)) > 0.93;
      const hl = i === highlight;
      const acc = accentEvery > 0 && i % accentEvery === accentEvery - 1;
      return (
        <div
          key={i}
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            background: hl ? "rgba(220,230,230,0.16)" : undefined,
            color: acc ? pal.accent : flick ? pal.text : undefined,
          }}
        >
          {icon ? <FolderIcon color={pal.dim} /> : null}
          <span>{fakeRow(seed + i, len)}</span>
        </div>
      );
    })}
  </div>
);

export const FolderIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg width={10} height={8} viewBox="0 0 10 8">
    <path d="M0 1h4l1 1h5v6H0z" fill={color} />
  </svg>
);

export const Label: React.FC<{
  x: number;
  y: number;
  text: string;
  pal: WorldPalette;
  size?: number;
  color?: string;
  opacity?: number;
  weight?: number;
  anchor?: "left" | "right" | "center";
  mono?: boolean;
  spacing?: number;
}> = ({ x, y, text, pal, size = 12, color, opacity = 1, weight = 500, anchor = "left", mono, spacing = 1 }) => (
  <div
    style={{
      position: "absolute",
      left: anchor === "left" ? x : undefined,
      right: anchor === "right" ? 1920 - x : undefined,
      top: y,
      transform: anchor === "center" ? "translateX(-50%)" : undefined,
      ...(anchor === "center" ? { left: x } : {}),
      fontFamily: mono ? FONT_MONO : FONT_LABEL,
      fontWeight: weight,
      fontSize: size,
      letterSpacing: spacing,
      color: color ?? pal.text,
      opacity,
      whiteSpace: "pre",
      lineHeight: 1,
    }}
  >
    {text}
  </div>
);

/** Thin underline with a moving highlight segment. */
export const ProgressLine: React.FC<{ x: number; y: number; w: number; p: number; pal: WorldPalette; opacity?: number }> = ({
  x,
  y,
  w,
  p,
  pal,
  opacity = 1,
}) => (
  <div style={{ position: "absolute", left: x, top: y, width: w, height: 2, opacity }}>
    <div style={{ position: "absolute", inset: 0, background: pal.panelEdge }} />
    <div style={{ position: "absolute", left: 0, top: -0.5, height: 3, width: w * p, background: pal.highlight }} />
  </div>
);
