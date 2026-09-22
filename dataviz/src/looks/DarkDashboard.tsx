import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { LOOP_FRAMES } from "../lib/loop";
import { SoftFilter } from "../lib/glow";
import { Grain } from "../lib/grain";
import { DESIGN_W, DESIGN_H } from "../lib/layout";
import { windowStart } from "../lib/series";
import { MONO_FONT, UI_FONT } from "../lib/fonts";
import { arcPath, smoothPath } from "../lib/geom";
import {
  BIN_ROWS,
  CODE_ROWS,
  N3,
  S_AREA_A,
  S_AREA_B,
  S_BAR_A,
  S_BAR_B,
  S_DONUT,
  S_GAUGE,
  S_LINE,
  S_METER,
} from "./dashboardData";

export type DashTheme = {
  bg: string;
  panel: string;
  border: string;
  bright: string;
  mid: string;
  dim: string;
  faint: string;
  text: string;
  textDim: string;
  glowHex: string;
  donut: string[];
};

export const TEAL_THEME: DashTheme = {
  bg: "#04090a",
  panel: "#070f0f",
  border: "#18352f",
  bright: "#37e5b5",
  mid: "#17a487",
  dim: "#0d5f52",
  faint: "#0a332d",
  text: "#c2ece0",
  textDim: "#5e8f85",
  glowHex: "#37e5b5",
  donut: ["#5cf0c6", "#2bbf98", "#17886f", "#0f6152", "#0a3b33"],
};

export const BLUE_THEME: DashTheme = {
  bg: "#05080e",
  panel: "#080e17",
  border: "#17283e",
  bright: "#52b8ff",
  mid: "#2277cb",
  dim: "#13456f",
  faint: "#0d2740",
  text: "#c7def6",
  textDim: "#6a89a8",
  glowHex: "#52b8ff",
  donut: ["#7fcdff", "#3f9ae0", "#2570b4", "#184b7c", "#102f4e"],
};

/* --------------------------------------------------------------- layout */

const MONTHS3 = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const M = 44;
const G = 22;
const TOP_Y = M;
const TOP_H = 1215;
const BOT_Y = TOP_Y + TOP_H + G;
const BOT_H = DESIGN_H - BOT_Y - M;

const COL_L_X = M;
const COL_L_W = 660;
const COL_C_X = COL_L_X + COL_L_W + G;
const COL_C_W = 1850;
const COL_R_X = COL_C_X + COL_C_W + G;
const COL_R_W = DESIGN_W - M - COL_R_X;

const METER_H = 350;
const AREA_Y = BOT_Y + METER_H + G;
const AREA_H = BOT_H - METER_H - G;

/** Border weight: 2 design px is 2px at 4K and 1px at 1080p, as intended. */
const BW = 2;

const Panel: React.FC<{
  t: DashTheme;
  x: number;
  y: number;
  w: number;
  h: number;
}> = ({ t, x, y, w, h }) => (
  <rect
    x={x + BW / 2}
    y={y + BW / 2}
    width={w - BW}
    height={h - BW}
    fill={t.panel}
    stroke={t.border}
    strokeWidth={BW}
  />
);

const Legend: React.FC<{
  t: DashTheme;
  x: number;
  y: number;
  items: { c: string; label: string }[];
  size?: number;
  gap?: number;
}> = ({ t, x, y, items, size = 22, gap = 34 }) => (
  <g fontFamily={UI_FONT} fontSize={size} fill={t.textDim}>
    {items.map((it, i) => (
      <g key={i} transform={`translate(0 ${i * gap})`}>
        <rect x={x} y={y - size * 0.72} width={size * 0.8} height={size * 0.8} fill={it.c} />
        <text x={x + size * 1.5} y={y}>
          {it.label}
        </text>
      </g>
    ))}
  </g>
);

/* --------------------------------------------------------------- widgets */

