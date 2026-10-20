import { FLASK as S, NECK } from "../../src/machines/flask.spec.ts";
import { hull } from "../../src/lib/curve.ts";
import { k, G, fit, boxPoints, parts, solid, dots, plinth, rod, collar, washer } from "./common.mjs";

const PLINTH = { x: -54, y: -54, w: 122, d: 108, r: 10 };
const [cx, cy, cz] = S.centre;

/** radius of the bowl's outer surface at height z */
function bowlR(z, inset = 0) {
  const R = S.radius - inset;
  if (z <= S.shoulder) return Math.sqrt(Math.max(0, R * R - (z - cz) ** 2));
  const rs = Math.sqrt(Math.max(0, R * R - (S.shoulder - cz) ** 2));
  const t = (z - S.shoulder) / (S.mouth - S.shoulder);
  return rs + (S.mouthRadius - inset - rs) * t;
}

const ringPts = (z, r, n = 96) => Array.from({ length: n }, (_, i) => [cx + r * Math.cos((i / n) * 2 * Math.PI), cy + r * Math.sin((i / n) * 2 * Math.PI), z]);
const hullPath = (P, pts3) => k.pathOf(hull(pts3.map((p) => k.iso(p, P))), true);

export function build() {
  const P = fit([...boxPoints(-54, 68, -54, 54, -6, 12), ...boxPoints(-34, 56, -34, 34, 0, 126)], { fill: 0.55, fillH: 0.88, cy: 1080 + 10 });
  const out = parts();
  const V = G.viewOf(P);
  const bottomZ = cz - S.radius;

  // ---- the stand ------------------------------------------------------------
  const legs = [90, 210, 330].map((a) => {
    const r = (a * Math.PI) / 180;
    return { a, top: [cx + 27.5 * Math.cos(r), cy + 27.5 * Math.sin(r), S.ringZ - 1], foot: [cx + 44 * Math.cos(r), cy + 44 * Math.sin(r), 12] };
  });
  const legSvg = (l) => rod(P, l.foot, l.top, 1.5, "brass") + solid(k.cylinder(l.foot[0], l.foot[1], 3.6, 12, 1.6, P, 28), "brass", { tone: "lo" });
  const far = legs.filter((l) => G.dot3(G.sub3(l.top, S.centre), V) < 0);
  const near = legs.filter((l) => G.dot3(G.sub3(l.top, S.centre), V) >= 0);
  const ring = washer(cx, cy, 25.6, 28.8, S.ringZ - 1, 2, P, "brass");
  // support for the neck's riser: a rod behind it, an arm and a clamp
  const support = [
    solid(k.cylinder(48.5, -15, 4, 12, 1.6, P, 28), "brass", { tone: "lo" }),
    rod(P, [48.5, -15, 13.6], [48.5, -15, 72], 1.4, "brass"),
    rod(P, [48.5, -15, 70], [48.5, -4.2, 70], 1.1, "brass"),
    collar(P, [48.5, -15, 72], [0, 0, 1], 2.4, 2, "brass"),
  ];
  out.add("base", plinth(P, PLINTH, 12) + support.join("") + far.map(legSvg).join("") + ring, { material: "oak" });

  // ---- glass behind the water -----------------------------------------------
  const outer = [];
  for (let z = bottomZ + 0.5; z <= S.mouth; z += 1.5) outer.push(...ringPts(z, bowlR(z), 72));
  const nipple = [...ringPts(bottomZ - 3, 3.6, 24), ...ringPts(bottomZ + 1, 3.6, 24)];
  const glassBack = [
    `<path class="glass" d="${hullPath(P, [...outer, ...nipple])}"/>`,
    // the far half of the mouth's rim, seen through the opening
    `<path class="glass" style="fill:none" d="${k.pathOf(ringPts(S.mouth, S.mouthRadius - S.lip, 96).map((p) => k.iso(p, P)), true)}"/>`,
  ];
  out.add("glassBack", glassBack.join(""), { material: "glass" });

  // ---- the water in the bowl: a sphere cut by the level, inset by the glass
  const wpts = [];
  for (let z = bottomZ + S.glass + 0.3; z <= S.water; z += 1) wpts.push(...ringPts(z, bowlR(z, S.glass), 72));
  wpts.push(...ringPts(S.water, bowlR(S.water, S.glass), 96));
  const body = hullPath(P, wpts);
  const surface = k.pathOf(ringPts(S.water, bowlR(S.water, S.glass), 128).map((p) => k.iso(p, P)), true);
  // deeper tone low in the bowl: the lower part of the body
  const deep = [];
  for (let z = bottomZ + S.glass + 0.3; z <= cz - 6; z += 1) deep.push(...ringPts(z, bowlR(z, S.glass + 0.2), 72));
  out.add("water", `<path class="water" d="${body}"/><path class="water-deep" opacity="0.55" d="${hullPath(P, deep)}"/><path class="water-edge" d="${body}"/>`, { material: "water" });
  out.add("surface", `<path class="water" style="filter:brightness(1.12)" d="${surface}"/><path class="water-edge" d="${surface}"/>`, { material: "water" });

  // ---- glass in front: highlights, the near rim, the outline ----------------
  const front = [];
  const sil = hullPath(P, [...outer, ...nipple]);
  front.push(`<path class="glass" style="fill:none" d="${sil}"/>`);
  const mouthOuter = ringPts(S.mouth, S.mouthRadius, 128).map((p) => k.iso(p, P));
  const mouthInner = ringPts(S.mouth, S.mouthRadius - S.lip, 128).map((p) => k.iso(p, P));
  front.push(`<path class="glass" style="fill:rgba(255,255,255,0.35)" fill-rule="evenodd" d="${k.pathOf(mouthOuter, true)}${k.pathOf(mouthInner.slice().reverse(), true)}"/>`);
  // highlight streaks on the upper left of the bowl
  const c2 = k.iso(S.centre, P);
  const rr = G.scaleOf(P) * S.radius;
  const arc = (r, a0, a1) => {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const a = ((a0 + ((a1 - a0) * i) / 24) * Math.PI) / 180;
      pts.push([c2[0] + r * Math.cos(a), c2[1] + r * Math.sin(a)]);
    }
    return k.pathOf(pts);
  };
  front.push(`<path class="glass-shine" style="stroke-width:16px;vector-effect:none" d="${arc(rr * 0.8, 196, 246)}"/>`);
  front.push(`<path class="glass-shine" style="stroke-width:9px;vector-effect:none;opacity:.7" d="${arc(rr * 0.8, 254, 266)}"/>`);
  front.push(`<path class="glass-shine" style="stroke-width:7px;vector-effect:none;opacity:.45" d="${arc(rr * 0.86, 20, 52)}"/>`);
  // the near half of the ring passes in front of the bowl
  const ringNear = `<clipPath id="flask-ring-near"><rect x="0" y="${k.iso([cx, cy, S.ringZ], P)[1].toFixed(1)}" width="3840" height="2160"/></clipPath><g clip-path="url(#flask-ring-near)">${ring}</g>`;
  out.add("glassFront", front.join("") + ringNear + near.map(legSvg).join(""), { material: "glass" });

  // bolts on the plinth around the stand's feet, for a little more to find
  // the outlet: a brass ferrule where the neck leaves the bowl's bottom
  out.add("outlet", collar(P, [cx, cy, bottomZ - 1.2], [0, 0, 1], 4.6, 3.4, "brass", { tone: "mid" }), { material: "brass" });
  out.add("feet", dots(legs.map((l) => k.iso([l.foot[0], l.foot[1], 13.6], P)), "brass", { size: 2.6, tone: "mid" }), { material: "brass" });

  return {
    id: "flask",
    P,
    parts: out.list,
    shadows: [
      { x: 6, y: 0, rx: 70, ry: 64, strength: 0.9, power: 4, feather: 0.5 },
      { x: 6, y: 0, rx: 110, ry: 100, strength: 0.32, power: 2, feather: 0.9 },
    ],
    grid: 16,
    extra: { neckPoints: NECK.length },
  };
}
