import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { ONESHOT_FRAMES } from "../lib/loop";
import { NeonFilter } from "../lib/glow";
import { Grain, DitherPatch } from "../lib/grain";
import { polylinePath } from "../lib/geom";
import { DESIGN_W, DESIGN_H, useScale } from "../lib/layout";
import { BLACK_BEHIND, BLACK_MAIN } from "./growthLineData";
import { UI_FONT, NUM } from "../lib/fonts";
import { mulberry32, range } from "../lib/random";

export const DRAW_END = 180;

const HOT = "#f2fffb";
const GREEN = "#3dffc6";
const TEAL = "#0fd6d0";

/* The perspective grid. Drawn once: a plain lattice, put into perspective by
   the CSS 3D transform on its wrapper, which is where the convergence comes
   from — there is no renderer here. */
const GRID_W = 5200;
const GRID_H = 3400;
const MAJOR = 14;
const MINOR = 4;

const gridLines = (() => {
  const v: string[] = [];
  const h: string[] = [];
  for (let i = 0; i <= MAJOR * MINOR; i++) {
    const x = (GRID_W * i) / (MAJOR * MINOR);
    v.push(`M${x},0 L${x},${GRID_H}`);
  }
  for (let j = 0; j <= 10 * MINOR; j++) {
    const y = (GRID_H * j) / (10 * MINOR);
    h.push(`M0,${y} L${GRID_W},${y}`);
  }
  return { v, h };
})();

/** A handful of faint background sparks, seeded once. */
const SPARKS = (() => {
  const rnd = mulberry32(606060);
  return Array.from({ length: 46 }, () => ({
    x: range(rnd, 0, DESIGN_W),
    y: range(rnd, 0, DESIGN_H),
    r: range(rnd, 2, 6),
    a: range(rnd, 0.06, 0.3),
    f: Math.round(range(rnd, 2, 6)),
    p: rnd(),
  }));
})();

