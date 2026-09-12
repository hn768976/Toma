import React, { useMemo } from "react";
import { interpolate } from "remotion";
import {
  BINARY_RING_SPEED,
  BRACKET_RING_SPEED,
  OUTER_ARC_SPEED,
  SEGMENT_RING_SPEED,
  TICK_RING_SPEED,
  MONO_FONT,
} from "./constants";
import {
  Pose,
  Projected,
  arcPoints,
  circlePoints,
  degToRad,
  pathFor,
  project,
  toPath,
} from "./projection";
import {
  KEYHOLE_OUTLINE,
  MosaicCell,
  SHIELD_OUTLINE,
  buildMosaicCells,
} from "./shield-geometry";
import { seededRandom } from "../shared/random";
import { Theme } from "./theme";

// Ring radii in emblem-local units. The shield's envelope stops just
// inside R_INNER so the plate reads as one nested assembly.
const R_OUTER_ARC = 392;
const R_OUTER_LINE = 370;
const R_BINARY = 346;
const R_BINARY_LINE = 324;
const R_TICK_INNER = 296;
const R_TICK_OUTER = 316;
const R_SEGMENT = 272;
const R_BRACKET = 250;
const R_INNER = 238;

const BINARY_COUNT = 84;
const TICK_COUNT = 120;

// Start angle / sweep, in degrees, for each bright chunk of the
// segmented ring and the outer arc ring.
const SEGMENTS: [number, number][] = [
  [8, 46],
  [64, 22],
  [96, 58],
  [166, 30],
  [206, 64],
  [282, 26],
  [316, 38],
];
const OUTER_ARCS: [number, number][] = [
  [-24, 72],
  [110, 44],
  [190, 96],
  [304, 30],
];
const BRACKETS: [number, number][] = [
  [-14, 28],
  [76, 28],
  [166, 28],
  [256, 28],
];

/** Normalised nearness of a projected point, 0 = far side, 1 = near. */
const nearness = (p: Projected, radius: number) =>
  Math.max(0, Math.min(1, (p.z / radius + 1) / 2));

type EmblemProps = {
  theme: Theme;
  pose: Pose;
  frame: number;
  /** Unique per composition so the SVG filter/clip ids never collide. */
  uid: string;
  /** 0 -> 1 reveal used by the opening flash. */
  reveal: number;
};

