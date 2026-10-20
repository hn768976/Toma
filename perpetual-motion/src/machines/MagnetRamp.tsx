import React from "react";
import { P, parts, shadows, grid } from "../generated/magnet.ts";
import { RAMP, simulate, J_START, CHUTE_S, type Phase, type V3 } from "./magnet.spec.ts";
import { iso, sphereRadius } from "../lib/iso.ts";
import { Static } from "../lib/Planar.tsx";
import { Ball, BallDefs } from "../lib/Ball.tsx";
import type { MachineDef, MachineProps } from "../lib/Stage.tsx";

/** One cycle of the ball's closed path takes 300 frames; two cycles per loop. */
export const CYCLE_FRAMES = 300;

// Solve the cycle once: the J-curl's exit speed is a fixed point of the
// chute's physics, then the 10 s cycle is sampled every 1/3000 s.
const V0 = (() => {
  let v = 120;
  for (let i = 0; i < 6; i++) v = simulate(RAMP.crawl, v).vEnd;
  return v;
})();
export const CYCLE = simulate(RAMP.crawl, V0);

// Rolling: a point on the ball turns about the axis across its path by
// distance ÷ radius. The turns per cycle are rounded to a whole number so the
// marks come back to where they started when the loop closes.
const DIST = (() => {
  const d = [0];
  for (let i = 1; i < CYCLE.samples.length; i++) {
    const a = CYCLE.samples[i - 1].p;
    const b = CYCLE.samples[i].p;
    d.push(d[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  return d;
})();
const TURNS = Math.round(DIST[DIST.length - 1] / (2 * Math.PI * RAMP.ball));
const VIEW: V3 = [Math.cos(Math.PI / 4) * Math.cos(Math.PI / 6), Math.sin(Math.PI / 4) * Math.cos(Math.PI / 6), Math.sin(Math.PI / 6)];

function marks(frame: number, c: V3): { at: [number, number]; alpha: number }[] {
  const f = ((frame % CYCLE_FRAMES) + CYCLE_FRAMES) % CYCLE_FRAMES;
  const i = Math.min(CYCLE.samples.length - 2, Math.floor((f / CYCLE_FRAMES) * (CYCLE.samples.length - 1)));
  const a = CYCLE.samples[Math.max(0, i - 8)].p;
  const b = CYCLE.samples[Math.min(CYCLE.samples.length - 1, i + 8)].p;
  const tl = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1;
  const t: V3 = [(b[0] - a[0]) / tl, (b[1] - a[1]) / tl, (b[2] - a[2]) / tl];
  const h = Math.hypot(t[0], t[1]) || 1;
  const lat: V3 = [-t[1] / h, t[0] / h, 0];
  const up: V3 = [lat[1] * t[2] - lat[2] * t[1], lat[2] * t[0] - lat[0] * t[2], lat[0] * t[1] - lat[1] * t[0]];
  const phi = (2 * Math.PI * TURNS * DIST[i]) / DIST[DIST.length - 1];
  const out: { at: [number, number]; alpha: number }[] = [];
  for (const [off, side] of [
    [0, 0.42],
    [Math.PI, -0.42],
  ]) {
    const q = phi + off;
    const r = RAMP.ball;
    const cl = Math.cos(side);
    const v: V3 = [
      r * (cl * (Math.sin(q) * t[0] + Math.cos(q) * up[0]) + Math.sin(side) * lat[0]),
      r * (cl * (Math.sin(q) * t[1] + Math.cos(q) * up[1]) + Math.sin(side) * lat[1]),
      r * (cl * (Math.sin(q) * t[2] + Math.cos(q) * up[2]) + Math.sin(side) * lat[2]),
    ];
    const facing = (v[0] * VIEW[0] + v[1] * VIEW[1] + v[2] * VIEW[2]) / r;
    if (facing <= 0.05) continue;
    out.push({ at: iso([c[0] + v[0], c[1] + v[1], c[2] + v[2]], P), alpha: Math.min(1, (facing - 0.05) * 3) });
  }
  return out;
}

export function ballAt(frame: number): { p: V3; phase: Phase; onJ: boolean; under: boolean; frame: number } {
  const f = ((frame % CYCLE_FRAMES) + CYCLE_FRAMES) % CYCLE_FRAMES;
  const x = (f / CYCLE_FRAMES) * (CYCLE.samples.length - 1);
  const i = Math.floor(x);
  const j = Math.min(CYCLE.samples.length - 1, i + 1);
  const t = x - i;
  const a = CYCLE.samples[i];
  const b = CYCLE.samples[j];
  const p: V3 = [a.p[0] + (b.p[0] - a.p[0]) * t, a.p[1] + (b.p[1] - a.p[1]) * t, a.p[2] + (b.p[2] - a.p[2]) * t];
  // in the air: under the plank once the centre drops below its top face
  const plankTop = RAMP.start[2] + (RAMP.start[0] - p[0]) * Math.tan((RAMP.slope * Math.PI) / 180) - RAMP.ball;
  return { p, phase: a.phase, onJ: a.phase === "chute" && a.s >= CHUTE_S[J_START], under: a.phase === "air" && p[2] < plankTop + RAMP.ball * 0.2, frame };
}

const R = sphereRadius(P, RAMP.ball);

const Body: React.FC<MachineProps> = ({ frame, look }) => {
  // the two balls are half a cycle apart
  const balls = [ballAt(frame), ballAt(frame + CYCLE_FRAMES / 2)];
  const draw = (where: (b: (typeof balls)[number]) => boolean) =>
    balls.filter(where).map((b, i) => (
      <g key={i}>
        <Ball at={iso(b.p, P)} r={R} gradient="mr-ball" look={look} />
        {marks(b.frame, b.p).map((m, k) => (
          <circle key={k} cx={m.at[0]} cy={m.at[1]} r={R * 0.16} fill={look.name === "blueprint" ? look.inkSoft : "#16181B"} opacity={0.75 * m.alpha} />
        ))}
      </g>
    ));
  return (
    <>
      <BallDefs look={look} id="mr-ball" />
      <Static html={parts.base} />
      <Static html={parts.lodestone} />
      <Static html={parts.topPost} />
      <Static html={parts.rampPosts} />
      <Static html={parts.chute} />
      {draw((b) => b.phase === "chute" && !b.onJ)}
      {draw((b) => b.under)}
      <Static html={parts.rampFar} />
      {draw((b) => b.phase === "air" && !b.under)}
      <Static html={parts.rampNear} />
      <Static html={parts.jcurl} />
      {draw((b) => b.onJ)}
      {draw((b) => b.phase === "ramp")}
    </>
  );
};

export const magnet: MachineDef = { id: "magnet", P, shadows, grid, Body };
