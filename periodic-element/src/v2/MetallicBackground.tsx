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
  /** Stroke widths as fractions of frame height. */
  coreWidth: number;
  haloWidth: number;
  core: string;
  halo: string;
  coreOpacity: number;
  haloOpacity: number;
};

/**
 * Two ribbons, and nothing else — they are the whole background.
 *
 * The base positions are set deliberately rather than scattered: one runs
 * through the left third, the other crosses behind the card. That keeps the
 * pair spaced across the frame and puts lit ground under the card for its
 * shadow to fall on. Only the sway phases come from the seed.
 */
const RIBBONS: Ribbon[] = (() => {
  const rng = makeRandom("metallic-ribbons");

  const specs: {
    base: number;
    core: string;
    halo: string;
    coreWidth: number;
    haloWidth: number;
    coreOpacity: number;
    haloOpacity: number;
  }[] = [
    {
      base: 0.26,
      core: "#e8ccff",
      halo: "#7b3fe4",
      coreWidth: 0.0055,
      haloWidth: 0.115,
      coreOpacity: 0.7,
      haloOpacity: 0.26,
    },
    {
      base: 0.56,
      core: "#f7bdf0",
      halo: "#a32f92",
      coreWidth: 0.0038,
      haloWidth: 0.085,
      coreOpacity: 0.6,
      haloOpacity: 0.2,
    },
  ];

  return specs.map((sp) => ({
    xs: [
      sp.base + range(rng, -0.03, 0.03),
      sp.base + range(rng, 0.05, 0.14),
      sp.base + range(rng, -0.14, -0.05),
      sp.base + range(rng, -0.03, 0.03),
    ] as [number, number, number, number],
    // The background carries the drift in this composition, so the ribbons
    // sway a little more than they used to.
    amps: [
      range(rng, 0.015, 0.035),
      range(rng, 0.06, 0.11),
      range(rng, 0.06, 0.11),
      range(rng, 0.015, 0.035),
    ] as [number, number, number, number],
    phases: [rng() * TAU, rng() * TAU, rng() * TAU, rng() * TAU] as [
      number,
      number,
      number,
      number,
    ],
    coreWidth: sp.coreWidth,
    haloWidth: sp.haloWidth,
    core: sp.core,
    halo: sp.halo,
    coreOpacity: sp.coreOpacity,
    haloOpacity: sp.haloOpacity,
  }));
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
          {/* The filter region is given in user space and covers well beyond
              the frame. A bounding-box region (the default) is measured on the
              path geometry and excludes the stroke, so a halo this wide gets
              cut off mid-blur and leaves a hard vertical edge in the purple. */}
          {[
            { id: "ribbon-halo", sd: height * 0.038 },
            { id: "ribbon-core", sd: height * 0.004 },
          ].map(({ id, sd }) => (
            <filter
              key={id}
              id={id}
              filterUnits="userSpaceOnUse"
              x={-width * 0.5}
              y={-height * 0.5}
              width={width * 2}
              height={height * 2}
            >
              <feGaussianBlur stdDeviation={sd} />
            </filter>
          ))}
        </defs>

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
