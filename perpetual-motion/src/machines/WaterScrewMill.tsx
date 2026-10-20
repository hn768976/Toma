import React from "react";
import { P, parts, shadows, grid } from "../generated/watermill.ts";
import { MILL as S, G2_CENTRE, LANTERN_T, SCREW_FRAME, millAngles, screwAt, screwPoint } from "./watermill.spec.ts";
import { faceOf, faceX, iso, polyPath, rot2, type Vec2 } from "../lib/iso.ts";
import { Planar, Static, type PlanarItem } from "../lib/Planar.tsx";
import { FallingStream, FlowDashes, Ripples, rippleSeeds, worldPath } from "../lib/water.tsx";
import { hull, type V3 } from "../lib/curve.ts";
import { LOOP } from "../lib/camera.ts";
import { LINE } from "../lib/look.ts";
import type { MachineDef, MachineProps } from "../lib/Stage.tsx";

const K = P.scale * Math.sqrt(1.6);
const W = S.wheel;
const WHEEL = faceX(W.centre);
const G1 = faceX([S.g1.x, W.centre[1], W.centre[2]]);
const G2 = faceX(G2_CENTRE);
const CROWN = faceX([S.crown.x, W.centre[1], W.centre[2]]);
const DRESS = faceX([S.stone.x1, G2_CENTRE[1], G2_CENTRE[2]]);
const LANTERN = faceOf(screwPoint(LANTERN_T), SCREW_FRAME.e1, SCREW_FRAME.e2);
const VIEW: V3 = [Math.cos(Math.PI / 4) * Math.cos(Math.PI / 6), Math.sin(Math.PI / 4) * Math.cos(Math.PI / 6), Math.sin(Math.PI / 6)];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// ---- water in the buckets ------------------------------------------------------
// Each bucket's cavity is fixed to the wheel. Its water is the cavity cut by a
// level surface; the volume it holds is what the inflow gave it, capped by the
// lowest point of its mouth, so buckets fill under the launder and spill as
// they tip near the bottom, all from the wheel angle alone.

const STEP = 360 / W.buckets;
const LEAN = 15;
function cavity(k: number): Vec2[] {
  const a0 = k * STEP;
  const a1 = a0 + STEP;
  const pts: Vec2[] = [];
  const at = (r: number, a: number) => rot2([r, 0], a);
  pts.push(at(W.sole, a0), at(W.outer - 0.6, a0 + LEAN));
  for (let i = 1; i < 8; i++) pts.push(at(W.outer - 0.6, a0 + LEAN + (STEP * i) / 8));
  pts.push(at(W.outer - 0.6, a1 + LEAN), at(W.sole, a1));
  for (let i = 7; i > 0; i--) pts.push(at(W.sole, a0 + (STEP * i) / 8));
  return pts;
}
const area = (pts: Vec2[]) => {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2;
};
/** the part of a polygon below a level (y down: y ≥ level) */
function below(pts: Vec2[], level: number): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const ia = a[1] >= level;
    const ib = b[1] >= level;
    if (ia) out.push(a);
    if (ia !== ib) {
      const t = (level - a[1]) / (b[1] - a[1]);
      out.push([a[0] + (b[0] - a[0]) * t, level]);
    }
  }
  return out;
}
const CAVITY = Array.from({ length: W.buckets }, (_, k) => cavity(k));
const FULL = area(CAVITY[0]) * 0.62;

function bucketWater(wheel: number): string {
  const paths: string[] = [];
  for (let k = 0; k < W.buckets; k++) {
    const pts = CAVITY[k].map((p) => rot2(p, wheel));
    const mid = k * STEP + STEP / 2 + LEAN / 2 + wheel;
    // s: degrees past the top, in the direction the wheel turns (anticlockwise)
    const s = (((-(mid + 90)) % 360) + 360) % 360;
    const want = s < 200 ? FULL * Math.min(1, Math.max(0, (s - 4) / 40)) : 0;
    if (want <= 0) continue;
    // the mouth: the outer arc; water cannot stand above its lowest point
    const mouth = pts.slice(1, 10);
    const lip = Math.max(...mouth.map((p) => p[1]));
    const ys = pts.map((p) => p[1]);
    const bottom = Math.max(...ys);
    if (lip >= bottom) continue;
    const cap = area(below(pts, lip));
    let level = lip;
    if (want < cap) {
      let lo = lip;
      let hi = bottom;
      for (let i = 0; i < 30; i++) {
        const m = (lo + hi) / 2;
        if (area(below(pts, m)) > want) lo = m;
        else hi = m;
      }
      level = lo;
    }
    const water = below(pts, level);
    if (water.length > 2 && area(water) > 1) paths.push(`<path class="fp m-water" d="${polyPath(water)}"/>`);
  }
  return paths.join("");
}

