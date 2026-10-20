import React from "react";
import { P, parts, shadows, grid } from "../generated/overbalanced.ts";
import { WHEEL as S } from "./overbalanced.spec.ts";
import { faceX } from "../lib/iso.ts";
import { Planar, Static } from "../lib/Planar.tsx";
import { hammerTable } from "../lib/sim.ts";
import { LOOP } from "../lib/camera.ts";
import type { MachineDef, MachineProps } from "../lib/Stage.tsx";

const FACE = faceX(S.centre);
/** One full turn per 20 s loop: 12 hammer spacings, so frame 600 equals frame 0. */
export const wheelAngle = (frame: number) => (360 * frame) / LOOP;

/** Each hammer's relative arm angle as a function of its hinge position alone (see sim.ts). */
export const HAMMER = hammerTable({ R: S.hinge / 100, arm: (S.arm * 0.92) / 100, folded: S.folded, out: S.out, period: LOOP / 30, damping: 1.2, restitution: 0.3 });

const Body: React.FC<MachineProps> = ({ frame }) => {
  const theta = wheelAngle(frame);
  const hammers = Array.from({ length: S.hammers }, (_, i) => {
    const a = (360 / S.hammers) * i + theta;
    const phi = HAMMER.at(a);
    return { html: parts.hammer, local: `rotate(${a.toFixed(4)}) translate(${S.hinge} 0) rotate(${phi.toFixed(4)})`, key: `h${i}` };
  });
  const turn = `rotate(${theta.toFixed(4)})`;
  return (
    <>
      <Static html={parts.base} />
      <Static html={parts.trestleBack} />
      <Static html={parts.axleBack} />
      <Planar P={P} face={FACE} along={[-S.thickness / 2, S.thickness / 2]} items={[{ html: parts.wheel, local: turn, key: "wheel" }]} />
      <Planar P={P} face={FACE} along={[S.thickness / 2, S.hammerPlane + S.hammerThickness / 2]} items={[{ html: parts.pegs, local: turn, key: "pegs" }]} />
      <Static html={parts.axleMid} />
      <Planar P={P} face={FACE} along={[S.hammerPlane - S.hammerThickness / 2, S.hammerPlane + S.hammerThickness / 2]} items={hammers} />
      <Static html={parts.trestleFront} />
      <Static html={parts.axleFront} />
    </>
  );
};

export const overbalanced: MachineDef = { id: "overbalanced", P, shadows, grid, Body };
