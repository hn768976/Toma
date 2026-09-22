import React from "react";
import {
  BASE_HEIGHT,
  BASE_WIDTH,
  CORE_X,
  CORE_Y,
  OVERSCAN_X,
  OVERSCAN_Y,
  HAZE,
  PALETTE,
} from "./constants";
import { BG_PATTERN } from "./geometry";

/**
 * The flat backdrop: deep navy lifted slightly around the core and falling
 * away to near-black in the corners. This sits behind the perspective stack
 * and is not tilted, so it reads as empty space rather than as a surface.
 */
export const BackgroundWash: React.FC = () => (
  <svg
    width="100%"
    height="100%"
    viewBox={`0 0 ${BASE_WIDTH} ${BASE_HEIGHT}`}
    preserveAspectRatio="none"
    style={{ position: "absolute", inset: 0 }}
  >
    <defs>
      <radialGradient
        id="bgWash"
        cx={CORE_X / BASE_WIDTH}
        cy={CORE_Y / BASE_HEIGHT}
        r={0.82}
      >
        <stop offset="0%" stopColor={PALETTE.bgCentre} />
        <stop offset="42%" stopColor={PALETTE.bgMid} />
        <stop offset="100%" stopColor={PALETTE.bgEdge} />
      </radialGradient>
      {/*
        A broad haze band across the middle. The reference is not a black
        field with a light in it — there is atmosphere between the camera and
        the plane, and without it the core reads as a sprite pasted on black.
      */}
      <radialGradient id="bgHaze" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor={HAZE} stopOpacity={0.34} />
        <stop offset="40%" stopColor={HAZE} stopOpacity={0.17} />
        <stop offset="72%" stopColor={HAZE} stopOpacity={0.05} />
        <stop offset="100%" stopColor={HAZE} stopOpacity={0} />
      </radialGradient>
      <radialGradient id="bgVignette" cx="0.5" cy="0.5" r="0.72">
        <stop offset="34%" stopColor="#000000" stopOpacity={0} />
        <stop offset="100%" stopColor="#000000" stopOpacity={0.8} />
      </radialGradient>
    </defs>
    <rect width={BASE_WIDTH} height={BASE_HEIGHT} fill="url(#bgWash)" />
    <ellipse
      cx={BASE_WIDTH * 0.46}
      cy={BASE_HEIGHT * 0.44}
      rx={BASE_WIDTH * 1.25}
      ry={BASE_HEIGHT * 0.72}
      fill="url(#bgHaze)"
    />
    <rect width={BASE_WIDTH} height={BASE_HEIGHT} fill="url(#bgVignette)" />
  </svg>
);

/**
 * The faint circuit-board plane. Tilted more steeply than the interface so it
 * recedes faster, and blurred hardest of the three depth slabs.
 */
export const BackgroundCircuit: React.FC = () => (
  <g opacity={0.85}>
    {BG_PATTERN.lines.map((l, i) => (
      <line
        key={`l${i}`}
        x1={l.x1}
        y1={l.y1}
        x2={l.x2}
        y2={l.y2}
        stroke={PALETTE.cyanDim}
        strokeWidth={l.w}
        opacity={0.42}
      />
    ))}
    {BG_PATTERN.rects.map((r, i) => (
      <rect
        key={`r${i}`}
        x={r.x}
        y={r.y}
        width={r.w}
        height={r.h}
        fill={r.fill ? PALETTE.cyanDeep : "none"}
        stroke={PALETTE.cyanDim}
        strokeWidth={2.6}
        opacity={r.fill ? 0.24 : 0.3}
      />
    ))}
    {/* A couple of long runs that read as board traces behind everything. */}
    {[0.18, 0.44, 0.71, 0.93].map((f, i) => (
      <line
        key={`h${i}`}
        x1={-OVERSCAN_X}
        y1={BASE_HEIGHT * f}
        x2={BASE_WIDTH + OVERSCAN_X}
        y2={BASE_HEIGHT * f + 40}
        stroke={PALETTE.cyanDim}
        strokeWidth={3}
        opacity={0.22}
      />
    ))}
    {/* Long diagonal rules crossing the whole frame — the reference's
        strongest cue that everything sits on one receding surface. */}
    {[-0.55, -0.16, 0.24, 0.66, 1.05].map((f, i) => (
      <line
        key={`d${i}`}
        x1={BASE_WIDTH * f - OVERSCAN_X}
        y1={-OVERSCAN_Y}
        x2={BASE_WIDTH * (f + 0.62) + OVERSCAN_X}
        y2={BASE_HEIGHT + OVERSCAN_Y}
        stroke={PALETTE.cyanDim}
        strokeWidth={3.4}
        opacity={0.2}
      />
    ))}
    {[0.12, 0.37, 0.62, 0.88].map((f, i) => (
      <line
        key={`v${i}`}
        x1={BASE_WIDTH * f}
        y1={-OVERSCAN_Y}
        x2={BASE_WIDTH * f + 30}
        y2={BASE_HEIGHT + OVERSCAN_Y}
        stroke={PALETTE.cyanDim}
        strokeWidth={3}
        opacity={0.18}
      />
    ))}
  </g>
);