// ---- the screw ---------------------------------------------------------------------
const SC = S.screw;
const DOWN = 90; // in the screw's frame, angle 90° points straight down its cross-section
/** the flight's angle at distance t along the axis: ψ − 360·t/pitch */
const flightAngle = (t: number, psi: number) => psi - (360 * t) / SC.pitch;

// light from the upper left, as the kit lights its solids
const LIGHT: V3 = (() => {
  const l: V3 = [-0.55, 0.25, 0.8];
  const n = Math.hypot(l[0], l[1], l[2]);
  return [l[0] / n, l[1] / n, l[2] / n];
})();

/**
 * The helical flight as small quads between the shaft and the flight's edge,
 * each shaded by its own surface normal, split into the quads behind the shaft
 * (drawn before it) and those in front (after it), each list far to near.
 */
function flights(psi: number) {
  const step = 0.7;
  const rings = 3;
  const quads: { d: string; depth: number; tone: number; front: boolean }[] = [];
  const edges: { back: Vec2[][]; front: Vec2[][] } = { back: [], front: [] };
  let run: Vec2[] = [];
  let runFront: boolean | null = null;
  const dadt = (-2 * Math.PI) / SC.pitch;
  const { a: ax, e1, e2 } = SCREW_FRAME;
  for (let t = SC.from + 2.5; t < SC.to - 0.5; t += step) {
    const a0 = flightAngle(t, psi);
    const a1 = flightAngle(t + step, psi);
    const rad = (a0 * Math.PI) / 180;
    const ur: V3 = [Math.cos(rad) * e1[0] + Math.sin(rad) * e2[0], Math.cos(rad) * e1[1] + Math.sin(rad) * e2[1], Math.cos(rad) * e1[2] + Math.sin(rad) * e2[2]];
    const ut: V3 = [-Math.sin(rad) * e1[0] + Math.cos(rad) * e2[0], -Math.sin(rad) * e1[1] + Math.cos(rad) * e2[1], -Math.sin(rad) * e1[2] + Math.cos(rad) * e2[2]];
    const front = dot(ur, VIEW) > 0;
    for (let k = 0; k < rings; k++) {
      const r0 = SC.shaft + ((SC.flight - SC.shaft) * k) / rings;
      const r1 = SC.shaft + ((SC.flight - SC.shaft) * (k + 1)) / rings;
      const rm = (r0 + r1) / 2;
      // surface normal: ∂/∂r × ∂/∂t
      const dt: V3 = [ax[0] + rm * dadt * ut[0], ax[1] + rm * dadt * ut[1], ax[2] + rm * dadt * ut[2]];
      const n: V3 = [ur[1] * dt[2] - ur[2] * dt[1], ur[2] * dt[0] - ur[0] * dt[2], ur[0] * dt[1] - ur[1] * dt[0]];
      const nl = Math.hypot(n[0], n[1], n[2]);
      const lit = Math.abs(dot(n, LIGHT)) / nl;
      const tone = Math.min(3, Math.floor(lit * 4.2));
      const pts = [screwAt(t, r0, a0), screwAt(t, r1, a0), screwAt(t + step, r1, a1), screwAt(t + step, r0, a0 + (a1 - a0))];
      const c = screwAt(t + step / 2, rm, (a0 + a1) / 2);
      quads.push({ d: polyPath(pts.map((p) => iso(p, P))), depth: dot(c, VIEW), tone, front });
    }
    const edge = iso(screwAt(t, SC.flight, a0), P);
    if (runFront === null || runFront !== front) {
      if (run.length) {
        run.push(edge);
        (runFront ? edges.front : edges.back).push(run);
      }
      run = [edge];
      runFront = front;
    } else run.push(edge);
  }
  if (run.length > 1) (runFront ? edges.front : edges.back).push(run);
  const paint = (front: boolean) =>
    quads
      .filter((q) => q.front === front)
      .sort((a, b) => a.depth - b.depth)
      .map((q) => `<path class="iso-shade m-oak" data-shade="${q.tone}" d="${q.d}" style="stroke:var(--s${q.tone});stroke-width:1.2px"/>`)
      .join("");
  const lines = (list: Vec2[][]) => list.map((pts) => `<path class="fp-line m-oak" d="${polyPath(pts, false)}"/>`).join("");
  return { back: paint(false) + lines(edges.back), front: paint(true) + lines(edges.front) };
}

