import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { LOOP_FRAMES } from "../lib/loop";
import { Grain } from "../lib/grain";
import { useScale } from "../lib/layout";
import { seededSeries } from "../lib/series";
import { MONO_FONT, UI_FONT } from "../lib/fonts";
import { arcPath, onClosedSpline, type Pt } from "../lib/geom";
import { mulberry32, range } from "../lib/random";

/* ----------------------------------------------------------------- theme */

export type LightTheme = {
  field: string;
  fieldGrad: string;
  panel: string;
  panelAlt: string;
  border: string;
  text: string;
  textDim: string;
  cat: [string, string, string, string];
  bar: string;
  barAlt: string;
  tint: string;
};

export const WARM_THEME: LightTheme = {
  field: "#eaf0f4",
  fieldGrad:
    "radial-gradient(120% 100% at 42% 24%, #fdfefe 0%, #f1f5f8 44%, #e4ebf1 74%, #d9e3ea 100%)",
  panel: "#ffffff",
  panelAlt: "#f7fafb",
  border: "#dde6ec",
  text: "#1e2c37",
  textDim: "#7b8b98",
  cat: ["#52c3af", "#e8c069", "#3d5f78", "#e08b7d"],
  bar: "#2b4a63",
  barAlt: "#9fb2c1",
  tint: "rgba(120,170,195,0.13)",
};

export const SLATE_THEME: LightTheme = {
  field: "#e7ecf2",
  fieldGrad:
    "radial-gradient(120% 100% at 42% 24%, #fbfcfe 0%, #eef2f7 44%, #e1e8f0 74%, #d5dee8 100%)",
  panel: "#fbfcfe",
  panelAlt: "#f3f6fa",
  border: "#dae2ec",
  text: "#1b2633",
  textDim: "#75838f",
  cat: ["#5f93da", "#a8c6ec", "#365474", "#7d8fa6"],
  bar: "#1f3a5f",
  barAlt: "#a8b8c9",
  tint: "rgba(120,150,195,0.12)",
};

/* ---------------------------------------------------------------- layout */

const DW = 4700;
const DH = 2960;
const BW = 2.6;

/** Static dashboard data — stat cards and a Gantt row do not stream. */
const CATS = ["Category A", "Category B", "Category C", "Category D"];
const WEEKS = ["Week 18", "Week 19", "Week 20", "Week 21", "Week 22", "Week 23", "Week 24"];

const DONUT_VALS = [0.452, 0.226, 0.226, 0.096];

const GANTT = (() => {
  const rnd = mulberry32(90210);
  return Array.from({ length: 8 }, (_, i) => {
    const start = range(rnd, 0, 0.5);
    return {
      label: `Item ${i + 1}`,
      start,
      len: range(rnd, 0.16, 0.42),
      cat: Math.floor(rnd() * 4),
    };
  });
})();

const COLS = (() => {
  const rnd = mulberry32(5150);
  return Array.from({ length: 9 }, () => range(rnd, 0.22, 1));
})();

/** One or two figures count and return to their frame-0 value. */
const S_STAT_A = seededSeries(13001, 100, [1], [1]);
const S_STAT_B = seededSeries(13002, 100, [1, 2], [1, 0.4]);

/* --------------------------------------------- cursor path (closed loop) */

const CURSOR_PTS: Pt[] = [
  { x: 1500, y: 1900 },
  { x: 2600, y: 1500 },
  { x: 3560, y: 760 }, // dwells over the donut
  { x: 4050, y: 1180 },
  { x: 3200, y: 1980 },
  { x: 2050, y: 2010 }, // dwells over a timeline bar
  { x: 1150, y: 1500 },
];
/** Index of the waypoint the tooltip is anchored to, as a spline parameter. */
const DONUT_U = 2 / CURSOR_PTS.length;
const GANTT_U = 5 / CURSOR_PTS.length;

/**
 * Closed, integer-cycle reparametrisation. u(1) = u(0) + 1, so the cursor
 * returns exactly to its start; the sine terms make it linger at the
 * waypoints instead of gliding at constant speed.
 */
const easedU = (t: number) =>
  t - 0.1 * Math.sin(Math.PI * 2 * CURSOR_PTS.length * t) / (Math.PI * 2);

/** Smooth 0..1 bump around a spline position, wrapping. */
const nearU = (u: number, target: number, width: number) => {
  let d = Math.abs(((u - target + 0.5) % 1 + 1) % 1 - 0.5);
  d = d / width;
  return d >= 1 ? 0 : Math.pow(Math.cos((d * Math.PI) / 2), 2);
};

/* ------------------------------------------------------ depth-of-field bands */

