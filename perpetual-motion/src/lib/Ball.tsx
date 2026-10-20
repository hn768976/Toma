import React from "react";
import type { Look } from "./look.ts";
import type { Vec2 } from "./iso.ts";

// A sphere projects to a circle in any orthographic view, so balls are placed
// by mapping their centre through the plane's matrix and drawn as circles.
// Light comes from the upper left, matching the kit's light direction.

export const BallDefs: React.FC<{ look: Look; id: string }> = ({ look, id }) => (
  <defs>
    <radialGradient id={id} cx="0.36" cy="0.32" r="0.75">
      <stop offset="0" stopColor={look.ironBall[0]} />
      <stop offset="0.55" stopColor={look.ironBall[1]} />
      <stop offset="1" stopColor={look.ironBall[2]} />
    </radialGradient>
  </defs>
);

export const Ball: React.FC<{ at: Vec2; r: number; gradient: string; look: Look }> = ({ at, r, gradient, look }) => (
  <g>
    <circle cx={at[0]} cy={at[1]} r={r} fill={`url(#${gradient})`} stroke={look.name === "blueprint" ? look.ink : look.materials.iron.edge} strokeWidth={3.2} />
    <ellipse cx={at[0] - r * 0.36} cy={at[1] - r * 0.4} rx={r * 0.26} ry={r * 0.18} transform={`rotate(-35 ${at[0] - r * 0.36} ${at[1] - r * 0.4})`} fill={look.highlight} opacity={0.72} />
    <circle cx={at[0] + r * 0.28} cy={at[1] + r * 0.34} r={r * 0.5} fill="none" stroke={look.highlight} strokeOpacity={0.12} strokeWidth={r * 0.12} />
  </g>
);