/** water pockets: each sits on the flight below it and rises one pitch per turn */
function pockets(psi: number) {
  const out: string[] = [];
  const kMin = Math.floor((psi - DOWN - (360 * (SC.to + SC.pitch)) / SC.pitch) / 360) - 1;
  const kMax = Math.ceil((psi - DOWN - (360 * (SC.from - SC.pitch)) / SC.pitch) / 360) + 1;
  for (let k = kMin; k <= kMax; k++) {
    const tk = ((psi - DOWN - 360 * k) * SC.pitch) / 360;
    const t0 = Math.max(SC.from + 1, tk + 0.8);
    const t1 = Math.min(SC.to - 2, tk + SC.pitch * 0.5);
    if (t1 - t0 < 1.5) continue;
    const pts: Vec2[] = [];
    for (let t = t0; t <= t1 + 1e-6; t += (t1 - t0) / 6) {
      for (const a of [DOWN - 58, DOWN - 30, DOWN, DOWN + 30, DOWN + 58]) pts.push(iso(screwAt(t, SC.flight - 1.2, a), P));
      pts.push(iso(screwAt(t, SC.shaft + 2.5, DOWN), P));
    }
    const d = polyPath(hull(pts));
    // the pocket's level surface catches the light along its upper edge
    const hl = polyPath([t0 + 1, (t0 + t1) / 2, t1 - 1].map((t) => iso(screwAt(t, SC.flight - 2.4, DOWN - 52), P)), false);
    out.push(`<path class="water" d="${d}"/><path class="water-edge" d="${d}"/><path class="water-hl" style="stroke-width:5px;opacity:.55" d="${hl}"/>`);
  }
  return out.join("");
}

// ---- water paths for flow dashes --------------------------------------------------
const L = S.launder;
const LAUNDER_FLOW = worldPath(P, [
  [L.outletX, L.y, L.z - 3.4],
  [0, L.y, L.z - 3.4],
  [0, L.endY - 1, L.z - 3.4],
]);
const RACE_FLOW = worldPath(P, [
  [0, 10, S.basinWater],
  [0, 72, S.basinWater],
  [S.screw.x - 8, 72, S.basinWater],
]);
const RIPPLE_EVERY = 12;
const TANK_SEEDS = rippleSeeds(1618, RIPPLE_EVERY);