const BANDS = [
  { d0: -3000, d1: 700, blur: 17 },
  { d0: 700, d1: 1250, blur: 7.5 },
  { d0: 1250, d1: 2150, blur: 0 },
  { d0: 2150, d1: 6000, blur: 9 },
];
/** Bands run diagonally, matching the axis the tilted plane recedes along. */
const BAND_ANGLE = -13;
/**
 * Bands overlap by this much and cross-fade through a gradient mask. A hard
 * clip would blur its own cut edge and leave a visible seam across the frame;
 * two linear ramps that sum to 1 leave none.
 */
const FEATHER = 420;
const BAND_N = {
  x: -Math.sin((BAND_ANGLE * Math.PI) / 180),
  y: Math.cos((BAND_ANGLE * Math.PI) / 180),
};

/* ------------------------------------------------------------- components */

const Card: React.FC<{ t: LightTheme; x: number; y: number; w: number; h: number; alt?: boolean }> = ({
  t,
  x,
  y,
  w,
  h,
  alt,
}) => (
  <rect
    x={x}
    y={y}
    width={w}
    height={h}
    rx={14}
    fill={alt ? t.panelAlt : t.panel}
    stroke={t.border}
    strokeWidth={BW}
  />
);

const DashboardBody: React.FC<{ t: LightTheme; frame: number; dur: number }> = ({ t, frame, dur }) => {
  const cycle = frame / dur;
  const statA = Math.round(19 + S_STAT_A.norm(cycle * 100) * 15);
  const statB = Math.round(6 + S_STAT_B.norm(cycle * 100) * 9);

  return (
    <g>
      {/* ---------------------------- stat cards ---------------------------- */}
      {[
        { v: statA, cap: "Metric A" },
        { v: statB, cap: "Metric B" },
        { v: 9, cap: "Metric C" },
      ].map((s, i) => {
        const x = 150 + i * 840;
        return (
          <g key={i}>
            <Card t={t} x={x} y={150} w={780} h={620} />
            <text
              x={x + 70}
              y={150 + 400}
              fontFamily={UI_FONT}
              fontWeight={300}
              fontSize={300}
              fill={t.text}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {s.v}
            </text>
            <text x={x + 70} y={150 + 530} fontFamily={UI_FONT} fontWeight={400} fontSize={66} fill={t.textDim}>
              {s.cap}
            </text>
          </g>
        );
      })}

      {/* ------------------------------ donut ------------------------------ */}
      <Card t={t} x={2560} y={140} w={1700} h={1140} />
      {(() => {
        const cx = 3120;
        const cy = 690;
        const ro = 430;
        const ri = 268;
        let acc = -Math.PI / 2;
        return (
          <g>
            {DONUT_VALS.map((v, i) => {
              const a0 = acc;
              const a1 = acc + v * Math.PI * 2;
              acc = a1;
              const mid = (a0 + a1) / 2;
              const lx = cx + Math.cos(mid) * (ro + 130);
              const ly = cy + Math.sin(mid) * (ro + 130);
              return (
                <g key={i}>
                  <path d={arcPath(cx, cy, ro, ri, a0, a1 - 0.014)} fill={t.cat[i]} />
                  <line
                    x1={cx + Math.cos(mid) * (ro + 14)}
                    y1={cy + Math.sin(mid) * (ro + 14)}
                    x2={cx + Math.cos(mid) * (ro + 104)}
                    y2={cy + Math.sin(mid) * (ro + 104)}
                    stroke={t.textDim}
                    strokeWidth={BW}
                    strokeOpacity={0.6}
                  />
                  <text
                    x={lx}
                    y={ly}
                    textAnchor={Math.cos(mid) < 0 ? "end" : "start"}
                    dominantBaseline="middle"
                    fontFamily={UI_FONT}
                    fontSize={50}
                    fill={t.textDim}
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {`${CATS[i]} ${(v * 100).toFixed(1)}%`}
                  </text>
                </g>
              );
            })}
            {CATS.map((c, i) => (
              <g key={c} transform={`translate(3760 ${430 + i * 128})`}>
                <circle cx={0} cy={-16} r={24} fill={t.cat[i]} />
                <text x={62} y={0} fontFamily={UI_FONT} fontSize={58} fill={t.text}>
                  {c}
                </text>
              </g>
            ))}
          </g>
        );
      })()}

      {/* --------------------------- column chart --------------------------- */}
      <Card t={t} x={150} y={830} w={780} h={1320} />
      <text x={220} y={1030} fontFamily={UI_FONT} fontWeight={400} fontSize={50} fill={t.textDim}>
        Series 1 by group
      </text>
      <text x={220} y={950} fontFamily={UI_FONT} fontWeight={500} fontSize={62} fill={t.text}>
        Series 1
      </text>
      {COLS.map((v, i) => {
        const bw = 58;
        const x = 230 + i * 72;
        const h = v * 900;
        return <rect key={i} x={x} y={2050 - h} width={bw} height={h} fill={i % 3 === 0 ? t.bar : t.barAlt} rx={4} />;
      })}
      <line x1={220} y1={2052} x2={870} y2={2052} stroke={t.border} strokeWidth={BW * 1.4} />

      {/* ----------------------------- timeline ----------------------------- */}
      <Card t={t} x={1010} y={1300} w={3540} h={1500} />
      <text x={1110} y={1440} fontFamily={UI_FONT} fontWeight={600} fontSize={80} fill={t.text}>
        Timeline
      </text>
      {WEEKS.map((w, i) => (
        <g key={w}>
          <text
            x={1300 + i * 470}
            y={1620}
            fontFamily={UI_FONT}
            fontSize={54}
            fill={t.textDim}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {w}
          </text>
          <line x1={1290 + i * 470} y1={1660} x2={1290 + i * 470} y2={2740} stroke={t.border} strokeWidth={BW} strokeOpacity={0.45} />
        </g>
      ))}
      {GANTT.map((g, i) => {
        const x0 = 1290 + g.start * 2900;
        const w = g.len * 2900;
        const y = 1710 + i * 138;
        return (
          <g key={i}>
            <rect x={x0} y={y} width={w} height={78} rx={39} fill={t.cat[2]} />
            <text
              x={x0 + w / 2}
              y={y + 52}
              textAnchor="middle"
              fontFamily={MONO_FONT}
              fontSize={36}
              fill="#ffffff"
              opacity={0.92}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {g.label}
            </text>
          </g>
        );
      })}

      {/* ------ second stat strip, cropped by the frame as the reference is ------ */}
      {[0, 1, 2].map((i) => (
        <g key={`s2${i}`}>
          <Card t={t} x={150 + i * 840} y={2240} w={780} h={560} alt={i > 0} />
          <text
            x={220 + i * 840}
            y={2450}
            fontFamily={UI_FONT}
            fontWeight={300}
            fontSize={150}
            fill={t.text}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {[62, 38, 17][i]}
          </text>
          <text x={220 + i * 840} y={2560} fontFamily={UI_FONT} fontSize={52} fill={t.textDim}>
            {["Series 1", "Series 2", "Series 3"][i]}
          </text>
        </g>
      ))}
      <Card t={t} x={2560} y={2860} w={1700} h={600} alt />
    </g>
  );
};

