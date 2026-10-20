import { MILL as S, SCREW_DIR, SCREW_FRAME, screwPoint, LANTERN_T, G2_CENTRE } from "../../src/machines/watermill.spec.ts";
import { aFrame, k, G, fit, boxPoints, parts, solid, line, dots, plinth, beam, rod, collar, fpath, fp, fline, fdots, barPts, circlePath, annulusPath, rot, gearPts, troughRun } from "./common.mjs";

const PLINTH = { x: -46, y: -162, w: 156, d: 258, r: 10 };
const [wx, wy, wz] = S.wheel.centre;

export function build() {
  const P = fit([...boxPoints(-46, 110, -162, 96, -6, 12), ...boxPoints(-30, 100, -160, 92, 0, 166)], { fill: 0.62, fillH: 0.84, cy: 1080 + 30 });
  const out = parts();
  const deg = Math.PI / 180;

  // ---- base, the tank tower and tank (furthest back) ------------------------
  const [tx, ty, tz] = S.tank.centre;
  const tower = [];
  const corners = [
    [tx - 17, ty - 17],
    [tx + 17, ty - 17],
    [tx - 17, ty + 17],
    [tx + 17, ty + 17],
  ];
  for (const [x, y] of corners) {
    tower.push(solid(k.slabOf({ x: x - 5, y: y - 5, w: 10, d: 10, r: 1 }, 12, 4, P, 3, 0.5), "oak", { tone: "mid" }));
    tower.push(beam(P, [x, y, 16], [x, y, tz - 6], 6, 6, "oak"));
  }
  for (const z of [44, 84]) {
    tower.push(beam(P, [tx - 17, ty + 17, z], [tx + 17, ty + 17, z], 4, 5, "oak"));
    tower.push(beam(P, [tx + 17, ty - 17, z], [tx + 17, ty + 17, z], 4, 5, "oak"));
  }
  tower.push(solid(k.slabOf({ x: tx - 24, y: ty - 24, w: 48, d: 48, r: 2 }, tz - 6, 6, P, 4, 0.8), "oak", { tone: "mid" }));
  // the tub: staves (a cylinder), iron hoops, a rim, the water inside
  const hoops = [tz + 5, tz + 15, tz + 25].map((z) => k.lineSvg(k.sideArc(tx, ty, S.tank.r, z, P, 48), { tone: "hi" })).join("");
  const staves = k.knurl(tx, ty, S.tank.r, tz, tz + S.tank.h, 28, P, 1.2);
  const tub = k.cylinder(tx, ty, S.tank.r, tz, S.tank.h, P, 96, 0.8);
  const inner = k.ring(tx, ty, S.tank.r - 2, tz + S.tank.h, P, 96);
  const water = k.ring(tx, ty, S.tank.r - 2.2, S.tank.level, P, 96);
  tower.push(solid({ ...tub, top: tub.top + inner }, "oak", { tone: "mid", inner: k.lineSvg(staves, { tone: "faint" }) + `<g class="m-iron">${hoops}</g>` }));
  // the far inner wall, then the water
  tower.push(`<path class="iso-shade m-oak" data-shade="0" style="fill:var(--s0)" d="${inner}"/>`);
  tower.push(`<path class="water" d="${water}"/><path class="water-edge" d="${water}"/>`);
  out.add("base", plinth(P, PLINTH, 12) + tower.join(""), { material: "oak" });

  // ---- the launder: an open oak channel from the tank, two straight runs ----
  const L = S.launder;
  const lz = L.z;
  const runA = troughRun(P, [L.outletX, L.y, lz], [-L.half, L.y, lz], L.half, 5, "oak");
  const runB = troughRun(P, [0, L.y - L.half, lz], [0, L.endY, lz], L.half, 5, "oak");
  const lposts = [];
  for (const [x, y] of [
    [26, L.y],
    [0, L.y],
    [0, -72],
  ]) {
    lposts.push(solid(k.slabOf({ x: x - 4.5, y: y - 4.5, w: 9, d: 9, r: 1 }, 12, 3, P, 3, 0.4), "oak", { tone: "mid" }));
    lposts.push(beam(P, [x, y, 15], [x, y, lz - 8], 5, 5, "oak"));
  }
  out.add("launderA", lposts.join("") + runA.walls[0] + runA.bottom + `<path class="water" d="${k.pathOf([[L.outletX, L.y - L.half + 0.5, lz - 3.4], [0, L.y - L.half + 0.5, lz - 3.4], [0, L.y + L.half - 0.5, lz - 3.4], [L.outletX, L.y + L.half - 0.5, lz - 3.4]].map((p) => k.iso(p, P)), true)}"/>` + runA.walls[1], { material: "oak" });
  // the outlet spout through the tub wall
  out.add("outlet", rod(P, [L.outletX + 6, L.y, lz - 1], [L.outletX - 2, L.y, lz - 1], 3, "brass"), { material: "brass" });

  // ---- the wheel pit and race (back walls and water) -------------------------
  const top = S.basinTop;
  const wtr = S.basinWater;
  const wall = (a, b, thick = 3) => beam(P, [a[0], a[1], (12 + top) / 2], [b[0], b[1], (12 + top) / 2], thick, top - 12, "oak", { tone: "mid" });
  const pit = S.pit;
  const race = S.race;
  const backWalls = [wall([pit.x0, pit.y0], [pit.x1, pit.y0]), wall([pit.x0 - 1.5, pit.y0], [pit.x0 - 1.5, pit.y1 + 1.5]), wall([pit.x1, race.y0], [race.x1, race.y0])];
  const waterPoly = [
    [pit.x0, pit.y0, wtr],
    [pit.x1, pit.y0, wtr],
    [pit.x1, race.y0, wtr],
    [race.x1, race.y0, wtr],
    [race.x1, race.y1, wtr],
    [pit.x0, pit.y1, wtr],
  ];
  out.add("basinBack", backWalls.join("") + `<path class="water" d="${k.pathOf(waterPoly.map((p) => k.iso(p, P)), true)}"/>`, { material: "oak" });

  // ---- back trestle and axle ---------------------------------------------------
  out.add("axleStub", rod(P, [S.axle.from, 0, wz], [S.trestles[0] - 8, 0, wz], S.axle.r, "iron") + collar(P, [S.axle.from, 0, wz], [1, 0, 0], 5, 2.4, "iron"), { material: "iron" });
  out.add("trestleBack", aFrame(P, S.trestles[0], wz, { spread: 46 }), { material: "oak" });
  out.add("axleBack", rod(P, [S.trestles[0] + 8, 0, wz], [-S.wheel.width / 2, 0, wz], S.axle.r, "iron"), { material: "iron" });

  // ---- the waterwheel, flat in its plane -------------------------------------
  const W = S.wheel;
  const shroud = [];
  for (let i = 0; i < 8; i++) {
    const a = i * 45 + 22.5;
    shroud.push(fp(fpath(barPts(rot([7, 0], a), rot([W.shroudIn + 1, 0], a), 5.2, 1)), "oak"));
  }
  shroud.push(fp(annulusPath(W.shroudIn, W.outer, 160), "oak"));
  shroud.push(fline(circlePath(0, 0, W.outer - 2.2, 160), "iron", "fp-line"));
  shroud.push(fdots(Array.from({ length: W.buckets }, (_, i) => rot([(W.shroudIn + W.outer) / 2, 0], i * (360 / W.buckets) + 11.25)), 1, "iron"));
  shroud.push(fp(circlePath(0, 0, 10, 48), "brass"));
  shroud.push(fdots(Array.from({ length: 6 }, (_, i) => rot([7.4, 0], i * 60)), 0.9, "brass"));
  shroud.push(fp(circlePath(0, 0, S.axle.r + 0.6, 24), "iron", "fp dark"));
  out.add("shroud", shroud.join(""), { kind: "flat", face: "x", origin: S.wheel.centre, along: [S.wheel.width / 2 - S.wheel.shroud, S.wheel.width / 2] });
  const buckets = [];
  buckets.push(fp(annulusPath(W.shroudIn, W.sole, 160), "oak", "fp dark"));
  for (let i = 0; i < W.buckets; i++) {
    const a = i * (360 / W.buckets);
    buckets.push(fp(fpath(barPts(rot([W.sole - 0.5, 0], a), rot([W.outer - 0.6, 0], a + 15), 1.6, 0.4)), "oak"));
  }
  out.add("buckets", buckets.join(""), { kind: "flat", face: "x", origin: S.wheel.centre, along: [-S.wheel.width / 2 + S.wheel.shroud, S.wheel.width / 2 - S.wheel.shroud] });

  // ---- axle on to the crown, front trestle with the tall post for G2 ---------
  out.add("axleMid", rod(P, [W.width / 2, 0, wz], [S.crown.x - S.crown.thick, 0, wz], S.axle.r, "iron") + collar(P, [W.width / 2 + 1, 0, wz], [1, 0, 0], 7, 2, "brass"), { material: "iron" });
  const g2 = G2_CENTRE;
  const front = [aFrame(P, S.trestles[1], wz, { spread: 46 })];
  front.push(beam(P, [S.trestles[1], g2[1], 15], [S.trestles[1], g2[1], g2[2] - 7], 6, 7, "oak"));
  front.push(solid(k.slabOf({ x: S.trestles[1] - 8, y: g2[1] - 9, w: 16, d: 18, r: 2 }, 12, 4, P, 3, 0.5), "oak", { tone: "mid" }));
  front.push(beam(P, [S.trestles[1], g2[1] + 3, wz + 6], [S.trestles[1], -12, wz + 6], 4, 5, "oak"));
  front.push(solid(k.slabOf({ x: S.trestles[1] - 7, y: g2[1] - 9, w: 14, d: 18, r: 2 }, g2[2] - 7, 6, P, 4, 0.8), "brass", { tone: "mid" }));
  front.push(collar(P, [S.trestles[1], g2[1], g2[2]], [1, 0, 0], 6.5, 14, "brass"));
  out.add("trestleFront", front.join(""), { material: "oak" });

  // ---- the spur pair, flat ---------------------------------------------------
  const g1 = [];
  g1.push(fp(fpath(gearPts(S.g1.teeth, S.g1.pitch)), "brass"));
  g1.push(fline(circlePath(0, 0, S.g1.pitch - 4.2, 96), "brass", "fp-faint"));
  for (let i = 0; i < 6; i++) g1.push(fp(fpath(barPts(rot([6, 0], i * 60), rot([S.g1.pitch - 5, 0], i * 60), 3.6, 0.8)), "brass", "fp dark"));
  g1.push(fp(circlePath(0, 0, 7.5, 40), "brass"));
  g1.push(fdots(Array.from({ length: 6 }, (_, i) => rot([5.6, 0], i * 60 + 30)), 0.8, "iron"));
  out.add("g1", g1.join(""), { kind: "flat", face: "x", origin: [S.g1.x, wy, wz], along: [-S.g1.width / 2, S.g1.width / 2] });
  const g2p = [];
  g2p.push(fp(fpath(gearPts(S.g2.teeth, S.g2.pitch)), "brass"));
  g2p.push(fline(circlePath(0, 0, S.g2.pitch - 3.8, 64), "brass", "fp-faint"));
  for (let i = 0; i < 4; i++) g2p.push(fp(circlePath(...rot([6.2, 0], i * 90 + 45), 1.6, 20), "brass", "fp dark"));
  g2p.push(fp(circlePath(0, 0, 3.6, 28), "iron", "fp dark"));
  out.add("g2", g2p.join(""), { kind: "flat", face: "x", origin: G2_CENTRE, along: [-S.g2.width / 2, S.g2.width / 2] });

  // ---- the millstone on G2's shaft, its far bearing post ----------------------
  const st = S.stone;
  const stoneF = G.frameOf([st.x0, g2[1], g2[2]], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
  const millstone = [];
  millstone.push(rod(P, [S.trestles[1] + 7, g2[1], g2[2]], [64, g2[1], g2[2]], 2.4, "iron"));
  millstone.push(solid(G.disc(0, st.x1 - st.x0, st.r, stoneF, P, { bevel: 1.2 }), "stone", { tone: "mid", inner: k.lineSvg(G.arcOf(stoneF, (st.x1 - st.x0) / 2, st.r, P), { tone: "faint" }) }));
  out.add("millstone", millstone.join(""), { material: "stone" });
  // the stone's dressing turns with it: furrows on its +x face
  const dress = [];
  dress.push(fp(circlePath(0, 0, st.r - 1.4, 96), "stone"));
  for (let i = 0; i < 10; i++) {
    const a = i * 36;
    const pts = [];
    for (let j = 0; j <= 10; j++) {
      const r = 5 + ((st.r - 3) - 5) * (j / 10);
      pts.push(rot([r, 0], a + 18 * (j / 10)));
    }
    dress.push(fline(fpath(pts, false), "stone", "fp-faint"));
  }
  dress.push(fp(circlePath(0, 0, 5, 32), "iron", "fp dark"));
  dress.push(fdots(Array.from({ length: 4 }, (_, i) => rot([3.4, 0], i * 90)), 0.8, "brass"));
  out.add("dress", dress.join(""), { kind: "flat", face: "x", origin: [st.x1, g2[1], g2[2]], along: [-0.4, 0.4] });
  const farPost = [];
  farPost.push(solid(k.slabOf({ x: 62 - 7, y: g2[1] - 8, w: 14, d: 16, r: 2 }, 12, 4, P, 3, 0.5), "oak", { tone: "mid" }));
  farPost.push(beam(P, [62, g2[1], 16], [62, g2[1], g2[2] - 6], 6, 7, "oak"));
  farPost.push(solid(k.slabOf({ x: 62 - 6, y: g2[1] - 8, w: 12, d: 16, r: 2 }, g2[2] - 6, 5, P, 4, 0.8), "brass", { tone: "mid" }));
  farPost.push(collar(P, [62, g2[1], g2[2]], [1, 0, 0], 5.5, 12, "brass"));
  farPost.push(collar(P, [66, g2[1], g2[2]], [1, 0, 0], 3.4, 2, "iron"));
  out.add("farPost", farPost.join(""), { material: "oak" });

  // ---- the crown wheel: a disc with 30 pins on its +x face --------------------
  const C = S.crown;
  const crown = [];
  crown.push(fp(circlePath(0, 0, C.disc, 128), "oak"));
  crown.push(fline(circlePath(0, 0, C.disc - 1.6, 128), "iron", "fp-line"));
  for (let i = 0; i < 6; i++) crown.push(fline(fpath([rot([6, 0], i * 60), rot([C.pitch - 4, 0], i * 60)], false), "oak", "fp-faint"));
  crown.push(fp(circlePath(0, 0, 6, 32), "brass"));
  out.add("crown", crown.join(""), { kind: "flat", face: "x", origin: [C.x, wy, wz], along: [-C.thick, 0] });
  out.add("crownPins", Array.from({ length: C.pins }, (_, i) => fp(circlePath(...rot([C.pitch, 0], (360 / C.pins) * i), 1.5, 16), "iron", "fp dark")).join(""), { kind: "flat", face: "x", origin: [C.x, wy, wz], along: [0, C.pinLength] });

  // ---- the lantern: two discs and ten pins round the screw ---------------------
  const Ln = S.lantern;
  const disc = [];
  disc.push(fp(annulusPath(3.2, Ln.r + 2, 96), "brass"));
  for (let i = 0; i < Ln.pins; i++) disc.push(fdots([rot([Ln.r, 0], (360 / Ln.pins) * i)], 1, "iron"));
  disc.push(fline(circlePath(0, 0, Ln.r - 3.2, 64), "brass", "fp-faint"));
  const lanternFace = { origin: screwPoint(LANTERN_T), u: SCREW_FRAME.e1, v: SCREW_FRAME.e2 };
  out.add("lanternDisc", disc.join(""), { kind: "flat", face: lanternFace, along: [Ln.half, Ln.half + 1.4] });
  out.add("lanternPins", Array.from({ length: Ln.pins }, (_, i) => fp(circlePath(...rot([Ln.r, 0], (360 / Ln.pins) * i), 1.3, 16), "iron", "fp dark")).join(""), { kind: "flat", face: lanternFace, along: [-Ln.half, Ln.half] });

  // ---- the screw's trough: an open channel under the flights, gapped at the lantern
  const sc = S.screw;
  const pieces = [
    [sc.from, LANTERN_T - Ln.half - 3],
    [LANTERN_T + Ln.half + 3, sc.to - 2],
  ];
  const troughBack = [];
  const troughFront = [];
  for (const [t0, t1] of pieces) {
    const tr = troughRun(P, screwPoint(t0), screwPoint(t1), sc.trough, sc.trough, "oak", { thick: 2, wallTop: -3.5 });
    // lat points +x (toward the viewer's right): walls[0] is the far (−x) wall
    troughBack.push(tr.walls[0], tr.bottom);
    troughFront.push(tr.walls[1]);
  }
  // trough legs: posts from the plinth to the trough's underside
  const legs = [];
  for (const t of [-70, 20, 80]) {
    const p = screwPoint(t);
    const under = [p[0], p[1] + 0.574 * (sc.trough + 3), p[2] - 0.819 * (sc.trough + 3)];
    legs.push(solid(k.slabOf({ x: p[0] - 6, y: under[1] - 5, w: 12, d: 10, r: 1 }, 12, 3, P, 3, 0.4), "oak", { tone: "mid" }));
    legs.push(beam(P, [p[0], under[1], 15], under, 5, 5, "oak"));
  }
  // an end board closes the trough's foot, under the water in the race
  const foot = screwPoint(sc.from);
  legs.push(beam(P, [foot[0] - sc.trough - 2, foot[1] + 0.574 * 1, foot[2] - 0.819 * 1], [foot[0] + sc.trough + 2, foot[1] + 0.574 * 1, foot[2] - 0.819 * 1], 2, sc.trough + 4, "oak"));
  out.add("troughBack", legs.join("") + troughBack.join(""), { material: "oak" });
  out.add("screwShaft", rod(P, screwPoint(sc.from - 3), screwPoint(sc.to + 2), sc.shaft, "iron") + collar(P, screwPoint(sc.to + 2), SCREW_DIR, 4, 2, "brass"), { material: "iron" });
  // the drum: a short closed casing over the flights where the lantern is fitted
  const drumF = G.frameOf(screwPoint(LANTERN_T), SCREW_DIR, SCREW_FRAME.e1, SCREW_FRAME.e2);
  const bands = [-sc.drumHalf + 1.2, 0, sc.drumHalf - 1.2].map((s) => k.lineSvg(G.arcOf(drumF, s, sc.drum, P), { tone: "hi" })).join("");
  out.add("drum", solid(G.disc(-sc.drumHalf, sc.drumHalf, sc.drum, drumF, P), "oak", { tone: "mid", inner: `<g class="m-iron">${bands}</g>` }), { material: "oak" });
  out.add("troughFront", troughFront.join(""), { material: "oak" });

  // ---- the launder's run over the wheel, and the basin's near walls -----------
  out.add("launderB", runB.walls[0] + runB.bottom + `<path class="water" d="${k.pathOf([[-L.half + 0.5, L.y, lz - 3.4], [L.half - 0.5, L.y, lz - 3.4], [L.half - 0.5, L.endY, lz - 3.4], [-L.half + 0.5, L.endY, lz - 3.4]].map((p) => k.iso(p, P)), true)}"/>` + runB.walls[1], { material: "oak" });
  const nearWalls = [wall([pit.x0 - 1.5, pit.y1 + 1.5], [race.x1 + 1.5, race.y1 + 1.5]), wall([race.x1 + 1.5, race.y0], [race.x1 + 1.5, race.y1 + 1.5])];
  out.add("pitWall", wall([pit.x1 + 1.5, pit.y0], [pit.x1 + 1.5, race.y0]), { material: "oak" });
  out.add("basinFront", nearWalls.join(""), { material: "oak" });

  return {
    id: "watermill",
    P,
    parts: out.list,
    shadows: [
      { x: 32, y: -28, rx: 92, ry: 135, strength: 0.85, power: 4, feather: 0.45 },
      { x: 32, y: -28, rx: 135, ry: 185, strength: 0.32, power: 2, feather: 0.9 },
    ],
    grid: 20,
    extra: {},
  };
}
