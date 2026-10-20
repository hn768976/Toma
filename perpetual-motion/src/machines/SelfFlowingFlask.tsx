import React from "react";
import { P, parts, shadows, grid } from "../generated/flask.ts";
import { FLASK as S, NECK } from "./flask.spec.ts";
import { iso, polyPath } from "../lib/iso.ts";
import { Static } from "../lib/Planar.tsx";
import { FallingStream, FlowDashes, Ripples, rippleSeeds } from "../lib/water.tsx";
import { LINE, type Look } from "../lib/look.ts";
import type { MachineDef, MachineProps } from "../lib/Stage.tsx";

const K = P.scale * Math.sqrt(1.6);
// the neck splits where it enters the mouth: the last stretch is inside the bowl
const TOP = NECK.reduce((best, p, i) => (p[2] > NECK[best][2] ? i : best), 0);
const ENTER = NECK.findIndex((p, i) => i > TOP && p[2] < S.mouth);
// the stretch under the bowl is behind the stand's near ring; the rest is in front
const UNDER = NECK.findIndex((p) => p[0] > 30);
const OUTER_UNDER = polyPath(NECK.slice(0, UNDER + 1).map((p) => iso(p, P)), false);
const OUTER = polyPath(NECK.slice(UNDER, ENTER + 1).map((p) => iso(p, P)), false);
const INNER = polyPath(NECK.slice(ENTER).map((p) => iso(p, P)), false);
const WHOLE = polyPath(NECK.map((p) => iso(p, P)), false);
const SURFACE_CLIP = (() => {
  const r = Math.sqrt(S.radius ** 2 - (S.water - S.centre[2]) ** 2) - S.glass;
  const pts = Array.from({ length: 96 }, (_, i) => iso([S.centre[0] + r * Math.cos((i / 96) * Math.PI * 2), S.centre[1] + r * Math.sin((i / 96) * Math.PI * 2), S.water], P));
  return polyPath(pts);
})();

/** Ripples: one ring every 10 frames (60 per loop), seeded variety that repeats each loop. */
const RIPPLE_EVERY = 10;
const SEEDS = rippleSeeds(1618, RIPPLE_EVERY);

/** A glass tube with water inside, as layered strokes in screen space. */
const GlassTube: React.FC<{ d: string; look: Look; frame: number }> = ({ d, look, frame }) => {
  const wOut = 2 * S.tubeOuter * K;
  const wIn = 2 * S.tubeInner * K;
  const ink = look.name === "blueprint" ? look.ink : look.materials.glass.edge;
  const glass = look.name === "blueprint" ? "#164B80" : "#DCE7E6";
  const ve = { vectorEffect: "none" as const };
  return (
    <g>
      <path d={d} fill="none" stroke={ink} strokeWidth={wOut + 2 * LINE} strokeLinecap="round" strokeLinejoin="round" style={ve} />
      <path d={d} fill="none" stroke={glass} strokeWidth={wOut} strokeLinecap="round" strokeLinejoin="round" style={ve} />
      <path d={d} fill="none" stroke={look.water} strokeWidth={wIn} strokeLinecap="round" strokeLinejoin="round" style={ve} />
      <g style={ve}>
        {/* the claimed flow: dashes climb the neck from the bowl to the spout, 30 frames per spacing */}
        <FlowDashes d={WHOLE} frame={frame} dash={wIn * 0.9} gap={wIn * 2.4} period={30} width={wIn * 0.42} color={look.waterLight} />
      </g>
      <path d={d} fill="none" stroke={look.glassShine} strokeWidth={wOut * 0.16} strokeLinecap="round" transform={`translate(${-wOut * 0.24} ${-wOut * 0.2})`} style={ve} opacity={0.8} />
    </g>
  );
};

const Body: React.FC<MachineProps> = ({ frame, look }) => {
  return (
    <>
      <defs>
        <clipPath id="flask-surface">
          <path d={SURFACE_CLIP} />
        </clipPath>
      </defs>
      <Static html={parts.base} />
      <Static html={parts.feet} />
      <Static html={parts.glassBack} />
      <Static html={parts.water} />
      <Static html={parts.surface} />
      <Ripples P={P} centre={[S.spout[0], S.spout[1], S.water]} frame={frame} every={RIPPLE_EVERY} life={80} maxRadius={17} seeds={SEEDS} color={look.waterLight} width={LINE * 1.1} clip="url(#flask-surface)" />
      <FallingStream P={P} top={[S.spout[0], S.spout[1], S.spout[2] - S.tubeOuter * 0.4]} drop={S.spout[2] - S.tubeOuter * 0.4 - S.water} radius={1.45} v0={22} frame={frame} spacing={4} look={look} scale={K} />
      <GlassTube d={INNER} look={look} frame={frame} />
      <GlassTube d={OUTER_UNDER} look={look} frame={frame} />
      <Static html={parts.outlet} />
      <Static html={parts.glassFront} />
      <GlassTube d={OUTER} look={look} frame={frame} />
    </>
  );
};

export const flask: MachineDef = { id: "flask", P, shadows, grid, Body };
