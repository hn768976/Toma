import React, { useMemo } from "react";
import { gearMesh, gearOutlinePath } from "../geometry/gear";
import type { GearDef, MeshGearDef } from "../layout";
import type { Theme } from "../theme";
import { SoftShadow } from "./defs";

type Frame = { w: number; h: number; u: number; theme: Theme };

/** Outlined gear. Constant angular velocity — easing on a gear reads as wrong. */
export const Gear: React.FC<Frame & { def: GearDef; id: string; rotation: number }> = ({
  def,
  id,
  rotation,
  w,
  h,
  u,
  theme,
}) => {
  const d = useMemo(
    () =>
      gearOutlinePath({
        teeth: def.teeth,
        rOuter: def.rOuter * u,
        rRoot: def.rRoot * u,
      }),
    [def.teeth, def.rOuter, def.rRoot, u],
  );

  const stroke = def.strokeWidth * u;

  return (
    <>
      {def.shadow ? (
        <defs>
          <SoftShadow
            id={id}
            dx={u * 0.012}
            dy={u * 0.016}
            blur={u * 0.011}
            color={theme.shadow}
            opacity={0.4}
          />
        </defs>
      ) : null}
      <g
        transform={`translate(${def.x * w} ${def.y * h})`}
        filter={def.shadow ? `url(#${id})` : undefined}
      >
        <g transform={`rotate(${rotation})`}>
          <path
            d={d}
            fill="none"
            stroke={theme.gearStroke}
            strokeOpacity={def.opacity}
            strokeWidth={stroke}
            strokeLinejoin="round"
          />
          {def.innerRing ? (
            <circle
              r={def.innerRing * u}
              fill="none"
              stroke={theme.gearStroke}
              strokeOpacity={def.opacity}
              strokeWidth={stroke * 0.8}
            />
          ) : null}
        </g>
        {def.hub ? (
          <>
            <circle r={def.hub * u} fill={theme.discBottom} />
            <circle
              r={def.hub * u}
              fill={`url(#hubSheen-${id})`}
              stroke={theme.discRing}
              strokeOpacity={theme.discRingOpacity}
              strokeWidth={stroke}
            />
          </>
        ) : null}
      </g>
      {def.hub ? (
        <defs>
          <linearGradient id={`hubSheen-${id}`} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stopColor={theme.discTop} />
            <stop offset="100%" stopColor={theme.discBottom} />
          </linearGradient>
        </defs>
      ) : null}
    </>
  );
};

/** The same procedural gear, drawn as a wireframe polygon mesh. */
export const MeshGear: React.FC<Frame & { def: MeshGearDef; rotation: number }> = ({
  def,
  rotation,
  w,
  h,
  u,
  theme,
}) => {
  const mesh = useMemo(
    () =>
      gearMesh(
        {
          teeth: def.teeth,
          rOuter: def.rOuter * u,
          rRoot: def.rRoot * u,
        },
        { seed: def.seed, neighbours: 4, rings: [1, 0.84, 0.68, 0.52, 0.36, 0.2] },
      ),
    [def.teeth, def.rOuter, def.rRoot, def.seed, u],
  );

  const stroke = def.strokeWidth * u;

  return (
    <g
      transform={`translate(${def.x * w} ${def.y * h})`}
      stroke={theme.gearStroke}
      strokeOpacity={def.opacity}
      strokeWidth={stroke}
    >
      <g transform={`rotate(${rotation})`}>
        {mesh.edges.map(([a, b], i) => (
          <line
            key={i}
            x1={mesh.points[a][0]}
            y1={mesh.points[a][1]}
            x2={mesh.points[b][0]}
            y2={mesh.points[b][1]}
          />
        ))}
        {mesh.points.map((p, i) => (
          <circle
            key={i}
            cx={p[0]}
            cy={p[1]}
            r={stroke * 1.1}
            fill={theme.gearStroke}
            fillOpacity={def.opacity}
            stroke="none"
          />
        ))}
      </g>
    </g>
  );
};
