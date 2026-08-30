import React from "react";
import { Particle } from "./tree";
import { LungVariant } from "./variants";

const TAU = Math.PI * 2;

/**
 * Light specks suggesting air. Every drift path is built from integer
 * frequencies over the loop length, so each one closes exactly at the last
 * frame.
 *
 * "circulating" specks additionally ride the breath — carried outward on the
 * inhale and back in on the exhale. "sluggish" ones ignore it entirely and
 * simply wander, which is what air failing to reach the far airways looks
 * like.
 */
export const ParticleField: React.FC<{
  particles: Particle[];
  variant: LungVariant;
  /** Loop progress, 0..1. */
  loopT: number;
  breath: number;
}> = ({ particles, variant, loopT, breath }) => {
  const { palette } = variant;
  const carried = variant.particles.behaviour === "circulating";
  const travel = variant.particles.breathTravel;

  return (
    <g>
      {particles.map((p, i) => {
        const dx = Math.sin(TAU * (p.freqX * loopT + p.phaseX)) * p.radiusX;
        const dy = Math.cos(TAU * (p.freqY * loopT + p.phaseY)) * p.radiusY;
        const push = carried ? breath * travel : 0;
        const x = p.x + dx + p.outX * push;
        const y = p.y + dy + p.outY * push;
        const fade =
          p.opacity * (0.72 + 0.28 * Math.sin(TAU * (p.fadeFreq * loopT + p.fadePhase)));
        return (
          <circle
            key={`p-${i}`}
            cx={x}
            cy={y}
            r={p.size / 2}
            fill={p.bright ? palette.particleBright : palette.particlePale}
            opacity={Math.min(1, Math.max(0, fade))}
          />
        );
      })}
    </g>
  );
};