export const GrowthLineBlack: React.FC = () => {
  const frame = useCurrentFrame();
  const k = useScale();

  const raw = interpolate(frame, [0, DRAW_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const progress = 1 - Math.pow(1 - raw, 2.4);
  const pulse = 1 + 0.08 * Math.sin((Math.PI * 2 * 3 * frame) / ONESHOT_FRAMES);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(85% 80% at 38% 46%, #04171d 0%, #020c11 42%, #01060a 72%, #000203 100%)",
        }}
      />

      {/* ---- tilted perspective grid (CSS 3D, blurred) ---- */}
      <AbsoluteFill
        style={{
          perspective: `${2000 * k}px`,
          perspectiveOrigin: "62% 26%",
          filter: `blur(${11 * k}px)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: `${GRID_W * k}px`,
            height: `${GRID_H * k}px`,
            marginLeft: `${(-GRID_W / 2) * k}px`,
            marginTop: `${(-GRID_H / 2) * k}px`,
            transform: `translateZ(${-260 * k}px) rotateX(19deg) rotateY(-26deg) rotateZ(-4deg) scale(1.75)`,
            transformStyle: "preserve-3d",
          }}
        >
          <svg viewBox={`0 0 ${GRID_W} ${GRID_H}`} width="100%" height="100%">
            <g stroke="#0b6a7d" strokeOpacity={0.2} strokeWidth={2} fill="none">
              {gridLines.v.map((d, i) => (i % MINOR === 0 ? null : <path key={`v${i}`} d={d} />))}
              {gridLines.h.map((d, i) => (i % MINOR === 0 ? null : <path key={`h${i}`} d={d} />))}
            </g>
            <g stroke="#1592ae" strokeOpacity={0.44} strokeWidth={4.5} fill="none">
              {gridLines.v.map((d, i) => (i % MINOR === 0 ? <path key={`V${i}`} d={d} /> : null))}
              {gridLines.h.map((d, i) => (i % MINOR === 0 ? <path key={`H${i}`} d={d} /> : null))}
            </g>
          </svg>
        </div>
      </AbsoluteFill>

      {/* ---- secondary jagged line, sitting behind the hero and softened ---- */}
      <AbsoluteFill style={{ filter: `blur(${4.5 * k}px)`, opacity: 0.5 }}>
        <svg viewBox={`0 0 ${DESIGN_W} ${DESIGN_H}`} width="100%" height="100%">
          <defs>
            <NeonFilter id="blkSecond" r={5} stops={[0.7, 0.8, 0.7]} />
          </defs>
          <path
            d={polylinePath(BLACK_BEHIND)}
            fill="none"
            stroke="#17557e"
            strokeWidth={6}
            strokeLinejoin="round"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={1 - Math.max(0, progress - 0.04)}
            filter="url(#blkSecond)"
          />
        </svg>
      </AbsoluteFill>

      {/* ---- hero line: the only sharp thing in the frame ---- */}
      <svg
        viewBox={`0 0 ${DESIGN_W} ${DESIGN_H}`}
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <NeonFilter id="blkHero" r={13} stops={[1.2 * pulse, 1.9 * pulse, 2.6 * pulse]} />
          <linearGradient id="blkHeroGrad" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor={TEAL} />
            <stop offset="0.45" stopColor={GREEN} />
            <stop offset="1" stopColor="#7dffd8" />
          </linearGradient>
        </defs>
        <g filter="url(#blkHero)">
          <path
            d={polylinePath(BLACK_MAIN)}
            fill="none"
            stroke="url(#blkHeroGrad)"
            strokeWidth={34}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={1 - progress}
          />
          {/* Hot inner core keeps the stroke from reading as a fuzzy tube. */}
          <path
            d={polylinePath(BLACK_MAIN)}
            fill="none"
            stroke={HOT}
            strokeOpacity={0.5}
            strokeWidth={12}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={1 - progress}
          />
        </g>
        <g>
          {SPARKS.map((s, i) => {
            const a =
              s.a *
              (0.45 +
                0.55 * Math.sin(Math.PI * 2 * s.f * (frame / ONESHOT_FRAMES) + s.p * Math.PI * 2));
            return <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#6fe8ff" opacity={Math.max(0, a)} />;
          })}
        </g>
      </svg>

      {/* ---- heavily blurred foreground curve, as in the reference ---- */}
      <AbsoluteFill style={{ filter: `blur(${26 * k}px)`, opacity: 0.6 }}>
        <svg viewBox={`0 0 ${DESIGN_W} ${DESIGN_H}`} width="100%" height="100%">
          <path
            d={`M${-0.05 * DESIGN_W},${1.12 * DESIGN_H} C${0.22 * DESIGN_W},${0.92 * DESIGN_H} ${0.46 * DESIGN_W},${0.7 * DESIGN_H} ${1.06 * DESIGN_W},${0.55 * DESIGN_H}`}
            fill="none"
            stroke="#9fd8d6"
            strokeOpacity={0.5}
            strokeWidth={40}
            strokeLinecap="round"
          />
        </svg>
      </AbsoluteFill>

      {/* Generic placeholder ticks, deliberately faint. */}
      <svg
        viewBox={`0 0 ${DESIGN_W} ${DESIGN_H}`}
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0 }}
      >
        <g
          fill="#7fd8de"
          fillOpacity={0.2}
          fontFamily={UI_FONT}
          fontSize={24}
          fontWeight={500}
          letterSpacing={4}
          style={NUM as React.CSSProperties}
        >
          {["Series 1", "Series 2"].map((s, i) => (
            <text key={s} x={0.045 * DESIGN_W} y={0.088 * DESIGN_H + i * 44}>
              {s}
            </text>
          ))}
        </g>
      </svg>

      <DitherPatch opacity={0.018} />
      <Grain opacity={0.022} />
    </AbsoluteFill>
  );
};
