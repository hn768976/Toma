import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { DURATION_IN_FRAMES } from "../constants";
import { makeRandom, range } from "../lib/random";

const TAU = Math.PI * 2;

type Ribbon = {
  /** Control-point x positions as fractions of frame width. */
  xs: [number, number, number, number];
  /** Sway amplitude per control point, fraction of frame width. */
  amps: [number, number, number, number];
  phases: [number, number, number, number];
  /** Core stroke width as a fraction of frame height. */
  coreWidth: number;
  haloWidth: number;
  core: string;
  halo: string;
  coreOpacity: number;
  haloOpacity: number;
};

const RIBBONS: Ribbon[] = (() => {
  const rng = makeRandom("metallic-ribbons");
  const palette: [string, string][] = [
    ["#e6c8ff", "#7b3fe4"],
    ["#f5b8ee", "#c0349f"],
    ["#cbb0ff", "#5c2bb8"],
  ];
  return palette.map(([core, halo], i) => {
    const base = 0.16 + i * 0.24 + range(rng, -0.05, 0.05);
    return {
      xs: [
        base + range(rng, -0.04, 0.04),
        base + range(rng, 0.02, 0.16),
        base + range(rng, -0.16, -0.02),
        base + range(rng, -0.04, 0.04),
      ] as [number, number, number, number],
      amps: [
        range(rng, 0.01, 0.03),
        range(rng, 0.04, 0.09),
        range(rng, 0.04, 0.09),
        range(rng, 0.01, 0.03),
      ] as [number, number, number, number],
      phases: [rng() * TAU, rng() * TAU, rng() * TAU, rng() * TAU] as [
        number,
        number,
        number,
        number,
      ],
      coreWidth: range(rng, 0.003, 0.007),
      haloWidth: range(rng, 0.035, 0.075),
      core,
      halo,
      coreOpacity: range(rng, 0.45, 0.75),
      haloOpacity: range(rng, 0.1, 0.2),
    };
  });
})();

export const MetallicBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const t = frame / DURATION_IN_FRAMES;

  return (
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(155deg, #1a0828 0%, #120620 34%, #0a0414 68%, #050209 100%)",
      }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <filter id="ribbon-halo" x="-40%" y="-20%" width="180%" height="140%">
            <feGaussianBlur stdDeviation={height * 0.035} />
          </filter>
          <filter id="ribbon-core" x="-40%" y="-20%" width="180%" height="140%">
            <feGaussianBlur stdDeviation={height * 0.004} />
          </filter>
        </defs>

        {/* Broad, very soft violet wash so the ribbons sit in something rather
            than floating on flat black. */}
        <ellipse
          cx={width * (0.36 + Math.sin(TAU * t) * 0.03)}
          cy={height * 0.5}
          rx={width * 0.18}
          ry={height * 0.6}
          fill="#4c1a86"
          opacity={0.14}
          filter="url(#ribbon-halo)"
        />

        {RIBBONS.map((r, i) => {
          // Every control point sways on a sine of the loop, so the ribbon
          // reshapes continuously and comes back to its start at frame 300.
          const x = r.xs.map(
            (base, k) =>
              (base + Math.sin(TAU * t + r.phases[k]) * r.amps[k]) * width,
          );
          const d = `M ${x[0]} ${-height * 0.1} C ${x[1]} ${height * 0.3}, ${x[2]} ${height * 0.68}, ${x[3]} ${height * 1.1}`;
          return (
            <g key={i}>
              <path
                d={d}
                stroke={r.halo}
                strokeWidth={r.haloWidth * height}
                strokeLinecap="round"
                fill="none"
                opacity={r.haloOpacity}
                filter="url(#ribbon-halo)"
              />
              <path
                d={d}
                stroke={r.core}
                strokeWidth={r.coreWidth * height}
                strokeLinecap="round"
                fill="none"
                opacity={r.coreOpacity}
                filter="url(#ribbon-core)"
              />
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