/* -------------------------------------------------------------- composition */

export const LightDashboard: React.FC<{ theme: LightTheme }> = ({ theme: t }) => {
  const frame = useCurrentFrame();
  const k = useScale();
  const cycle = frame / LOOP_FRAMES;

  const u = easedU(cycle);
  const cursor = onClosedSpline(CURSOR_PTS, u, 0.6);
  const donutHot = nearU(u, DONUT_U, 0.1);
  const ganttHot = nearU(u, GANTT_U, 0.1);

  // The sheen crosses exactly once and is fully off-frame (and at zero
  // opacity) at both ends of the loop.
  const sheenX = interpolate(cycle, [0, 1], [-0.7, 1.7]);
  const sheenA = Math.sin(Math.PI * cycle) * 0.55;

  const Body = <DashboardBody t={t} frame={frame} dur={LOOP_FRAMES} />;

  const Tilted: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <AbsoluteFill style={{ perspective: `${6400 * k}px`, perspectiveOrigin: "52% 44%" }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: `${DW * k * 0.93}px`,
          height: `${DH * k * 0.93}px`,
          marginLeft: `${-DW * k * 0.465}px`,
          marginTop: `${-DH * k * 0.465}px`,
          transform: "rotateX(5deg) rotateY(7deg) rotateZ(2.6deg)",
          transformStyle: "preserve-3d",
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );

  return (
    <AbsoluteFill style={{ backgroundColor: t.field }}>
      <AbsoluteFill style={{ background: t.fieldGrad }} />

      {/* Dashboard drawn once per depth band, each band blurred in screen
          space after projection so the bands stay in register. */}
      {BANDS.map((b, i) => (
        <AbsoluteFill key={i} style={{ filter: b.blur ? `blur(${b.blur * k}px)` : undefined }}>
          <Tilted>
            <svg viewBox={`0 0 ${DW} ${DH}`} width="100%" height="100%">
              <defs>
                {(() => {
                  const first = i === 0;
                  const last = i === BANDS.length - 1;
                  const lo = b.d0 - FEATHER / 2;
                  const hi = b.d1 + FEATHER / 2;
                  const span = hi - lo;
                  const f = FEATHER / span;
                  const cy = DH / 2;
                  const ax = DW / 2 + BAND_N.x * (lo - cy);
                  const ay = cy + BAND_N.y * (lo - cy);
                  const bx = DW / 2 + BAND_N.x * (hi - cy);
                  const by = cy + BAND_N.y * (hi - cy);
                  return (
                    <>
                      <linearGradient
                        id={`bandg${i}`}
                        gradientUnits="userSpaceOnUse"
                        x1={ax}
                        y1={ay}
                        x2={bx}
                        y2={by}
                      >
                        <stop offset="0" stopColor="#fff" stopOpacity={first ? 1 : 0} />
                        <stop offset={f} stopColor="#fff" stopOpacity="1" />
                        <stop offset={1 - f} stopColor="#fff" stopOpacity="1" />
                        <stop offset="1" stopColor="#fff" stopOpacity={last ? 1 : 0} />
                      </linearGradient>
                      <mask id={`band${i}`} maskUnits="userSpaceOnUse" x={-DW} y={-DH} width={DW * 3} height={DH * 3}>
                        <rect
                          x={-DW}
                          y={lo}
                          width={DW * 3}
                          height={span}
                          transform={`rotate(${BAND_ANGLE} ${DW / 2} ${DH / 2})`}
                          fill={`url(#bandg${i})`}
                        />
                      </mask>
                    </>
                  );
                })()}
              </defs>
              <g mask={`url(#band${i})`}>{Body}</g>
            </svg>
          </Tilted>
        </AbsoluteFill>
      ))}

      {/* Cursor and tooltip ride on the same plane, always sharp — they are
          what makes this read as software in use rather than a mockup. */}
      <Tilted>
        <svg viewBox={`0 0 ${DW} ${DH}`} width="100%" height="100%">
          <defs>
            <filter id="tipShadow" x="-40%" y="-40%" width="180%" height="180%" colorInterpolationFilters="sRGB">
              <feDropShadow dx="0" dy="10" stdDeviation="16" floodColor="#1e2c37" floodOpacity="0.22" />
            </filter>
          </defs>

          {[
            { hot: donutHot, x: 3310, y: 620, label: `${CATS[1]}: ${(DONUT_VALS[1] * 100).toFixed(1)}%` },
            { hot: ganttHot, x: 2000, y: 1900, label: `${GANTT[1].label}: ${WEEKS[2]}` },
          ].map((tip, i) =>
            tip.hot <= 0.01 ? null : (
              <g key={i} opacity={tip.hot}>
                <g filter="url(#tipShadow)">
                  <rect
                    x={tip.x}
                    y={tip.y}
                    width={tip.label.length * 22 + 76}
                    height={96}
                    rx={16}
                    fill={t.panel}
                    stroke={t.border}
                    strokeWidth={BW}
                  />
                </g>
                <circle cx={tip.x + 38} cy={tip.y + 48} r={13} fill={t.cat[i === 0 ? 1 : 2]} />
                <text
                  x={tip.x + 66}
                  y={tip.y + 64}
                  fontFamily={UI_FONT}
                  fontWeight={500}
                  fontSize={40}
                  fill={t.text}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {tip.label}
                </text>
              </g>
            ),
          )}

          <g transform={`translate(${cursor.x} ${cursor.y}) scale(2.5)`}>
            <path
              d="M0,0 L0,34 L8.4,26 L14,40 L21,37 L15.2,23.4 L25,23 Z"
              fill="#ffffff"
              stroke="#1e2c37"
              strokeWidth={2.4}
              strokeLinejoin="round"
            />
          </g>
        </svg>
      </Tilted>

      {/* Sheen: one pass across the panels per loop. */}
      <AbsoluteFill style={{ overflow: "hidden", pointerEvents: "none" }}>
        <div
          style={{
            position: "absolute",
            top: "-40%",
            left: `${sheenX * 100}%`,
            width: "46%",
            height: "180%",
            background:
              "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.62) 50%, rgba(255,255,255,0) 100%)",
            transform: "rotate(14deg)",
            opacity: sheenA,
            filter: `blur(${34 * k}px)`,
          }}
        />
      </AbsoluteFill>

      {/* Cool tint and edge falloff — the reference reads as a screen filmed
          through glass, not a flat export. */}
      <AbsoluteFill style={{ background: t.tint, pointerEvents: "none" }} />
      {/* A gentle veiling glare, so it reads as a screen filmed through glass
          rather than a flat export. Kept light on purpose: the reference's
          grade crushes its luminance to a mid blue-grey, and a light-mode
          dashboard that is actually light is the thing worth selling. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(90% 88% at 44% 34%, rgba(226,240,246,0.30) 0%, rgba(206,226,236,0.16) 46%, rgba(180,205,220,0.05) 100%)",
          pointerEvents: "none",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(78% 82% at 50% 46%, rgba(255,255,255,0) 40%, rgba(150,175,195,0.20) 100%)",
          pointerEvents: "none",
        }}
      />

      <Grain opacity={0.02} />
    </AbsoluteFill>
  );
};
