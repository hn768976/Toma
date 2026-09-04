import React from "react";
import { AbsoluteFill } from "remotion";
import type { Palette } from "./palette";
import { between, loopBump, loopWave, mulberry32, pick } from "./random";

/**
 * Large, heavily blurred pale masses drifting across the frame. They sit in
 * front of the far tree tiers and behind the near ones, which is what separates
 * the depth planes — without them the far trees just look grey rather than
 * distant.
 *
 * Each mass moves on a closed Lissajous path with whole-number frequencies, so
 * it is back where it started on the last frame of the loop.
 */
type FogMass = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  ax: number;
  ay: number;
  fx: number;
  fy: number;
  px: number;
  py: number;
  blur: number;
  alpha: number;
  fo: number;
  po: number;
};

const buildFog = (): FogMass[] => {
  const rng = mulberry32(0x3f19aa);
  return Array.from({ length: 6 }, () => ({
    cx: between(rng, 0.1, 0.9),
    cy: between(rng, 0.08, 0.92),
    rx: between(rng, 0.42, 0.78),
    ry: between(rng, 0.26, 0.5),
    ax: between(rng, 0.05, 0.16),
    ay: between(rng, 0.03, 0.1),
    fx: pick(rng, [1, 1, 2] as const),
    fy: pick(rng, [1, 2] as const),
    px: rng(),
    py: rng(),
    blur: between(rng, 90, 190),
    alpha: between(rng, 0.45, 1),
    fo: pick(rng, [1, 2] as const),
    po: rng(),
  }));
};

const FOG = buildFog();

export const Fog: React.FC<{ palette: Palette; t: number }> = ({ palette, t }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    {FOG.map((m, i) => {
      const x = m.cx + m.ax * loopWave(t, m.fx, m.px);
      const y = m.cy + m.ay * loopWave(t, m.fy, m.py);
      // Breathe the density a little so the fog does not read as a rigid shape
      // sliding around behind the trees.
      const alpha =
        palette.fogOpacity * m.alpha * (0.62 + 0.38 * loopBump(t, m.fo, m.po));

      return (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${(x - m.rx / 2) * 100}%`,
            top: `${(y - m.ry / 2) * 100}%`,
            width: `${m.rx * 100}%`,
            height: `${m.ry * 100}%`,
            borderRadius: "50%",
            background: `radial-gradient(ellipse at center, rgba(${palette.fog}, ${alpha.toFixed(4)}) 0%, rgba(${palette.fog}, 0) 68%)`,
            filter: `blur(${m.blur}px)`,
          }}
        />
      );
    })}
  </AbsoluteFill>
);