const Gauge: React.FC<{
  t: DashTheme;
  cx: number;
  cy: number;
  r: number;
  value: number;
}> = ({ t, cx, cy, r, value }) => {
  const track = r * 0.78;
  const sw = r * 0.2;
  const a0 = -Math.PI / 2;
  const a1 = a0 + Math.PI * 2 * (value / 100);
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={t.faint} strokeWidth={BW * 1.5} />
      <circle cx={cx} cy={cy} r={r * 0.9} fill="none" stroke={t.faint} strokeWidth={BW} />
      <circle cx={cx} cy={cy} r={track} fill="none" stroke={t.faint} strokeWidth={sw} />
      <path
        d={arcPath(cx, cy, track + sw / 2, track - sw / 2, a0, a1)}
        fill={t.bright}
        filter="url(#dashSoft)"
      />
      <text
        x={cx}
        y={cy + r * 0.08}
        textAnchor="middle"
        fontFamily={MONO_FONT}
        fontWeight={700}
        fontSize={r * 0.56}
        fill={t.text}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {Math.round(value)}
      </text>
      <text
        x={cx}
        y={cy + r * 0.38}
        textAnchor="middle"
        fontFamily={UI_FONT}
        fontSize={r * 0.13}
        letterSpacing={r * 0.035}
        fill={t.textDim}
      >
        PERCENT
      </text>
    </g>
  );
};

/* ------------------------------------------------------------- component */

