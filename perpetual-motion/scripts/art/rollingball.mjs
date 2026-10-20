import { ROLLING as S, channelPoints } from "../../src/machines/rollingball.spec.ts";
import { aFrame, k, fit, boxPoints, parts, dots, plinth, rod, collar, fpath, fp, fline, fdots, circlePath, annulusPath, rot } from "./common.mjs";

const [, , cz] = S.centre;
const PLINTH = { x: -54, y: -112, w: 108, d: 224, r: 8 };

/** Offset a polyline sideways by d (positive = left of travel in y-down coordinates). */
function offset(points, d) {
  return points.map((p, i) => {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(points.length - 1, i + 1)];
    const tx = b[0] - a[0];
    const ty = b[1] - a[1];
    const n = Math.hypot(tx, ty) || 1;
    return [p[0] + (ty / n) * d, p[1] - (tx / n) * d];
  });
}

export function build() {
  const P = fit([...boxPoints(-54, 54, -112, 112, -6, 12), ...boxPoints(-44, 44, -100, 100, 0, cz + S.rimOuter + 6)], { fill: 0.6, fillH: 0.86, cy: 1080 + 20 });
  const out = parts();

  out.add("base", plinth(P, PLINTH, 12), { material: "oak" });
  out.add("trestleBack", aFrame(P, -S.trestleX, cz), { material: "oak" });
  out.add("axleBack", rod(P, [-46, 0, cz], [S.web[0], 0, cz], 3.4, "iron") + collar(P, [-46, 0, cz], [1, 0, 0], 4.6, 2.4, "iron"), { material: "iron" });

  // the web: a solid oak disc the channels are fixed to
  const web = [];
  web.push(fp(circlePath(0, 0, S.rimOuter, 192), "oak", "fp dark"));
  for (let i = 0; i < 16; i++) {
    const a = i * 22.5 + 11.25;
    web.push(fline(fpath([rot([S.hub + 3, 0], a), rot([S.rimInner - 3, 0], a)], false), "oak", "fp-faint"));
  }
  out.add("web", web.join(""), { kind: "flat", face: "x", along: S.web });

  // channel walls, rim and hub stand in front of the web
  const front = [];
  const centre = channelPoints();
  const half = S.ballRadius + 1.3;
  for (let i = 0; i < S.channels; i++) {
    const b = (360 / S.channels) * i;
    const line = centre.map((p) => rot(p, b));
    for (const side of [-1, 1]) {
      const inner = offset(line, side * half);
      const outer = offset(line, side * (half + S.wall));
      front.push(fp(fpath([...inner, ...outer.reverse()]), "brass"));
    }
    // the channel floor: a faint centreline groove
    front.push(fline(fpath(line.slice(4, -4), false), "oak", "fp-faint"));
  }
  front.push(fp(annulusPath(S.rimInner, S.rimOuter, 192), "oak"));
  front.push(fline(circlePath(0, 0, S.rimOuter - 1.6, 192), "iron", "fp-line"));
  front.push(fdots(Array.from({ length: 16 }, (_, i) => rot([(S.rimInner + S.rimOuter) / 2, 0], i * 22.5 + 11.25)), 1.1, "iron"));
  front.push(fp(circlePath(0, 0, S.hub, 72), "brass"));
  front.push(fline(circlePath(0, 0, S.hub - 4, 48), "brass", "fp-faint"));
  front.push(fdots(Array.from({ length: 8 }, (_, i) => rot([S.hub - 2, 0], i * 45 + 22.5)), 1.1, "brass"));
  front.push(fp(circlePath(0, 0, 4.2, 32), "iron", "fp dark"));
  out.add("wheel", front.join(""), { kind: "flat", face: "x", along: S.walls });

  out.add("axleMid", rod(P, [S.walls[1], 0, cz], [S.trestleX - 8, 0, cz], 3.4, "iron") + collar(P, [S.walls[1] + 1, 0, cz], [1, 0, 0], 7, 2, "brass"), { material: "iron" });
  out.add("trestleFront", aFrame(P, S.trestleX, cz), { material: "oak" });
  out.add("axleFront", rod(P, [S.trestleX + 9, 0, cz], [S.trestleX + 14, 0, cz], 3.4, "iron") + collar(P, [S.trestleX + 14, 0, cz], [1, 0, 0], 4.6, 2.4, "iron") + dots([k.iso([S.trestleX + 15.3, 0, cz], P)], "iron", { size: 2.6, tone: "lo" }), { material: "iron" });

  return {
    id: "rollingball",
    P,
    parts: out.list,
    shadows: [
      { x: 0, y: 0, rx: 62, ry: 120, strength: 0.9, power: 4, feather: 0.5 },
      { x: 0, y: 0, rx: 120, ry: 180, strength: 0.35, power: 2, feather: 0.9 },
    ],
    grid: 20,
    extra: { origin: S.centre },
  };
}
