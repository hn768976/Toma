import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { LOOP_FRAMES } from "../lib/loop";
import { NeonFilter } from "../lib/glow";
import { Grain, DitherPatch } from "../lib/grain";
import { useScale } from "../lib/layout";
import { seededSeries, windowStart } from "../lib/series";
import { mulberry32, range } from "../lib/random";
import { UI_FONT, NUM } from "../lib/fonts";
import { smoothPath } from "../lib/geom";

/* ---------------------------------------------------------------- data */

/** Series length. The window advances exactly N positions over the loop. */
export const N = 48;
const BAR_SERIES = seededSeries(8812001, N, [1, 2, 3, 5, 11, 17], [1, 0.52, 0.42, 0.38, 0.5, 0.34], 0);
const LINE_SERIES = seededSeries(4471902, N, [1, 2, 4, 7], [1, 0.45, 0.28, 0.22], 0);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* ------------------------------------------------------------- geometry */

const PLANE_W = 11000;
const PLANE_D = 7600;
const TILT = 74;
/**
 * CSS px per plane unit, before perspective. This is what sets the apparent
 * camera distance: 0.36 puts roughly one plane width across the frame at the
 * depth the bars stand at, leaving grid visible above and below them.
 */
const PX_PER_UNIT = 0.36;
/** Where the bars stand on the plane, 0 = far edge, 1 = near edge. */
const BAR_Z = 0.6;
const BAR_SPACING = 1950;
const BAR_W = 570;

/** Depth-of-field bands. Blur is strongest at the near and far ends. */
const STRIPS = [
  { from: 0.0, to: 0.22, blur: 26 },
  { from: 0.22, to: 0.38, blur: 11 },
  { from: 0.38, to: 0.63, blur: 0 },
  { from: 0.63, to: 0.8, blur: 10 },
  { from: 0.8, to: 1.0, blur: 24 },
];

const gridPaths = (() => {
  const v: string[] = [];
  const h: string[] = [];
  const cols = 26;
  const rows = 22;
  for (let i = 0; i <= cols; i++) {
    const x = (PLANE_W * i) / cols;
    v.push(`M${x},0 L${x},${PLANE_D}`);
  }
  for (let j = 0; j <= rows; j++) {
    const y = (PLANE_D * j) / rows;
    h.push(`M0,${y} L${PLANE_W},${y}`);
  }
  return { v, h };
})();

const BOKEH = (() => {
  const rnd = mulberry32(31337);
  return Array.from({ length: 44 }, () => ({
    x: rnd(),
    y: range(rnd, 0, 0.8),
    r: range(rnd, 26, 130),
    ax: range(rnd, 0.012, 0.05),
    ay: range(rnd, 0.008, 0.035),
    fx: Math.round(range(rnd, 1, 3)),
    fy: Math.round(range(rnd, 1, 4)),
    px: rnd(),
    py: rnd(),
    blur: range(rnd, 10, 40),
    a: range(rnd, 0.14, 0.5),
  }));
})();

/* --------------------------------------------------------------- theme */

export type BarTheme = {
  bg: string;
  bgGrad: string;
  gridDim: string;
  gridBright: string;
  barTop: string;
  barMid: string;
  barLow: string;
  edge: string;
  line: string;
  bokeh: string;
  label: string;
};

export const CYAN_THEME: BarTheme = {
  bg: "#01080a",
  bgGrad:
    "radial-gradient(90% 70% at 50% 40%, #04222c 0%, #021318 42%, #010a0d 72%, #000406 100%)",
  gridDim: "#0c5c6e",
  gridBright: "#12869f",
  barTop: "#8ce6ff",
  barMid: "#31b4ea",
  barLow: "#1272a8",
  edge: "#e2f9ff",
  line: "#57d8f5",
  bokeh: "#1f8fc4",
  label: "#7fc9e2",
};

export const AMBER_THEME: BarTheme = {
  bg: "#0a0703",
  bgGrad:
    "radial-gradient(90% 70% at 50% 40%, #2b1d06 0%, #180f03 42%, #0b0703 72%, #050301 100%)",
  gridDim: "#6b4a12",
  gridBright: "#a4761d",
  barTop: "#ffdc94",
  barMid: "#f2a832",
  barLow: "#a96a12",
  edge: "#fff4d6",
  line: "#ffc255",
  bokeh: "#c98a1f",
  label: "#e0b979",
};