export const Emblem: React.FC<EmblemProps> = ({
  theme,
  pose,
  frame,
  uid,
  reveal,
}) => {
  const { palette } = theme;
  const cells = useMemo(() => buildMosaicCells(), []);

  const shieldPath = pathFor(SHIELD_OUTLINE, pose);
  const keyholePath = pathFor(KEYHOLE_OUTLINE, pose);
  const clipId = `${uid}-shield-clip`;
  const bloomId = `${uid}-bloom`;
  const softBloomId = `${uid}-soft-bloom`;

  // --- rings -------------------------------------------------------------
  const rotate = (
    points: [number, number][],
    deg: number,
  ): [number, number][] => {
    const a = degToRad(deg);
    const c = Math.cos(a);
    const s = Math.sin(a);
    return points.map(([x, y]) => [x * c - y * s, x * s + y * c]);
  };

  const outerLine = pathFor(circlePoints(R_OUTER_LINE, 128), pose);
  const binaryLine = pathFor(circlePoints(R_BINARY_LINE, 128), pose);
  const innerLine = pathFor(circlePoints(R_INNER, 128), pose);

  const outerArcPaths = OUTER_ARCS.map(([start, sweep]) =>
    pathFor(
      rotate(
        arcPoints(R_OUTER_ARC, start, start + sweep, 40),
        frame * OUTER_ARC_SPEED,
      ),
      pose,
      false,
    ),
  );

  const segmentPaths = SEGMENTS.map(([start, sweep]) =>
    pathFor(
      rotate(
        arcPoints(R_SEGMENT, start, start + sweep, 40),
        frame * SEGMENT_RING_SPEED,
      ),
      pose,
      false,
    ),
  );

  const bracketPaths = BRACKETS.map(([start, sweep]) =>
    pathFor(
      rotate(
        arcPoints(R_BRACKET, start, start + sweep, 24),
        frame * BRACKET_RING_SPEED,
      ),
      pose,
      false,
    ),
  );

  const ticks = [];
  for (let i = 0; i < TICK_COUNT; i++) {
    const deg = (360 / TICK_COUNT) * i + frame * TICK_RING_SPEED;
    const a = degToRad(deg);
    const major = i % 10 === 0;
    const outer = major ? R_TICK_OUTER + 9 : R_TICK_OUTER;
    const inner = project(
      Math.cos(a) * R_TICK_INNER,
      Math.sin(a) * R_TICK_INNER,
      pose,
    );
    const out = project(Math.cos(a) * outer, Math.sin(a) * outer, pose);
    ticks.push({
      key: i,
      x1: inner.x,
      y1: inner.y,
      x2: out.x,
      y2: out.y,
      major,
      near: nearness(out, R_TICK_OUTER),
    });
  }

  const binaryGlyphs = [];
  for (let i = 0; i < BINARY_COUNT; i++) {
    const deg = (360 / BINARY_COUNT) * i + frame * BINARY_RING_SPEED;
    const a = degToRad(deg);
    const p = project(Math.cos(a) * R_BINARY, Math.sin(a) * R_BINARY, pose);
    // A neighbouring sample gives the tangent direction on screen, so the
    // glyphs stay laid along the ring however it is rotated in depth.
    const nextA = a + 0.02;
    const q = project(
      Math.cos(nextA) * R_BINARY,
      Math.sin(nextA) * R_BINARY,
      pose,
    );
    const angle = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
    // Each glyph flips between 0 and 1 on its own slow schedule, from its
    // own seeded starting value — parity on the index alone would spell
    // out a giveaway 1010... pattern around the whole ring on frame 0.
    const flipPeriod = 24 + Math.floor(seededRandom(i, 11) * 90);
    const startBit = seededRandom(i, 12) > 0.5 ? 1 : 0;
    const bit =
      (Math.floor(frame / flipPeriod) + startBit) % 2 === 0 ? "0" : "1";
    binaryGlyphs.push({
      key: i,
      x: p.x,
      y: p.y,
      angle,
      bit,
      size: 17 * p.f,
      near: nearness(p, R_BINARY),
    });
  }

  // --- shield mosaic -----------------------------------------------------
  // A slow wave sweeping down the shield lifts a band of tiles, on top of
  // each tile's own seeded flicker — this is what makes the plate read as
  // live data rather than a flat texture.
  const waveY = ((frame * 0.011) % 1.6) - 0.3;

  const mosaicQuads = cells.map((cell: MosaicCell) => {
    const a = project(cell.x, cell.y, pose);
    const b = project(cell.x + cell.size, cell.y, pose);
    const c = project(cell.x + cell.size, cell.y + cell.size, pose);
    const d = project(cell.x, cell.y + cell.size, pose);
    const base = seededRandom(cell.index, 3);
    const flickerPhase = seededRandom(cell.index, 7) * Math.PI * 2;
    const flicker = 0.5 + 0.5 * Math.sin(frame * 0.08 + flickerPhase);
    const waveHit = Math.max(0, 1 - Math.abs(cell.t - waveY) * 7);
    const level = Math.min(1, base * 0.62 + flicker * 0.24 + waveHit * 0.5);
    const fill =
      level > 0.78
        ? palette.mosaicHot
        : level > 0.45
          ? palette.mosaicMid
          : palette.mosaicDim;
    return {
      key: cell.index,
      d: toPath([a, b, c, d]),
      fill,
      opacity: 0.34 + level * 0.66,
    };
  });

  const edgeGlow = interpolate(Math.sin(frame * 0.045), [-1, 1], [0.72, 1]);

  return (
    <g>
      <defs>
        <filter id={bloomId} x="-45%" y="-45%" width="190%" height="190%">
          <feGaussianBlur stdDeviation={9} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={softBloomId} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation={26} />
        </filter>
        <clipPath id={clipId}>
          {/* Even-odd so the keyhole is a true hole in the mesh. */}
          <path d={`${shieldPath} ${keyholePath}`} clipRule="evenodd" />
        </clipPath>
      </defs>

      {/* Bloom bed: a blurred copy of the shield silhouette sitting under
          everything, which is what gives the emblem its halo. */}
      <g
        opacity={theme.palette.glowStrength * 0.55 * reveal}
        filter={`url(#${softBloomId})`}
      >
        <path d={shieldPath} fill={palette.glow} />
        <path
          d={outerLine}
          fill="none"
          stroke={palette.glow}
          strokeWidth={14}
        />
      </g>

      <g opacity={reveal}>
        {/* Outer hairlines */}
        <path
          d={outerLine}
          fill="none"
          stroke={palette.ringDim}
          strokeWidth={1.6}
          opacity={0.45}
        />
        <path
          d={binaryLine}
          fill="none"
          stroke={palette.ringDim}
          strokeWidth={1.2}
          opacity={0.38}
        />
        <path
          d={innerLine}
          fill="none"
          stroke={palette.ringDim}
          strokeWidth={1.4}
          opacity={0.5}
        />

        {/* Outer arc ring */}
        <g filter={`url(#${bloomId})`}>
          {outerArcPaths.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={palette.ringBright}
              strokeWidth={4}
              strokeLinecap="round"
              opacity={0.8}
            />
          ))}
        </g>

        {/* Binary digit ring */}
        <g fill={palette.binaryText} fontFamily={MONO_FONT} textAnchor="middle">
          {binaryGlyphs.map((g) => (
            <text
              key={g.key}
              x={g.x}
              y={g.y}
              fontSize={g.size}
              opacity={0.3 + g.near * 0.7}
              transform={`rotate(${g.angle.toFixed(2)} ${g.x.toFixed(2)} ${g.y.toFixed(2)})`}
              dominantBaseline="middle"
            >
              {g.bit}
            </text>
          ))}
        </g>

        {/* Tick ring */}
        <g>
          {ticks.map((t) => (
            <line
              key={t.key}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={t.major ? palette.ringAccent : palette.ringBright}
              strokeWidth={t.major ? 2.6 : 1.5}
              opacity={(t.major ? 0.85 : 0.5) * (0.35 + t.near * 0.65)}
            />
          ))}
        </g>

        {/* Segmented ring — the brightest band of the assembly */}
        <g filter={`url(#${bloomId})`}>
          {segmentPaths.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={palette.ringAccent}
              strokeWidth={9}
              strokeLinecap="butt"
              opacity={0.9}
            />
          ))}
        </g>

        {/* Corner brackets */}
        <g>
          {bracketPaths.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={palette.ringBright}
              strokeWidth={3}
              strokeLinecap="round"
              opacity={0.7}
            />
          ))}
        </g>

        {/* Shield body */}
        <path
          d={`${shieldPath} ${keyholePath}`}
          fillRule="evenodd"
          fill={palette.shieldFill}
        />
        <g clipPath={`url(#${clipId})`} opacity={theme.solidShield ? 0.5 : 1}>
          {mosaicQuads.map((q) => (
            <path key={q.key} d={q.d} fill={q.fill} opacity={q.opacity} />
          ))}
        </g>
        <path
          d={shieldPath}
          fill="none"
          stroke={palette.shieldStroke}
          strokeWidth={theme.solidShield ? 5 : 3.5}
          strokeLinejoin="round"
          opacity={edgeGlow}
          filter={theme.solidShield ? undefined : `url(#${bloomId})`}
        />
        <path
          d={keyholePath}
          fill={palette.keyholeFill}
          stroke={palette.keyholeStroke}
          strokeWidth={2.4}
          opacity={0.95}
        />
      </g>
    </g>
  );
};
