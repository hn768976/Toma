import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Grain } from "../../lib/Grain";
import { TAU, loopT, smoothstep } from "../../lib/loop";
import type { SpinnerVersion } from "../../versions";

/**
 * Look 2 — Soft Spinner. Eight teardrop petals, heavily defocused.
 * Loop: 2 whole turns and 8 whole chase laps in 600 frames.
 */
const PETALS = 8;
const TURNS = 2; // whole rotations per loop
const CHASE_LAPS = 8; // whole chase laps per loop (relative to the petals)

/** Hull of two circles (inner tip radius ri at a, outer end radius ro at b), axis +y. */
const teardropPath = (a: number, ri: number, b: number, ro: number) => {
  const d = b - a;
  const s = (ro - ri) / d; // sin(alpha)
  const c = Math.sqrt(1 - s * s);
  const tiR = [ri * c, a - ri * s];
  const toR = [ro * c, b - ro * s];
  const f = (n: number) => n.toFixed(2);
  return [
    `M ${f(tiR[0])} ${f(tiR[1])}`,
    `L ${f(toR[0])} ${f(toR[1])}`,
    `A ${f(ro)} ${f(ro)} 0 1 1 ${f(-toR[0])} ${f(toR[1])}`,
    `L ${f(-tiR[0])} ${f(tiR[1])}`,
    `A ${f(ri)} ${f(ri)} 0 0 1 ${f(tiR[0])} ${f(tiR[1])}`,
    "Z",
  ].join(" ");
};

export const SoftSpinner: React.FC<{ v: SpinnerVersion }> = ({ v }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const t = loopT(frame);

  const R = height * 0.55 * 0.5; // outer radius: spinner ≈ 55% of frame height
  const outer = teardropPath(R * 0.26, R * 0.05, R - R * 0.22, R * 0.22);
  const inner = teardropPath(R * 0.42, R * 0.02, R - R * 0.29, R * 0.1);

  const sigma = width * 0.0075; // blur diameter ≈ 1.5% of frame width
  const h = width * 0.0032; // halo base radius, stacked 1:4:12

  const rotation = TURNS * 360 * t;
  const head = CHASE_LAPS * TAU * t; // chase head angle, relative to petals

  const petals = Array.from({ length: PETALS }, (_, i) => {
    const theta = (i / PETALS) * TAU;
    // angular distance the head has travelled past this petal, in [0, 2π)
    let d = (head - theta) % TAU;
    if (d < 0) d += TAU;
    const trail = Math.pow(1 - d / TAU, 1.6); // 1 just passed → fading behind
    const ramp = smoothstep(TAU - 0.45, TAU, d); // head approaching: smooth rise
    const glow = Math.max(trail, ramp);
    const brightness = 0.42 + 0.58 * glow;
    return { angle: (i * 360) / PETALS + 180, brightness, glow };
  });

  return (
    // key={frame}: fresh DOM/layers every frame → identical raster cold or mid-sequence
    <AbsoluteFill key={frame} style={{ backgroundColor: v.background }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: "absolute" }}>
        <defs>
          <filter id="petalBlur" x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation={sigma} />
          </filter>
          <filter id="petalCore" x="-50%" y="-50%" width="200%" height="200%" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation={sigma * 0.9} />
          </filter>
          {/* stacked halo: radii 1 : 4 : 12 */}
          <filter id="halo" x="-100%" y="-100%" width="300%" height="300%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation={h} result="b1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation={h * 4} result="b4" />
            <feGaussianBlur in="SourceGraphic" stdDeviation={h * 12} result="b12" />
            <feComponentTransfer in="b1" result="b1a">
              <feFuncA type="linear" slope={0.6} />
            </feComponentTransfer>
            <feComponentTransfer in="b4" result="b4a">
              <feFuncA type="linear" slope={0.5} />
            </feComponentTransfer>
            <feComponentTransfer in="b12" result="b12a">
              <feFuncA type="linear" slope={0.3} />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode in="b12a" />
              <feMergeNode in="b4a" />
              <feMergeNode in="b1a" />
            </feMerge>
          </filter>
        </defs>
        <g transform={`translate(${width / 2} ${height / 2}) rotate(${rotation})`}>
          {/* red-orange / deep-blue halo behind each petal */}
          <g filter="url(#halo)">
            {petals.map((p, i) => (
              <path
                key={i}
                d={outer}
                transform={`rotate(${p.angle}) scale(1.04)`}
                fill={v.halo}
                opacity={0.35 + 0.4 * p.brightness}
              />
            ))}
          </g>
          {/* saturated petal bodies */}
          <g filter="url(#petalBlur)">
            {petals.map((p, i) => (
              <path key={i} d={outer} transform={`rotate(${p.angle})`} fill={v.petal} opacity={p.brightness} />
            ))}
          </g>
          {/* pale centres → brighter, paler middle, saturated edges */}
          <g filter="url(#petalCore)">
            {petals.map((p, i) => (
              <path
                key={i}
                d={inner}
                transform={`rotate(${p.angle})`}
                fill={v.center}
                opacity={0.2 + 0.55 * p.brightness}
              />
            ))}
          </g>
        </g>
      </svg>
      <Grain amount={0.025} seed={2} />
    </AbsoluteFill>
  );
};
