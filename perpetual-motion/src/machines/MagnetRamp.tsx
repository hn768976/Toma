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

export function ballAt(frame: number): { p: V3; phase: Phase; onJ: boolean; under: boolean } {
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
  return { p, phase: a.phase, onJ: a.phase === "chute" && a.s >= CHUTE_S[J_START], under: a.phase === "air" && p[2] < plankTop + RAMP.ball * 0.2 };
}

const R = sphereRadius(P, RAMP.ball);

const Body: React.FC<MachineProps> = ({ frame, look }) => {
  // the two balls are half a cycle apart
  const balls = [ballAt(frame), ballAt(frame + CYCLE_FRAMES / 2)];
  const draw = (where: (b: (typeof balls)[number]) => boolean) =>
    balls.filter(where).map((b, i) => <Ball key={i} at={iso(b.p, P)} r={R} gradient="mr-ball" look={look} />);
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
