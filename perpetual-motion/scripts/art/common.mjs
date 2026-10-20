// Shared helpers for the build-time art. Static parts are drawn with the
// pinned anatomy kit (vendor/anatomy/kit) in the machine's isometric camera.
// Parts that turn are drawn flat (in their own plane's coordinates) so the
// video can place them with `isoFace · rotate(θ)`.
import * as k from "../../vendor/anatomy/kit/iso-kit.mjs";
import * as G from "../../vendor/anatomy/kit/lathe.mjs";
import * as T from "../../vendor/anatomy/kit/tube.mjs";

export { k, G, T };

export const W = 3840;
export const H = 2160;

/** Fit the machine's bounding points so it fills `fill` of the frame, centred at (cx, cy). */
export function fit(points, { fill = 0.62, fillH = 0.8, cx = W / 2, cy = H / 2 } = {}) {
  const unit = { origin: [0, 0], scale: 1, azimuth: 45, elevation: 30 };
  const flat = points.map((p) => k.iso(p, unit));
  const xs = flat.map((p) => p[0]);
  const ys = flat.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = Math.min((W * fill) / (x1 - x0), (H * fillH) / (y1 - y0));
  return { origin: [cx - ((x0 + x1) / 2) * scale, cy - ((y0 + y1) / 2) * scale], scale, azimuth: 45, elevation: 30 };
}

export const boxPoints = (x0, x1, y0, y1, z0, z1) => {
  const out = [];
  for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) out.push([x, y, z]);
  return out;
};

/** A collector of named parts, in painter's order. */
export function parts() {
  const list = [];
  return {
    list,
    add(name, svg, { kind = "static", material, ...meta } = {}) {
      list.push({ name, svg: Array.isArray(svg) ? svg.join("") : svg, kind, material, meta });
    },
  };
}

export const solid = (paths, material, opts = {}) => k.solidSvg(paths, { className: `m-${material}`, ...opts });
export const line = (d, material, opts = {}) => `<g class="m-${material}">${k.lineSvg(d, opts)}</g>`;
export const dots = (points, material, opts = {}) => `<g class="m-${material}">${k.dotsSvg(points, opts)}</g>`;

/** Sort items far to near by a representative world point. */
export const byDepth = (items, P, at) => [...items].sort((a, b) => k.depthOf(at(a), P) - k.depthOf(at(b), P));

// ---- flat geometry (plane coordinates, y down) for parts that turn ----------

const f2 = (n) => (Math.round(n * 100) / 100).toString();
export const fpath = (pts, closed = true) => pts.map(([x, y], i) => `${i ? "L" : "M"}${f2(x)} ${f2(y)}`).join("") + (closed ? "Z" : "");
export const rot = ([x, y], deg) => {
  const r = (deg * Math.PI) / 180;
  return [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)];
};
export const circlePts = (cx, cy, r, steps = 96) => Array.from({ length: steps }, (_, i) => [cx + r * Math.cos((i / steps) * 2 * Math.PI), cy + r * Math.sin((i / steps) * 2 * Math.PI)]);
export const annulusPath = (r0, r1, steps = 144) => fpath(circlePts(0, 0, r1, steps)) + fpath(circlePts(0, 0, r0, steps).reverse());
export const circlePath = (cx, cy, r, steps = 64) => fpath(circlePts(cx, cy, r, steps));