export const DarkDashboard: React.FC<{ theme: DashTheme }> = ({ theme: t }) => {
  const frame = useCurrentFrame();
  const ws = windowStart(frame, LOOP_FRAMES, N3);
  const cycle = frame / LOOP_FRAMES;

  /* ---- centre bar + line chart ---- */
  const BARS = 13;
  const plotX = COL_C_X + 120;
  const plotY = TOP_Y + 180;
  const plotW = COL_C_W - 200;
  const plotH = TOP_H - 330;
  const slot = plotW / BARS;
  const barW = slot * 0.3;

  /* ---- donut ---- */
  const dCx = COL_R_X + COL_R_W / 2;
  const dCy = TOP_Y + TOP_H * 0.46;
  const dRo = Math.min(COL_R_W, TOP_H) * 0.33;
  const dRi = dRo * 0.58;
  const donutRaw = S_DONUT.map((s, i) => 0.6 + s.norm(ws + i * 7) * 0.9);
  const donutSum = donutRaw.reduce((a, b) => a + b, 0) + 1.1;
  const donutVals = [...donutRaw, 1.1].map((v) => v / donutSum);
  const donutCols = t.donut;

  /* ---- meters ---- */
  const meterX = COL_C_X + 150;
  const meterW = COL_C_W - 560;

  /* ---- area chart ---- */
  const aX = COL_C_X + 120;
  const aY = AREA_Y + 110;
  const aW = COL_C_W - 200;
  const aH = AREA_H - 200;
  const areaPts = (s: typeof S_AREA_A, scale: number) =>
    Array.from({ length: 41 }, (_, i) => ({
      x: aX + (aW * i) / 40,
      y: aY + aH - s.norm(ws + i * 0.75) * aH * scale,
    }));

  /* ---- scrolls: integer lines per cycle, so they close ---- */
  const binScroll = Math.floor(cycle * BIN_ROWS.length);
  const codeScroll = Math.floor(cycle * CODE_ROWS.length);

  return (
    <AbsoluteFill style={{ backgroundColor: t.bg }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(120% 100% at 50% 40%, ${t.bg} 0%, #02050699 60%, #000000 100%)`,
        }}
      />
      <svg
        viewBox={`0 0 ${DESIGN_W} ${DESIGN_H}`}
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <SoftFilter id="dashSoft" r={5} slope={0.55} />
          <SoftFilter id="dashSoftSm" r={3} slope={0.5} />
          <linearGradient id="areaFillA" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={t.bright} stopOpacity="0.55" />
            <stop offset="1" stopColor={t.bright} stopOpacity="0.04" />
          </linearGradient>
          <linearGradient id="areaFillB" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={t.mid} stopOpacity="0.4" />
            <stop offset="1" stopColor={t.mid} stopOpacity="0.02" />
          </linearGradient>
          <clipPath id="binClip">
            <rect x={COL_L_X} y={BOT_Y} width={COL_L_W} height={BOT_H} />
          </clipPath>
          <clipPath id="codeClip">
            <rect x={COL_R_X} y={BOT_Y} width={COL_R_W} height={BOT_H} />
          </clipPath>
        </defs>

        {/* ============================ panels ============================ */}
        <Panel t={t} x={COL_L_X} y={TOP_Y} w={COL_L_W} h={TOP_H} />
        <Panel t={t} x={COL_C_X} y={TOP_Y} w={COL_C_W} h={TOP_H} />
        <Panel t={t} x={COL_R_X} y={TOP_Y} w={COL_R_W} h={TOP_H} />
        <Panel t={t} x={COL_L_X} y={BOT_Y} w={COL_L_W} h={BOT_H} />
        <Panel t={t} x={COL_C_X} y={BOT_Y} w={COL_C_W} h={METER_H} />
        <Panel t={t} x={COL_C_X} y={AREA_Y} w={COL_C_W} h={AREA_H} />
        <Panel t={t} x={COL_R_X} y={BOT_Y} w={COL_R_W} h={BOT_H} />

        {/* ========================= gauge rings ========================= */}
        {S_GAUGE.map((s, i) => {
          const cy = TOP_Y + TOP_H * ((i * 2 + 1) / 6);
          const v = 12 + s.norm(ws + i * 11) * 86;
          return (
            <g key={i}>
              <Gauge t={t} cx={COL_L_X + 215} cy={cy} r={148} value={v} />
              <Legend
                t={t}
                x={COL_L_X + 400}
                y={cy + 4}
                size={20}
                gap={32}
                items={[
                  { c: t.bright, label: "Example 1" },
                  { c: t.dim, label: "Example 2" },
                ]}
              />
            </g>
          );
        })}

        {/* ==================== centre bar + line chart ==================== */}
        <Legend
          t={t}
          x={COL_C_X + 60}
          y={TOP_Y + 74}
          size={24}
          gap={40}
          items={[
            { c: t.bright, label: "Example 1" },
            { c: t.mid, label: "Example 2" },
          ]}
        />
        <g>
          <line x1={plotX} y1={plotY + plotH} x2={plotX + plotW} y2={plotY + plotH} stroke={t.dim} strokeWidth={BW * 1.5} />
          <line x1={plotX} y1={plotY} x2={plotX} y2={plotY + plotH} stroke={t.faint} strokeWidth={BW} />
          {Array.from({ length: BARS }, (_, i) => {
            const va = S_BAR_A.norm(ws + i);
            const vb = S_BAR_B.norm(ws + i);
            const ramp = (i / (BARS - 1)) * 0.45;
            const ha = (0.1 + (va * 0.55 + ramp) * 0.82) * plotH;
            const hb = (0.13 + (vb * 0.55 + ramp) * 0.82) * plotH;
            const cx = plotX + slot * (i + 0.5);
            return (
              <g key={i}>
                <rect x={cx - barW} y={plotY + plotH - ha} width={barW} height={ha} fill={t.mid} opacity={0.78} />
                <rect x={cx} y={plotY + plotH - hb} width={barW} height={hb} fill={t.bright} opacity={0.92} />
                <text
                  x={cx}
                  y={plotY + plotH - Math.max(ha, hb) - 20}
                  textAnchor="middle"
                  fontFamily={MONO_FONT}
                  fontSize={22}
                  fill={t.textDim}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {(20 + (vb * 0.55 + ramp) * 105).toFixed(2)}
                </text>
              </g>
            );
          })}
          {/* Trend line with an arrowhead, plus a dashed companion. */}
          {(() => {
            const pts = Array.from({ length: BARS }, (_, i) => ({
              x: plotX + slot * (i + 0.5),
              y: plotY + plotH - (0.3 + (S_LINE.norm(ws + i) * 0.36 + (i / (BARS - 1)) * 0.5) * 0.78) * plotH,
            }));
            const last = pts[pts.length - 1];
            const prev = pts[pts.length - 2];
            const ang = (Math.atan2(last.y - prev.y, last.x - prev.x) * 180) / Math.PI;
            const dash = Array.from({ length: BARS }, (_, i) => ({
              x: plotX + slot * (i + 0.5),
              y: plotY + plotH - (0.12 + (S_BAR_A.norm(ws + i + 4) * 0.35 + (i / (BARS - 1)) * 0.42) * 0.8) * plotH,
            }));
            return (
              <g>
                <path d={smoothPath(dash, 0.3)} fill="none" stroke={t.textDim} strokeOpacity={0.5} strokeWidth={BW * 1.5} strokeDasharray="14 14" />
                <path d={smoothPath(pts, 0.3)} fill="none" stroke={t.bright} strokeWidth={5} filter="url(#dashSoftSm)" />
                <g transform={`translate(${last.x} ${last.y}) rotate(${ang})`}>
                  <path d="M34,0 L-14,-19 L-4,0 L-14,19 Z" fill={t.bright} />
                </g>
              </g>
            );
          })()}
          <g fontFamily={UI_FONT} fontSize={20} fill={t.textDim} textAnchor="middle">
            {Array.from({ length: BARS }, (_, i) => (
              <text key={i} x={plotX + slot * (i + 0.5)} y={plotY + plotH + 40}>
                {MONTHS3[(((Math.floor(ws) + i) % 12) + 12) % 12]}
              </text>
            ))}
          </g>
        </g>

        {/* ============================ donut ============================ */}
        <g>
          {(() => {
            let acc = -Math.PI / 2;
            return donutVals.map((v, i) => {
              const a0 = acc;
              const a1 = acc + v * Math.PI * 2;
              acc = a1;
              const mid = (a0 + a1) / 2;
              const lx = dCx + Math.cos(mid) * (dRo + 78);
              const ly = dCy + Math.sin(mid) * (dRo + 78);
              return (
                <g key={i}>
                  <path d={arcPath(dCx, dCy, dRo, dRi, a0, a1 - 0.012)} fill={donutCols[i]} />
                  <text
                    x={lx}
                    y={ly}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontFamily={MONO_FONT}
                    fontSize={30}
                    fill={t.textDim}
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {Math.round(1200 + v * 5200)}
                  </text>
                </g>
              );
            });
          })()}
          {/* Legend inside the hole, as in the reference. */}
          <g>
            {donutVals.map((v, i) => (
              <g key={i} transform={`translate(${dCx - dRi * 0.6} ${dCy - dRi * 0.58 + i * dRi * 0.3})`}>
                <rect x={0} y={-22} width={28} height={28} fill={donutCols[i]} />
                <text
                  x={46}
                  y={0}
                  fontFamily={UI_FONT}
                  fontSize={28}
                  fill={t.text}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {i === 4 ? "Others" : `${Math.round(v * 100)}%`}
                </text>
              </g>
            ))}
          </g>
          <Legend
            t={t}
            x={COL_R_X + COL_R_W - 300}
            y={TOP_Y + TOP_H - 90}
            size={22}
            gap={38}
            items={[
              { c: t.bright, label: "Example 1" },
              { c: t.mid, label: "Example 2" },
            ]}
          />
        </g>

        {/* ======================== horizontal meters ======================== */}
        <g>
          {S_METER.map((s, i) => {
            const y = BOT_Y + 74 + i * 66;
            const v = 0.34 + s.norm(ws + i * 5) * 0.6;
            return (
              <g key={i}>
                <text
                  x={meterX - 20}
                  y={y + 22}
                  textAnchor="end"
                  fontFamily={MONO_FONT}
                  fontSize={22}
                  fill={t.textDim}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {`${Math.round(v * 100)}%`}
                </text>
                <rect x={meterX} y={y} width={meterW} height={30} fill={t.faint} />
                <rect x={meterX} y={y} width={meterW * v} height={30} fill={i % 2 ? t.mid : t.bright} />
                <text
                  x={meterX + meterW + 30}
                  y={y + 23}
                  fontFamily={MONO_FONT}
                  fontSize={22}
                  fill={t.textDim}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  100
                </text>
              </g>
            );
          })}
          <Legend
            t={t}
            x={COL_C_X + COL_C_W - 280}
            y={BOT_Y + 130}
            size={22}
            gap={44}
            items={[
              { c: t.bright, label: "Example 1" },
              { c: t.mid, label: "Example 2" },
            ]}
          />
        </g>

        {/* =========================== area chart =========================== */}
        <g>
          <Legend
            t={t}
            x={COL_C_X + 60}
            y={AREA_Y + 56}
            size={22}
            gap={36}
            items={[
              { c: t.bright, label: "Example 1" },
              { c: t.mid, label: "Example 2" },
            ]}
          />
          {(() => {
            const pa = areaPts(S_AREA_A, 0.92);
            const pb = areaPts(S_AREA_B, 0.6);
            const close = (p: { x: number; y: number }[]) =>
              `${smoothPath(p, 0.35)} L${aX + aW},${aY + aH} L${aX},${aY + aH} Z`;
            return (
              <g>
                <path d={close(pa)} fill="url(#areaFillA)" />
                <path d={smoothPath(pa, 0.35)} fill="none" stroke={t.bright} strokeWidth={4} />
                <path d={close(pb)} fill="url(#areaFillB)" />
                <path d={smoothPath(pb, 0.35)} fill="none" stroke={t.mid} strokeWidth={3} />
                {pa.filter((_, i) => i % 8 === 0).map((p, i) => (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y} r={6} fill={t.bright} />
                    <text
                      x={p.x}
                      y={p.y - 20}
                      textAnchor="middle"
                      fontFamily={MONO_FONT}
                      fontSize={20}
                      fill={t.textDim}
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {Math.round(((aY + aH - p.y) / aH) * 480)}
                    </text>
                  </g>
                ))}
              </g>
            );
          })()}
          <line x1={aX} y1={aY + aH} x2={aX + aW} y2={aY + aH} stroke={t.dim} strokeWidth={BW * 1.5} />
        </g>

        {/* ===================== monospace binary block ===================== */}
        <g clipPath="url(#binClip)" fontFamily={MONO_FONT} fontSize={19} fill={t.mid}>
          {[0, 1].map((col) =>
            Array.from({ length: 30 }, (_, r) => {
              const idx = (r + binScroll + col * 7) % BIN_ROWS.length;
              return (
                <text
                  key={`${col}-${r}`}
                  x={COL_L_X + 46 + col * 316}
                  y={BOT_Y + 56 + r * 28}
                  opacity={0.45 + ((idx * 37) % 10) / 18}
                >
                  {BIN_ROWS[idx]}
                </text>
              );
            }),
          )}
        </g>

        {/* ======================== code / log panel ======================== */}
        <g clipPath="url(#codeClip)" fontFamily={MONO_FONT} fontSize={21}>
          <text x={COL_R_X + 46} y={BOT_Y + 56} fill={t.textDim} fontSize={19}>
            {"// log output"}
          </text>
          {Array.from({ length: 24 }, (_, r) => {
            const row = CODE_ROWS[(r + codeScroll) % CODE_ROWS.length];
            return (
              <g key={r}>
                <text x={COL_R_X + 46} y={BOT_Y + 116 + r * 32} fill={t.dim}>
                  {/* Modulo the row count, not 100 — otherwise the line
                      numbers do not return to their frame-0 values and the
                      loop does not close. */}
                  {String(((r + codeScroll) % CODE_ROWS.length) + 1).padStart(2, "0")}
                </text>
                <text x={COL_R_X + 110} y={BOT_Y + 116 + r * 32} fill={t.text} opacity={0.8}>
                  {row.head}
                </text>
                <text
                  x={COL_R_X + COL_R_W - 46}
                  y={BOT_Y + 116 + r * 32}
                  textAnchor="end"
                  fill={row.ok ? t.bright : t.textDim}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {row.val}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      <Grain opacity={0.018} />
    </AbsoluteFill>
  );
};
