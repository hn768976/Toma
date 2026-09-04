import React from "react";
import { AbsoluteFill } from "remotion";
import { VANISHING_POINT } from "./layout";
import { between, loopWave, mulberry32, pick } from "./random";

/**
 * A sparse scattering of points for the night version — no Milky Way, just
 * enough to register through the gaps in the canopy. Stars near the moonlit
 * glow are washed out, which is also what stops the centre reading as flat.
 */
type Star = {
  x: number;
  y: number;
  size: number;
  base: number;
  freq: number;
  phase: number;
};

const buildStars = (): Star[] => {
  const rng = mulberry32(0x5aa317);
  return Array.from({ length: 260 }, () => {
    const x = rng();
    const y = rng();
    const dx = x - VANISHING_POINT.x;
    const dy = y - VANISHING_POINT.y;
    // Fade out toward the glow at the vanishing point.
    const falloff = Math.min(1, Math.hypot(dx, dy) / 0.42);
    return {
      x,
      y,
      size: between(rng, 1.6, 4.4),
      base: between(rng, 0.25, 0.9) * falloff,
      freq: pick(rng, [1, 2, 3] as const),
      phase: rng(),
    };
  });
};

const STARS = buildStars();

export const Stars: React.FC<{ t: number }> = ({ t }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    {STARS.map((s, i) => (
      <div
        key={i}
        style={{
          position: "absolute",
          left: `${s.x * 100}%`,
          top: `${s.y * 100}%`,
          width: s.size,
          height: s.size,
          borderRadius: "50%",
          backgroundColor: "#dceaff",
          opacity: s.base * (0.55 + 0.45 * (0.5 + 0.5 * loopWave(t, s.freq, s.phase))),
        }}
      />
    ))}
  </AbsoluteFill>
);