/** A rounded rectangle from (x0, y0) to (x1, y1) with corner radius r. */
export function roundRectPts(x0, y0, x1, y1, r, steps = 6) {
  const out = [];
  const corners = [
    [x1 - r, y0 + r, -90],
    [x1 - r, y1 - r, 0],
    [x0 + r, y1 - r, 90],
    [x0 + r, y0 + r, 180],
  ];
  for (const [cx, cy, start] of corners) for (let i = 0; i <= steps; i++) {
    const a = ((start + (90 * i) / steps) * Math.PI) / 180;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

/** A bar between two flat points, `w` wide, with rounded ends of radius `round`. */
export function barPts(a, b, w, round = 0) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  return roundRectPts(0, -w / 2, len, w / 2, Math.min(round, w / 2)).map((p) => {
    const q = rot(p, ang);
    return [q[0] + a[0], q[1] + a[1]];
  });
}

export const fp = (d, material, cls = "fp") => `<path class="${cls} m-${material}" d="${d}" fill-rule="evenodd"/>`;
export const fline = (d, material, cls = "fp-line") => `<path class="${cls} m-${material}" d="${d}"/>`;
export const fdots = (points, r, material) => points.map(([x, y]) => `<circle class="fp-dot m-${material}" cx="${f2(x)}" cy="${f2(y)}" r="${r}"/>`).join("");

// ---- common furniture -------------------------------------------------------

/** An oak plinth on brass feet, with a groove and corner screws (anatomy's base-plate recipe). */
export function plinth(P, plan, height = 12, { feet = 22 } = {}) {
  const out = [];
  const corners = byDepth(k.corners(plan, feet), P, ([x, y]) => [x, y, 0]);
  for (const [x, y] of corners) {
    out.push(solid(k.cylinder(x, y, 7, -6, 2, P, 32), "brass", { tone: "lo" }));
    out.push(solid(k.cylinder(x, y, 5.2, -4, 4, P, 32), "brass", { tone: "mid" }));
  }
  const slab = k.slabOf(plan, 0, height, P, 8, 1.6);
  const groove = k.planOutline(k.insetPlan(plan, 5), height, P);
  const screws = k.corners(plan, 10).map(([x, y]) => k.iso([x, y, height], P));
  const rings = k.corners(plan, 10).map(([x, y]) => k.ring(x, y, 2.2, height, P, 20)).join("");
  out.push(solid(slab, "oak", { tone: "mid", inner: k.lineSvg(k.sideSeam(plan, height * 0.45, P, 8), { tone: "faint" }) }));
  out.push(line(groove, "oak", { tone: "faint" }));
  out.push(line(rings, "brass", { tone: "lo" }));
  out.push(dots(screws, "brass", { size: 2.2, tone: "mid" }));
  return out.join("");
}

/** A straight beam (any direction) as a rectangular prism between two world points. */
export function beam(P, a, b, w, d, material, opts = {}) {
  const axis = G.unit3(G.sub3(b, a));
  const len = G.len3(G.sub3(b, a));
  const up = Math.abs(axis[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
  const u = G.unit3(G.cross3(axis, up));
  const v = G.unit3(G.cross3(axis, u));
  const F = G.frameOf(a, axis, u, v);
  const poly = [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2],
  ];
  return solid(G.prismOf(F, poly, 0, len, P), material, { tone: "mid", ...opts });
}

/** A round rod or axle between two world points. */
export function rod(P, a, b, r, material, opts = {}) {
  const axis = G.unit3(G.sub3(b, a));
  const len = G.len3(G.sub3(b, a));
  const F = G.frameAlong(a, axis);
  return solid(G.disc(0, len, r, F, P), material, { tone: "mid", ...opts });
}

/** A collar / short disc centred on point c along axis. */
export function collar(P, c, axis, r, t, material, opts = {}) {
  const F = G.frameAlong(c, axis);
  return solid(G.disc(-t / 2, t / 2, r, F, P, { bevel: Math.min(0.8, t / 4) }), material, { tone: "mid", ...opts });
}

export const ball = (P, c, r, material, opts = {}) => solid(G.sphereOf(c, r, P), material, { tone: "mid", ...opts });

/** An oak A-frame trestle in the plane x = X carrying a brass pillow block at height cz. */
export function aFrame(P, X, cz, { spread = 66, top = cz - 12 } = {}) {
  const s = [];
  for (const y0 of [-spread - 8, spread - 6]) s.push(solid(k.slabOf({ x: X - 9, y: y0, w: 18, d: 14, r: 1.5 }, 12, 6, P, 3, 0.6), "oak", { tone: "mid" }));
  s.push(beam(P, [X, -spread, 15], [X, -9, top], 7, 9, "oak"));
  s.push(beam(P, [X, spread, 15], [X, 9, top], 7, 9, "oak"));
  const tie = 15 + (top - 15) * 0.36;
  const tieY = spread - (spread - 9) * 0.36;
  s.push(beam(P, [X, -tieY, tie], [X, tieY, tie], 6, 8, "oak"));
  s.push(dots([k.iso([X + 4.6, -tieY + 6, tie], P), k.iso([X + 4.6, tieY - 6, tie], P)], "iron", { size: 3.2, tone: "mid" }));
  s.push(solid(k.slabOf({ x: X - 6, y: -20, w: 12, d: 40, r: 1 }, top - 6, 7, P, 3, 0.6), "oak"));
  s.push(solid(k.slabOf({ x: X - 8, y: -13, w: 16, d: 26, r: 2 }, top + 1, 7, P, 4, 0.8), "brass", { tone: "mid" }));
  s.push(collar(P, [X, 0, cz], [1, 0, 0], 9, 16, "brass", { tone: "mid" }));
  s.push(collar(P, [X + 8.6, 0, cz], [1, 0, 0], 5.2, 1.2, "brass", { tone: "lo" }));
  s.push(dots([k.iso([X - 4, -9, top + 8], P), k.iso([X - 4, 9, top + 8], P), k.iso([X + 4, -9, top + 8], P), k.iso([X + 4, 9, top + 8], P)], "brass", { size: 3, tone: "mid" }));
  return s.join("");
}

/**
 * A flat washer on a vertical axis (a ring stand's ring). The kit's ringBand
 * fills the ring's whole hull and shades across the hole, so the ring is
 * built here from the kit's own cylinder with the hole cut out of its fill
 * and top (split-parts.mjs marks those evenodd), plus the far half of the
 * inner wall, which shows through the hole.
 */
export function washer(cx, cy, rIn, rOut, z, h, P, material, opts = {}) {
  const outer = k.cylinder(cx, cy, rOut, z, h, P, 96);
  const hole = k.ring(cx, cy, rIn, z + h, P, 96);
  const [vx, vy] = k.towardViewer(P);
  const far = [];
  const facing = Math.atan2(vy, vx);
  for (let i = 0; i <= 48; i++) {
    const a = facing + Math.PI / 2 + (i / 48) * Math.PI;
    far.push([cx + rIn * Math.cos(a), cy + rIn * Math.sin(a)]);
  }
  const wall = k.pathOf([...far.map(([x, y]) => k.iso([x, y, z + h], P)), ...far.reverse().map(([x, y]) => k.iso([x, y, z], P))], true);
  const inner = `<path class="iso-shade" data-shade="1" d="${wall}"/>` + k.lineSvg(hole, { tone: "hi" });
  return solid({ ...outer, fill: outer.fill + hole, top: outer.top + hole }, material, { tone: "mid", inner, ...opts });
}

/** A spur-gear outline (flat, centred), N teeth on pitch radius R. */
export function gearPts(N, R, { addendum = 0.9, dedendum = 1.15, tip = 0.32, root = 0.42 } = {}) {
  const m = (2 * R) / N;
  const rt = R + addendum * m;
  const rr = R - dedendum * m;
  const pts = [];
  const step = 360 / N;
  for (let i = 0; i < N; i++) {
    const a = i * step;
    const arc = (r, a0, a1, n) => {
      for (let j = 0; j <= n; j++) {
        const t = (((a0 + ((a1 - a0) * j) / n) * Math.PI) / 180);
        pts.push([r * Math.cos(t), r * Math.sin(t)]);
      }
    };
    arc(rr, a - (step * root) / 2 - step * 0.04, a - (step * tip) / 2 - step * 0.12, 2);
    arc(rt, a - (step * tip) / 2, a + (step * tip) / 2, 3);
    arc(rr, a + (step * tip) / 2 + step * 0.12, a + (step * root) / 2 + step * 0.04, 2);
  }
  return pts;
}

/** An open rectangular trough (bottom board and two side boards) along a straight run. */
export function troughRun(P, a, b, half, depth, material, { thick = 2.4, wallTop = 0 } = {}) {
  const axis = G.unit3(G.sub3(b, a));
  const lat = G.unit3([-axis[1], axis[0], 0]);
  const up = G.unit3(G.cross3(axis, lat));
  const off = (p, l, u) => G.add3(G.add3(p, G.mul3(lat, l)), G.mul3(up, u));
  const bottom = beam(P, off(a, 0, -depth - thick / 2), off(b, 0, -depth - thick / 2), half * 2 + thick * 2, thick, material, { tone: "mid" });
  const mid = (-depth - thick + wallTop) / 2;
  const tall = depth + thick + wallTop;
  const walls = [-1, 1].map((s) => beam(P, off(a, s * (half + thick / 2), mid), off(b, s * (half + thick / 2), mid), thick, tall, material, { tone: "mid" }));
  return { bottom, walls, lat, up };
}
