import { WHEEL as S } from "../../src/machines/overbalanced.spec.ts";
import { aFrame, k, fit, boxPoints, parts, solid, line, dots, plinth, beam, rod, collar, fpath, fp, fline, fdots, barPts, circlePath, annulusPath, roundRectPts, rot } from "./common.mjs";

const [cx, cy, cz] = S.centre;
const PLINTH = { x: -54, y: -122, w: 108, d: 244, r: 8 };

export function build() {
  const P = fit([...boxPoints(-54, 54, -122, 122, -6, 12), ...boxPoints(-44, 44, -118, 118, 0, cz + S.rimOuter + 22)], { fill: 0.6, fillH: 0.86, cy: 1080 + 10 });
  const out = parts();

  const frame = (X) => aFrame(P, X, cz);

  // ---- static, behind the wheel --------------------------------------------
  out.add("base", plinth(P, PLINTH, 12), { material: "oak" });
  out.add("trestleBack", frame(-S.trestleX), { material: "oak" });
  out.add("axleBack", rod(P, [-46, 0, cz], [-S.thickness / 2, 0, cz], 3.4, "iron") + collar(P, [-46, 0, cz], [1, 0, 0], 4.6, 2.4, "iron"), { material: "iron" });

  // ---- the wheel, flat in its own plane (centre at 0,0; y down) -------------
  const wheel = [];
  for (let i = 0; i < S.spokes; i++) {
    const a = (360 / S.spokes) * i + 15;
    const p0 = rot([S.hub - 3, 0], a);
    const p1 = rot([S.rimInner + 2, 0], a);
    wheel.push(fp(fpath(barPts(p0, p1, 6.4, 1)), "oak"));
    const q0 = rot([S.hub + 4, 0], a);
    const q1 = rot([S.rimInner - 4, 0], a);
    wheel.push(fline(fpath([q0, q1], false), "oak", "fp-faint"));
  }
  wheel.push(fp(annulusPath(S.rimInner, S.rimOuter), "oak"));
  wheel.push(fline(circlePath(0, 0, S.rimOuter - 1.6, 160), "iron", "fp-line"));
  wheel.push(fline(circlePath(0, 0, (S.rimInner + S.rimOuter) / 2 - 2.6, 144), "oak", "fp-faint"));
  // hinge lugs, rivets
  const lugs = [];
  const rivets = [];
  for (let i = 0; i < S.hammers; i++) {
    const a = (360 / S.hammers) * i;
    const lug = roundRectPts(-4.5, -4, 4.5, 4, 1.4).map((p) => rot(p, a)).map(([x, y]) => [x + S.hinge * Math.cos((a * Math.PI) / 180), y + S.hinge * Math.sin((a * Math.PI) / 180)]);
    lugs.push(fp(fpath(lug), "brass"));
    const m = a + 15;
    rivets.push(rot([S.rimInner + 2.6, 0], m), rot([S.rimOuter - 2.6, 0], m));
  }
  wheel.push(...lugs, fdots(rivets, 1.1, "iron"));
  wheel.push(fp(circlePath(0, 0, S.hub, 64), "brass"));
  wheel.push(fline(circlePath(0, 0, S.hub - 3.4, 48), "brass", "fp-faint"));
  wheel.push(fdots(Array.from({ length: 6 }, (_, i) => rot([S.hub - 1.7, 0], i * 60 + 30)), 1.1, "brass"));
  wheel.push(fp(circlePath(0, 0, 4.2, 32), "iron", "fp dark"));
  out.add("wheel", wheel.join(""), { kind: "flat", face: "x", along: [-S.thickness / 2, S.thickness / 2] });

  // pegs and stops stand out of the rim face to the hammer plane
  const pegs = [];
  for (let i = 0; i < S.hammers; i++) {
    const b = (360 / S.hammers) * i;
    const h = rot([S.hinge, 0], b);
    const at = (rel, side) => {
      const dir = rot([1, 0], b + rel);
      const n = rot(dir, side * 90);
      return [h[0] + dir[0] * 13 + n[0] * 4.1, h[1] + dir[1] * 13 + n[1] * 4.1];
    };
    const p = at(S.folded, -1);
    const q = at(S.out, 1);
    pegs.push(fp(circlePath(p[0], p[1], 2.4, 24), "brass"));
    pegs.push(fp(circlePath(q[0], q[1], 2.4, 24), "brass"));
    pegs.push(fp(circlePath(h[0], h[1], 1.6, 20), "iron", "fp dark"));
  }
  out.add("pegs", pegs.join(""), { kind: "flat", face: "x", along: [S.thickness / 2, S.hammerPlane + S.hammerThickness / 2] });

  out.add("axleMid", rod(P, [S.thickness / 2, 0, cz], [S.trestleX - 8, 0, cz], 3.4, "iron") + collar(P, [S.thickness / 2 + 1, 0, cz], [1, 0, 0], 7, 2, "brass"), { material: "iron" });

  // one hammer in its own coordinates: hinge at the origin, arm along +x
  const hammer = [];
  hammer.push(fp(fpath(barPts([-3, 0], [S.arm - 3, 0], 3.4, 1.7)), "iron", "fp dark"));
  hammer.push(fp(fpath(roundRectPts(S.arm - 5.5, -7, S.arm + 5.5, 7, 1.8)), "brass"));
  hammer.push(fline(fpath([[S.arm - 2.5, -7], [S.arm - 2.5, 7]], false), "brass", "fp-faint"));
  hammer.push(fline(fpath([[S.arm + 2.5, -7], [S.arm + 2.5, 7]], false), "brass", "fp-faint"));
  hammer.push(fp(circlePath(0, 0, 3.6, 28), "brass"));
  hammer.push(fdots([[0, 0]], 1.2, "iron"));
  out.add("hammer", hammer.join(""), { kind: "flat", face: "x", along: [S.hammerPlane - S.hammerThickness / 2, S.hammerPlane + S.hammerThickness / 2] });

  // ---- static, in front of the wheel ---------------------------------------
  out.add("trestleFront", frame(S.trestleX), { material: "oak" });
  out.add("axleFront", rod(P, [S.trestleX + 9, 0, cz], [S.trestleX + 14, 0, cz], 3.4, "iron") + collar(P, [S.trestleX + 14, 0, cz], [1, 0, 0], 4.6, 2.4, "iron") + dots([k.iso([S.trestleX + 15.3, 0, cz], P)], "iron", { size: 2.6, tone: "lo" }), { material: "iron" });

  return {
    id: "overbalanced",
    P,
    parts: out.list,
    shadows: [
      { x: 0, y: 0, rx: 62, ry: 130, strength: 0.9, power: 4, feather: 0.5 },
      { x: 0, y: 0, rx: 120, ry: 190, strength: 0.35, power: 2, feather: 0.9 },
    ],
    grid: 20,
    extra: { origin: S.centre },
  };
}
