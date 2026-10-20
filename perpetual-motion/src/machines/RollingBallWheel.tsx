import React from "react";
import { P, parts, shadows, grid } from "../generated/rollingball.ts";
import { ROLLING as S, channelPoints } from "./rollingball.spec.ts";
import { faceX, flatToScreen, rot2, sphereRadius } from "../lib/iso.ts";
import { Planar, Static } from "../lib/Planar.tsx";
import { ballTable, channelOf } from "../lib/sim.ts";
import { LOOP } from "../lib/camera.ts";
import { Ball, BallDefs } from "../lib/Ball.tsx";
import type { MachineDef, MachineProps } from "../lib/Stage.tsx";

const FACE = faceX(S.centre);
export const CHANNEL = channelOf(channelPoints());
/** One full turn per loop (8 channel spacings): frame 600 equals frame 0. */
export const wheelAngle = (frame: number) => (360 * frame) / LOOP;
/** Arc position of a ball in its channel as a function of the channel's wheel angle (see sim.ts). */
export const BALL = ballTable({ channel: CHANNEL, ballRadius: S.ballRadius, period: LOOP / 30, damping: 1.5, restitution: 0.25 });

const Body: React.FC<MachineProps> = ({ frame, look }) => {
  const theta = wheelAngle(frame);
  const turn = `rotate(${theta.toFixed(4)})`;
  const r = sphereRadius(P, S.ballRadius);
  const balls = Array.from({ length: S.channels }, (_, i) => {
    const angle = (360 / S.channels) * i + theta;
    const s = BALL.at(angle);
    return flatToScreen(P, FACE, rot2(CHANNEL.point(s), angle), S.ballPlane);
  });
  return (
    <>
      <BallDefs look={look} id="rb-ball" />
      <Static html={parts.base} />
      <Static html={parts.trestleBack} />
      <Static html={parts.axleBack} />
      <Planar P={P} face={FACE} along={S.web} items={[{ html: parts.web, local: turn, key: "web" }]} />
      <Planar P={P} face={FACE} along={S.walls} items={[{ html: parts.wheel, local: turn, key: "wheel" }]} part="body" />
      {balls.map((at, i) => (
        <Ball key={i} at={at} r={r} gradient="rb-ball" look={look} />
      ))}
      {/* the walls' front edges overlap the balls: they sit in the groove */}
      <Planar P={P} face={FACE} along={S.walls} items={[{ html: parts.wheel, local: turn, key: "wheel" }]} part="front" />
      <Static html={parts.axleMid} />
      <Static html={parts.trestleFront} />
      <Static html={parts.axleFront} />
    </>
  );
};

export const rollingball: MachineDef = { id: "rollingball", P, shadows, grid, Body };