/* ------------------------------------------------------------ component */

const Plane: React.FC<{ k: number; children: React.ReactNode }> = ({ k, children }) => (
  <AbsoluteFill style={{ perspective: `${2400 * k}px`, perspectiveOrigin: "50% 40%" }}>
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "72%",
        width: `${PLANE_W * PX_PER_UNIT * k}px`,
        height: `${PLANE_D * PX_PER_UNIT * k}px`,
        transform: `translate(-50%, -50%) rotateX(${TILT}deg)`,
        transformStyle: "preserve-3d",
      }}
    >
      {children}
    </div>
  </AbsoluteFill>
);

export const BarChart: React.FC<{ theme: BarTheme }> = ({ theme }) => {
  const frame = useCurrentFrame();
  const k = useScale();
  const t = frame / LOOP_FRAMES;
  const ws = windowStart(frame, LOOP_FRAMES, N);

  // Bars slide across the plane as the window advances. Rendering a fixed
  // integer span around floor(ws) means the set of bars at frame 600 is the
  // same set as at frame 0, shifted by exactly N.
  const i0 = Math.floor(ws) - 6;
  const i1 = Math.floor(ws) + 6;
  const bars: { i: number; planeX: number; h: number }[] = [];
  for (let i = i0; i <= i1; i++) {
    const planeX = PLANE_W / 2 + (i - ws) * BAR_SPACING;
    if (planeX < -BAR_SPACING || planeX > PLANE_W + BAR_SPACING) continue;
    bars.push({ i, planeX, h: 1250 + BAR_SERIES.norm(i) * 3250 });
  }

  const pulse = 1 + 0.07 * Math.sin((Math.PI * 2 * 2 * frame) / LOOP_FRAMES);

  // The overlaid trend line lives on an upright billboard just in front of
  // the bars, so it takes the same perspective as they do.
  const LINE_W = PLANE_W;
  const LINE_H = 3000;
  const linePts = Array.from({ length: 73 }, (_, j) => {
    const u = j / 72;
    const idx = ws - 6 + u * 12;
    return {
      x: u * LINE_W,
      y: LINE_H - (0.16 + LINE_SERIES.norm(idx) * 0.78) * LINE_H,
    };
  });

  // Angular companion series with sharp vertices, alongside the smooth arc.
  const zigPts = Array.from({ length: 13 }, (_, j) => {
    const u = j / 12;
    const idx = ws - 6 + u * 12;
    return {
      x: u * LINE_W,
      y: LINE_H - (0.1 + BAR_SERIES.norm(idx * 2 + 3) * 0.72) * LINE_H,
    };
  });

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg }}>
      <AbsoluteFill style={{ background: theme.bgGrad }} />

      {/* ---- bokeh field, behind everything ---- */}
      <AbsoluteFill>
        {BOKEH.map((b, i) => {
          const x = b.x + b.ax * Math.sin(Math.PI * 2 * b.fx * t + b.px * Math.PI * 2);
          const y = b.y + b.ay * Math.sin(Math.PI * 2 * b.fy * t + b.py * Math.PI * 2);
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${x * 100}%`,
                top: `${y * 100}%`,
                width: `${b.r * 2 * k}px`,
                height: `${b.r * 2 * k}px`,
                marginLeft: `${-b.r * k}px`,
                marginTop: `${-b.r * k}px`,
                borderRadius: "50%",
                background: `radial-gradient(circle, ${theme.bokeh} 0%, ${theme.bokeh}00 70%)`,
                filter: `blur(${b.blur * k}px)`,
                opacity: b.a,
              }}
            />
          );
        })}
      </AbsoluteFill>

      {/* ---- background lattice wall, dim and defocused ----
          In the reference a blurred grid covers the whole frame, including
          above and behind the bars. Without it the upper third is dead space
          and the bars stop reading as data floating inside a lattice. */}
      <AbsoluteFill style={{ filter: `blur(${9 * k}px)`, opacity: 0.5 }}>
        <svg viewBox="0 0 2400 1400" width="100%" height="100%" preserveAspectRatio="none">
          <g stroke={theme.gridBright} strokeOpacity={0.32} strokeWidth={3} fill="none">
            {Array.from({ length: 19 }, (_, i) => (
              <path key={`lv${i}`} d={`M${(2400 * i) / 18 + 16},0 L${(2400 * i) / 18 - 16},1400`} />
            ))}
            {Array.from({ length: 13 }, (_, i) => (
              <path key={`lh${i}`} d={`M0,${(1400 * i) / 12} L2400,${(1400 * i) / 12 + 20}`} />
            ))}
          </g>
        </svg>
      </AbsoluteFill>

      {/* ---- ground plane in depth-of-field bands ----
          Each band is its own perspective container wrapped in a screen-space
          blur, so the bands align exactly but the blur is applied after the
          projection rather than being squashed by it. */}
      {STRIPS.map((s, si) => (
        <AbsoluteFill key={si} style={{ filter: s.blur ? `blur(${s.blur * k}px)` : undefined }}>
          <Plane k={k}>
            <div
              style={{
                position: "absolute",
                left: 0,
                top: `${s.from * 100}%`,
                width: "100%",
                height: `${(s.to - s.from) * 100}%`,
                overflow: "hidden",
              }}
            >
              <svg
                viewBox={`0 ${s.from * PLANE_D} ${PLANE_W} ${(s.to - s.from) * PLANE_D}`}
                width="100%"
                height="100%"
                preserveAspectRatio="none"
              >
                <g stroke={theme.gridDim} strokeOpacity={0.5} strokeWidth={4} fill="none">
                  {gridPaths.v.map((d, i) => (i % 2 ? <path key={`v${i}`} d={d} /> : null))}
                  {gridPaths.h.map((d, i) => (i % 2 ? <path key={`h${i}`} d={d} /> : null))}
                </g>
                <g stroke={theme.gridBright} strokeOpacity={0.72} strokeWidth={7} fill="none">
                  {gridPaths.v.map((d, i) => (i % 2 ? null : <path key={`V${i}`} d={d} />))}
                  {gridPaths.h.map((d, i) => (i % 2 ? null : <path key={`H${i}`} d={d} />))}
                </g>
              </svg>
            </div>
          </Plane>
        </AbsoluteFill>
      ))}

      {/* ---- bars: flat rectangles standing on the plane, in the sharp band ---- */}
      <AbsoluteFill>
        <Plane k={k}>
          {bars.map((b) => (
            <div
              key={b.i}
              style={{
                position: "absolute",
                left: `${(b.planeX / PLANE_W) * 100}%`,
                top: `${((BAR_Z * PLANE_D - b.h) / PLANE_D) * 100}%`,
                width: `${(BAR_W / PLANE_W) * 100}%`,
                height: `${(b.h / PLANE_D) * 100}%`,
                marginLeft: `${(-BAR_W / 2 / PLANE_W) * 100}%`,
                transform: `rotateX(${-TILT}deg)`,
                transformOrigin: "50% 100%",
              }}
            >
              <svg viewBox="0 0 100 1000" width="100%" height="100%" preserveAspectRatio="none" style={{ overflow: "visible" }}>
                <defs>
                  {/* The whole bar blooms, not just its cap: in the reference
                      the bar itself acts as a light source. */}
                  <NeonFilter
                    id={`bb${b.i}`}
                    r={6}
                    stops={[0.7 * pulse, 1.15 * pulse, 1.3 * pulse]}
                    region={{ x: -280, y: -180, w: 660, h: 1360 }}
                  />
                  <linearGradient id={`bg${b.i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={theme.barTop} stopOpacity="0.98" />
                    <stop offset="0.14" stopColor={theme.barMid} stopOpacity="0.95" />
                    <stop offset="1" stopColor={theme.barMid} stopOpacity="0.86" />
                  </linearGradient>
                </defs>
                <rect x="0" y="0" width="100" height="1000" fill={`url(#bg${b.i})`} filter={`url(#bb${b.i})`} />
              </svg>
              {/* Bright top edge — the part that actually glows. Thin bright
                  core, halo from the filter stack. */}
              <svg
                viewBox="-100 -50 300 100"
                width="300%"
                height={`${260 * PX_PER_UNIT * k}px`}
                preserveAspectRatio="none"
                style={{
                  position: "absolute",
                  left: "-100%",
                  top: `${-130 * PX_PER_UNIT * k}px`,
                }}
              >
                <defs>
                  <NeonFilter
                    id={`be${b.i}`}
                    r={5}
                    stops={[1.0 * pulse, 1.5 * pulse, 1.7 * pulse]}
                    region={{ x: -100, y: -50, w: 300, h: 100 }}
                  />
                </defs>
                <rect x="0" y="-4" width="100" height="8" fill={theme.edge} filter={`url(#be${b.i})`} />
              </svg>
            </div>
          ))}

          {/* Month labels, scrolling with the bars. 48 % 12 === 0, so the
              labels wrap with the window. */}
          {bars.map((b) => {
            const m = ((b.i % 12) + 12) % 12;
            return (
              <div
                key={`l${b.i}`}
                style={{
                  position: "absolute",
                  left: `${(b.planeX / PLANE_W) * 100}%`,
                  top: `${(BAR_Z * PLANE_D / PLANE_D) * 100}%`,
                  width: `${(1100 / PLANE_W) * 100}%`,
                  marginLeft: `${(-550 / PLANE_W) * 100}%`,
                  marginTop: `${(120 / PLANE_D) * 100}%`,
                  textAlign: "center",
                  color: theme.label,
                  opacity: 0.45,
                  fontFamily: UI_FONT,
                  fontWeight: 500,
                  fontSize: `${200 * PX_PER_UNIT * k}px`,
                  letterSpacing: `${24 * PX_PER_UNIT * k}px`,
                  ...NUM,
                }}
              >
                {MONTHS[m]}
              </div>
            );
          })}

          {/* The baseline the bars stand on, brighter than the rest of the grid. */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: `${BAR_Z * 100}%`,
              width: "100%",
              height: `${14 * PX_PER_UNIT * k}px`,
              marginTop: `${-7 * PX_PER_UNIT * k}px`,
              background: theme.line,
              opacity: 0.55,
            }}
          />

          {/* Trend line on an upright billboard in front of the bars. */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: `${((BAR_Z * PLANE_D - LINE_H) / PLANE_D) * 100}%`,
              width: "100%",
              height: `${(LINE_H / PLANE_D) * 100}%`,
              transform: `translateZ(${1 * k}px) rotateX(${-TILT}deg)`,
              transformOrigin: "50% 100%",
            }}
          >
            <svg viewBox={`0 0 ${LINE_W} ${LINE_H}`} width="100%" height="100%" preserveAspectRatio="none">
              <defs>
                <NeonFilter
                  id="barLine"
                  r={8}
                  stops={[0.9 * pulse, 1.3 * pulse, 1.4 * pulse]}
                  region={{ x: -400, y: -400, w: LINE_W + 800, h: LINE_H + 800 }}
                />
              </defs>
              <path
                d={smoothPath(linePts, 0.35)}
                fill="none"
                stroke={theme.line}
                strokeOpacity={0.5}
                strokeWidth={11}
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#barLine)"
              />
              <polyline
                points={zigPts.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(" ")}
                fill="none"
                stroke={theme.edge}
                strokeWidth={12}
                strokeLinejoin="miter"
                filter="url(#barLine)"
              />
              {/* Crosshair marker terminating the angular series. */}
              <g
                transform={`translate(${zigPts[zigPts.length - 1].x.toFixed(3)} ${zigPts[zigPts.length - 1].y.toFixed(3)})`}
                stroke={theme.edge}
                strokeWidth={9}
                filter="url(#barLine)"
              >
                <line x1={-100} y1={-100} x2={100} y2={100} />
                <line x1={-100} y1={100} x2={100} y2={-100} />
              </g>
            </svg>
          </div>
        </Plane>
      </AbsoluteFill>

      {/* Slight lift in the focus band so the bars sit in air. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(88% 80% at 24% 14%, ${theme.bokeh}26 0%, ${theme.bokeh}0d 36%, rgba(0,0,0,0.48) 86%, rgba(0,0,0,0.7) 100%)`,
          pointerEvents: "none",
        }}
      />

      <DitherPatch opacity={0.018} />
      <Grain opacity={0.021} />
    </AbsoluteFill>
  );
};