const Body: React.FC<MachineProps> = ({ frame, look }) => {
  const ang = millAngles(frame, LOOP);
  const wheelTurn = `rotate(${ang.wheel.toFixed(4)})`;
  const water = bucketWater(ang.wheel);
  const fl = flights(ang.screw);
  const sideWheel = W.width / 2;
  const pinItems = (near: boolean): PlanarItem[] =>
    Array.from({ length: S.lantern.pins }, (_, i) => i)
      .filter((i) => {
        const a = ang.screw + (360 / S.lantern.pins) * i;
        const p = screwAt(LANTERN_T, 1, a);
        const c = screwPoint(LANTERN_T);
        return (dot([p[0] - c[0], p[1] - c[1], p[2] - c[2]], VIEW) > 0) === near;
      })
      .map((i) => ({ html: `<circle class="fp dark m-iron" r="1.3"/>`, local: `rotate(${(ang.screw + (360 / S.lantern.pins) * i).toFixed(4)}) translate(${S.lantern.r} 0)`, key: `p${i}` }));
  const top = screwPoint(SC.to);
  return (
    <>
      <Static html={parts.base} />
      <Ripples P={P} centre={[top[0], top[1] - 2, S.tank.level]} frame={frame} every={RIPPLE_EVERY} life={60} maxRadius={12} seeds={TANK_SEEDS} color={look.waterLight} width={LINE} />
      <Static html={parts.launderA} />
      <Static html={parts.outlet} />
      <FlowDashes d={LAUNDER_FLOW} frame={frame} dash={14} gap={30} period={20} width={6} color={look.waterLight} opacity={0.85} />
      <Static html={parts.basinBack} />
      <FlowDashes d={RACE_FLOW} frame={frame} dash={18} gap={40} period={30} width={6} color={look.waterLight} opacity={0.7} />
      <Static html={parts.trestleBack} />
      <Static html={parts.axleBack} />
      <Planar P={P} face={WHEEL} along={[-sideWheel, -sideWheel + W.shroud]} items={[{ html: parts.shroud, local: wheelTurn, key: "s" }]} />
      <Planar
        P={P}
        face={WHEEL}
        along={[-sideWheel + W.shroud, sideWheel - W.shroud]}
        items={[
          { html: parts.buckets, local: wheelTurn, key: "b" },
          { html: water, local: "", key: "w" },
        ]}
      />
      <Planar P={P} face={WHEEL} along={[sideWheel - W.shroud, sideWheel]} items={[{ html: parts.shroud, local: wheelTurn, key: "s" }]} />
      {/* water spilling from the tipping buckets into the pit */}
      <FallingStream P={P} top={[0, 33, W.centre[2] - 33]} drop={W.centre[2] - 33 - S.basinWater} radius={1.6} v0={40} frame={frame} spacing={4} drift={[0, 0.12]} look={look} scale={K} />
      <Static html={parts.pitWall} />
      <Static html={parts.axleMid} />
      <Static html={parts.trestleFront} />
      <Planar P={P} face={G2} along={[-S.g2.width / 2, S.g2.width / 2]} items={[{ html: parts.g2, local: `rotate(${ang.g2.toFixed(4)})`, key: "g2" }]} />
      <Planar P={P} face={G1} along={[-S.g1.width / 2, S.g1.width / 2]} items={[{ html: parts.g1, local: wheelTurn, key: "g1" }]} />
      <Static html={parts.millstone} />
      <Planar P={P} face={DRESS} along={[-0.2, 0.4]} items={[{ html: parts.dress, local: `rotate(${ang.g2.toFixed(4)})`, key: "d" }]} copies={2} />
      <Static html={parts.farPost} />
      <Planar P={P} face={CROWN} along={[-S.crown.thick, 0]} items={[{ html: parts.crown, local: wheelTurn, key: "c" }]} />
      <Planar P={P} face={CROWN} along={[0, S.crown.pinLength]} items={[{ html: parts.crownPins, local: wheelTurn, key: "cp" }]} />
      <Static html={parts.troughBack} />
      <g dangerouslySetInnerHTML={{ __html: pockets(ang.screw) }} />
      <g dangerouslySetInnerHTML={{ __html: fl.back }} />
      <Static html={parts.screwShaft} />
      <g dangerouslySetInnerHTML={{ __html: fl.front }} />
      {/* the lantern's far disc and far pins, the drum, then the near pins and disc */}
      <Planar P={P} face={LANTERN} along={[S.lantern.half + 1.4, S.lantern.half]} items={[{ html: parts.lanternDisc, local: `rotate(${ang.screw.toFixed(4)})`, key: "ld" }]} />
      <Planar P={P} face={LANTERN} along={[S.lantern.half, -S.lantern.half]} items={pinItems(false)} />
      <Static html={parts.drum} />
      <Planar P={P} face={LANTERN} along={[S.lantern.half, -S.lantern.half]} items={pinItems(true)} />
      <Planar P={P} face={LANTERN} along={[-S.lantern.half, -S.lantern.half - 1.4]} items={[{ html: parts.lanternDisc, local: `rotate(${ang.screw.toFixed(4)})`, key: "ld2" }]} />
      <Static html={parts.troughFront} />
      {/* the screw's head pours into the tank */}
      <FallingStream P={P} top={[top[0], top[1] - 1, top[2] - 8.5]} drop={top[2] - 8.5 - S.tank.level} radius={2.6} v0={30} frame={frame} spacing={4} drift={[0, -0.18]} look={look} scale={K} />
      <Static html={parts.launderB} />
      {/* the launder pours onto the wheel's top, just left of centre */}
      <FallingStream P={P} top={[0, L.endY + 1.2, L.z - 4]} drop={L.z - 4 - (W.centre[2] + W.outer - 6)} radius={2.2} v0={45} frame={frame} spacing={3} drift={[0, 0.25]} look={look} scale={K} />
      <Static html={parts.basinFront} />
    </>
  );
};

export const watermill: MachineDef = { id: "watermill", P, shadows, grid, Body };
