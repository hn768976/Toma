import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { ONESHOT_FRAMES } from "../lib/loop";
import { NeonFilter } from "../lib/glow";
import { Grain, DitherPatch } from "../lib/grain";
import { alongPolyline, polylinePath } from "../lib/geom";
import { DESIGN_W, DESIGN_H } from "../lib/layout";
import { NAVY_ARROWS, NAVY_MAIN, NAVY_SECOND } from "./growthLineData";
import { UI_FONT, NUM } from "../lib/fonts";

/** Frames over which the line draws. It holds from here to the last frame. */
export const DRAW_END = 180;

const CY = "#5ef0ff";
const CY_HOT = "#e8fdff";
const CY_MID = "#2bb8e8";

export const GrowthLineNavy: React.FC = () => {
  const frame = useCurrentFrame();

  // Ease-out draw: quick off the mark, settling into the final tip.
  const raw = interpolate(frame, [0, DRAW_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const progress = 1 - Math.pow(1 - raw, 2.4);

  // Three integer cycles of glow pulse over the composition.
  const pulse = 1 + 0.09 * Math.sin((Math.PI * 2 * 3 * frame) / ONESHOT_FRAMES);

  const tip = alongPolyline(NAVY_MAIN, progress);
  const secondProgress = Math.max(0, Math.min(1, (progress - 0.06) / 0.94));

  return (
    <AbsoluteFill style={{ backgroundColor: "#041d33" }}>
      {/* Background: brightest toward the top-centre, exactly as the
          reference is lit, falling to near-black in the bottom corners. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(118% 92% at 50% 4%, #3d6d95 0%, #2a5579 22%, #163d60 44%, #0a2843 66%, #051e36 84%, #03182c 100%)",
        }}
      />
      {/* A soft lift behind the line itself so the neon sits in air, not on a flat field. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(52% 46% at 62% 58%, rgba(60,150,205,0.30) 0%, rgba(40,110,165,0.14) 40%, rgba(0,0,0,0) 72%)",
        }}
      />

      <svg
        viewBox={`0 0 ${DESIGN_W} ${DESIGN_H}`}
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <NeonFilter id="navyHero" r={9} stops={[1.15 * pulse, 1.75 * pulse, 2.3 * pulse]} />
          <NeonFilter id="navySecond" r={5} stops={[0.8, 0.9, 0.8]} />
          <NeonFilter id="navyArrow" r={7} stops={[1.0 * pulse, 1.35 * pulse, 1.5 * pulse]} />
          <linearGradient id="arrowBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c9f6ff" stopOpacity="0.92" />
            <stop offset="0.09" stopColor={CY} stopOpacity="0.85" />
            <stop offset="0.36" stopColor={CY_MID} stopOpacity="0.62" />
            <stop offset="0.72" stopColor="#1f86c4" stopOpacity="0.3" />
            <stop offset="1" stopColor="#1f86c4" stopOpacity="0" />
          </linearGradient>
          {/* The arrows must not end on a hard edge — this mask dissolves the
              shaft away toward its base, where the specks take over. */}
          <linearGradient id="arrowFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="1" />
            <stop offset="0.3" stopColor="#fff" stopOpacity="0.92" />
            <stop offset="0.62" stopColor="#fff" stopOpacity="0.4" />
            <stop offset="0.86" stopColor="#fff" stopOpacity="0.08" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* ---- particle arrows, behind the hero line ---- */}
        <g filter="url(#navyArrow)">
          {NAVY_ARROWS.map((a, i) => {
            // An arrow lights up as the drawing tip passes over it.
            const reveal = interpolate(tip.x, [a.x - 40, a.x + 130], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            if (reveal <= 0.001) return null;
            const headH = a.headW * 1.05;
            const maskId = `am${i}`;
            return (
              <g key={i} opacity={reveal}>
                <defs>
                  <mask id={maskId} maskUnits="userSpaceOnUse" x={a.x - a.headW} y={a.topY} width={a.headW * 2} height={a.len}>
                    <rect
                      x={a.x - a.headW}
                      y={a.topY}
                      width={a.headW * 2}
                      height={a.len}
                      fill="url(#arrowFade)"
                    />
                  </mask>
                </defs>
                <g mask={`url(#${maskId})`}>
                  <path
                    d={`M${a.x},${a.topY} L${a.x - a.headW / 2},${a.topY + headH} L${a.x + a.headW / 2},${a.topY + headH} Z`}
                    fill="url(#arrowBody)"
                  />
                  <rect
                    x={a.x - a.shaftW / 2}
                    y={a.topY + headH * 0.88}
                    width={a.shaftW}
                    height={a.len - headH * 0.88}
                    fill="url(#arrowBody)"
                  />
                </g>
                {/* The shower of specks the shaft dissolves into. */}
                {a.specks.map((s, j) => {
                  const t = (s.off + frame * s.v) % 1;
                  const rise = t * a.len * 0.34;
                  const y = a.topY + s.dy - rise;
                  if (y < a.topY) return null;
                  const depth = (y - a.topY) / a.len;
                  const fade = Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
                  const op = s.a * fade * Math.max(0, 1 - depth * 0.55);
                  if (op <= 0.01) return null;
                  return (
                    <circle
                      key={j}
                      cx={a.x + s.dx}
                      cy={y}
                      r={s.r}
                      fill={depth < 0.4 ? CY_HOT : CY}
                      opacity={op}
                    />
                  );
                })}
              </g>
            );
          })}
        </g>

        {/* ---- faint companion line ---- */}
        <path
          d={polylinePath(NAVY_SECOND)}
          fill="none"
          stroke={CY}
          strokeOpacity={0.5}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray="1 1"
          strokeDashoffset={1 - secondProgress}
          filter="url(#navySecond)"
        />

        {/* ---- hero line: a thin bright core, the halo comes from the filter ---- */}
        <g filter="url(#navyHero)">
          <path
            d={polylinePath(NAVY_MAIN)}
            fill="none"
            stroke={CY}
            strokeWidth={13}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={1 - progress}
          />
          <path
            d={polylinePath(NAVY_MAIN)}
            fill="none"
            stroke={CY_HOT}
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={1 - progress}
          />
          {/* Arrowhead riding the tip. */}
          <g transform={`translate(${tip.x} ${tip.y}) rotate(${tip.angle})`}>
            <path d="M96,0 L-34,-52 L-12,0 L-34,52 Z" fill={CY_HOT} />
          </g>
        </g>

        {/* Placeholder axis ticks — generic, short, easy to replace. */}
        <g
          fill="#8fd8ef"
          fillOpacity={0.34}
          fontFamily={UI_FONT}
          fontSize={26}
          fontWeight={500}
          letterSpacing={3}
          style={NUM as React.CSSProperties}
        >
          {["Q1", "Q2", "Q3", "Q4"].map((q, i) => (
            <text key={q} x={0.33 * DESIGN_W + i * 0.175 * DESIGN_W} y={0.945 * DESIGN_H}>
              {q}
            </text>
          ))}
        </g>
      </svg>

      <DitherPatch opacity={0.02} />
      <Grain opacity={0.023} />
    </AbsoluteFill>
  );
};
