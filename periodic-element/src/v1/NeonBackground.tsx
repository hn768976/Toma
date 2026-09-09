import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { DURATION_IN_FRAMES } from "../constants";
import { makeRandom, range } from "../lib/random";

const TAU = Math.PI * 2;

type Ghost = {
  /** Centre as a fraction of frame width / height. */
  x: number;
  y: number;
  /** Edge length as a fraction of frame height. */
  size: number;
  /** Blur radius as a fraction of frame height. */
  blur: number;
  opacity: number;
  /** Drift amplitude, fraction of frame height. */
  driftX: number;
  driftY: number;
  phaseX: number;
  phaseY: number;
  tilt: number;
};

/**
 * Out-of-focus periodic-table squares, well behind the card. They are the
 * whole background: there is no particle layer, because drifting circles read
 * as generic motion-graphics filler rather than as context.
 *
 * Placement is a jittered lattice rather than free scatter, so the field reads
 * as a table seen out of focus instead of as random boxes. Cells that would
 * land under the card are pushed outward — the card must sit on clean ground.
 */
const GHOSTS: Ghost[] = (() => {
  const rng = makeRandom("neon-ghost-tiles");
  const COLS = 6;
  const ROWS = 4;
  const tiles: Ghost[] = [];

  for (let cx = 0; cx < COLS; cx++) {
    for (let cy = 0; cy < ROWS; cy++) {
      // Lattice spans wider than the frame so tiles run off every edge.
      let x = (-0.15 + (1.3 * (cx + 0.5)) / COLS) + range(rng, -0.06, 0.06);
      let y = (-0.15 + (1.3 * (cy + 0.5)) / ROWS) + range(rng, -0.07, 0.07);

      // Push out of the card's territory, keeping the lattice feel.
      const dx = x - 0.5;
      const dy = y - 0.5;
      const d = Math.hypot(dx * 1.78, dy); // 1.78 = 16:9, so this is in height units
      const CLEAR = 0.4;
      if (d < CLEAR) {
        const k = d < 1e-4 ? 1 : CLEAR / d;
        x = 0.5 + dx * k;
        y = 0.5 + dy * k;
      }

      // Depth: the further back a tile reads, the softer and fainter it is.
      const depth = rng();
      tiles.push({
        x,
        y,
        size: range(rng, 0.24, 0.62) * (1.15 - depth * 0.35),
        blur: range(rng, 0.005, 0.02) + depth * 0.028,
        opacity: range(rng, 0.05, 0.2) * (1.15 - depth * 0.55),
        driftX: range(rng, 0.006, 0.03),
        driftY: range(rng, 0.01, 0.05),
        phaseX: rng() * TAU,
        phaseY: rng() * TAU,
        tilt: range(rng, -6, 6),
      });
    }
  }
  return tiles;
})();

export const NeonBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  // t goes 0 -> 1 across the loop. Every motion below is a sine of TAU * t,
  // so frame 300 lands exactly back on frame 0.
  const t = frame / DURATION_IN_FRAMES;

  return (
    <AbsoluteFill
      style={{
        // Deep navy, darkest into the corners.
        background: `radial-gradient(ellipse 62% 68% at 50% 48%, #0d1b38 0%, #08122a 42%, #060c1e 70%, #03060f 100%)`,
      }}
    >
      {/* The background carries all of the drift in this composition — the
          card itself is locked to frame centre. */}
      {GHOSTS.map((g, i) => {
        const s = g.size * height;
        const x =
          g.x * width + Math.sin(TAU * t + g.phaseX) * g.driftX * height;
        const y =
          g.y * height + Math.sin(TAU * t + g.phaseY) * g.driftY * height;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - s / 2,
              top: y - s / 2,
              width: s,
              height: s,
              borderRadius: s * 0.08,
              border: `${s * 0.022}px solid rgba(138,190,255,0.8)`,
              boxShadow: `inset 0 0 ${s * 0.12}px rgba(90,150,230,0.35)`,
              opacity: g.opacity,
              filter: `blur(${g.blur * height}px)`,
              transform: `rotate(${g.tilt + Math.sin(TAU * t + g.phaseX) * 1.2}deg)`,
            }}
          />
        );
      })}

      {/* Soft blue glow sitting behind the card position. Kept tight so it
          seats the card rather than washing the frame. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle ${height * 0.35}px at 50% 50%, rgba(58,168,255,${0.2 + Math.sin(TAU * t) * 0.025}) 0%, rgba(45,130,215,0.07) 48%, rgba(30,90,180,0) 74%)`,
        }}
      />
    </AbsoluteFill>
  );
};
