// Offline settle for Look 4 (Pill Spill). Run once:  node scripts/settle-pills.mjs
// Drops ~900 tablets and capsules out of a tipped bottle with a small
// rigid-body solver (Rapier), lets them come to rest, and saves the resting
// layout to data/pill-pile.json. Nothing simulates at render time.
// Units: centimetres. Floor is y = 0.

import RAPIER from "@dimforge/rapier3d-compat";
import { writeFileSync, mkdirSync } from "node:fs";

const mulberry32 = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const rng = mulberry32(3534746);
const R = (a, b) => a + (b - a) * rng();

// ---- dimensions (real proportions) ----
const DIMS = {
  round: { radius: 0.45, thickness: 0.36, edge: 0.11 }, // 9 mm tablet
  oval: { length: 1.36, width: 0.66, thickness: 0.44, edge: 0.13 },
  capsule: { length: 1.8, radius: 0.3 }, // 18 mm capsule
};

// Bottle: lathe profile [axial x from base, outer radius]; lying on its side.
const BOTTLE = {
  bodyR: 3.0,
  wall: 0.22,
  profile: [
    [0.0, 0.0],
    [0.0, 2.6],
    [0.08, 2.86],
    [0.3, 2.98],
    [0.6, 3.0],
    [6.6, 3.0],
    [7.0, 2.97],
    [7.45, 2.82],
    [7.85, 2.55],
    [8.1, 2.38],
    [8.25, 2.32],
    [9.55, 2.32],
    [9.62, 2.36],
    [10.4, 2.36],
    [10.48, 2.3],
  ],
  innerR: 2.05, // mouth opening
};
const axisAngle = (36 * Math.PI) / 180; // mouth faces +z, turned left
const dir = [-Math.sin(axisAngle), 0, Math.cos(axisAngle)];
const L = 10.48;
const mouth = [0, BOTTLE.bodyR, 0];
const base = [mouth[0] - dir[0] * L, mouth[1], mouth[2] - dir[2] * L];

await RAPIER.init({});
const world = new RAPIER.World({ x: 0, y: -981, z: 0 });
world.timestep = 1 / 300;
world.lengthUnit = 1;
world.numSolverIterations = 8;

// floor
world.createCollider(RAPIER.ColliderDesc.cuboid(200, 1, 200).setTranslation(0, -1, 0).setFriction(0.6));

// bottle shell trimesh (outer surface + inner surface + lip ring), closed base
const SEG = 48;
const outer = BOTTLE.profile;
const inner = outer
  .filter(([x]) => x >= 0.25)
  .map(([x, r]) => [x, Math.max(0.3, Math.min(r - BOTTLE.wall, x > 8.0 ? BOTTLE.innerR : 9))]);
inner.unshift([0.25, 0]);
const verts = [];
const idx = [];
// local frame: axis = +X_local → world dir; up = +y
const side = [dir[2], 0, -dir[0]]; // perpendicular in xz
const toWorld = (x, r, ang) => {
  const cy = Math.cos(ang) * r,
    cz = Math.sin(ang) * r;
  return [
    base[0] + dir[0] * x + side[0] * cz,
    base[1] + cy,
    base[2] + dir[2] * x + side[2] * cz,
  ];
};
const ring = (prof, flip) => {
  const start = verts.length / 3;
  for (const [x, r] of prof)
    for (let s = 0; s < SEG; s++) verts.push(...toWorld(x, r, (s / SEG) * Math.PI * 2));
  for (let i = 0; i < prof.length - 1; i++)
    for (let s = 0; s < SEG; s++) {
      const a = start + i * SEG + s,
        b = start + i * SEG + ((s + 1) % SEG),
        c = start + (i + 1) * SEG + s,
        d = start + (i + 1) * SEG + ((s + 1) % SEG);
      if (flip) idx.push(a, c, b, b, c, d);
      else idx.push(a, b, c, b, d, c);
    }
  return start;
};
const o0 = ring(outer, false);
const i0 = ring(inner, true);
// lip: connect last outer ring to last inner ring
const oLast = o0 + (outer.length - 1) * SEG,
  iLast = i0 + (inner.length - 1) * SEG;
for (let s = 0; s < SEG; s++) {
  const a = oLast + s,
    b = oLast + ((s + 1) % SEG),
    c = iLast + s,
    d = iLast + ((s + 1) % SEG);
  idx.push(a, c, b, b, c, d);
}
world.createCollider(
  RAPIER.ColliderDesc.trimesh(new Float32Array(verts), new Uint32Array(idx)).setFriction(0.5),
);

// ---- pill shapes ----
const ovalHull = (() => {
  const d = DIMS.oval;
  const pts = [];
  const rings = 7;
  for (let k = 0; k <= rings; k++) {
    const v = (k / rings) * 2 - 1; // -1..1 through thickness
    const y = (v * d.thickness) / 2;
    const shrink = d.edge * (1 - Math.sqrt(1 - Math.min(1, Math.abs(v)) ** 2));
    for (let s = 0; s < 24; s++) {
      const a = (s / 24) * Math.PI * 2;
      pts.push(Math.cos(a) * (d.length / 2 - shrink), y, Math.sin(a) * (d.width / 2 - shrink));
    }
  }
  return new Float32Array(pts);
})();

const shapeFor = (t) => {
  if (t === "round") {
    const d = DIMS.round;
    return RAPIER.ColliderDesc.roundCylinder(d.thickness / 2 - d.edge, d.radius - d.edge, d.edge);
  }
  if (t === "oval") return RAPIER.ColliderDesc.convexHull(ovalHull);
  const d = DIMS.capsule;
  return RAPIER.ColliderDesc.capsule(d.length / 2 - d.radius, d.radius);
};

const randQuat = () => {
  const u1 = rng(),
    u2 = rng(),
    u3 = rng();
  const s1 = Math.sqrt(1 - u1),
    s2 = Math.sqrt(u1);
  return {
    x: s1 * Math.sin(2 * Math.PI * u2),
    y: s1 * Math.cos(2 * Math.PI * u2),
    z: s2 * Math.sin(2 * Math.PI * u3),
    w: s2 * Math.cos(2 * Math.PI * u3),
  };
};

const pickType = () => {
  const r = rng();
  return r < 0.56 ? "round" : r < 0.66 ? "oval" : "capsule";
};

// distance from point to bottle axis segment (to avoid spawning inside it)
const insideBottleHull = (p, pad) => {
  const v = [p[0] - base[0], p[1] - base[1], p[2] - base[2]];
  const x = v[0] * dir[0] + v[2] * dir[2];
  if (x < -pad || x > L + pad) return false;
  const q = [v[0] - dir[0] * x, v[1], v[2] - dir[2] * x];
  return Math.hypot(...q) < BOTTLE.bodyR + pad;
};

const bodies = [];
const spawn = (type, p, vel, inside = false) => {
  const q = randQuat();
  const rb = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(p[0], p[1], p[2])
      .setRotation(q)
      .setLinvel(vel[0], vel[1], vel[2])
      .setLinearDamping(0.4)
      .setAngularDamping(2.0)
      .setCcdEnabled(true),
  );
  world.createCollider(shapeFor(type).setFriction(0.85).setRestitution(0.02).setDensity(1.2), rb);
  bodies.push({ type, rb, variant: Math.floor(rng() * 1000), inside });
};

// pills lying inside the bottle (along its lower inner wall)
const INSIDE = 110;
for (let i = 0; i < INSIDE; i++) {
  const x = R(1.0, 9.0);
  const ang = Math.PI + R(-0.9, 0.9); // lower half (cy negative = down)
  const r = R(0.3, 1.6);
  const p = toWorld(x, r, ang);
  p[1] = Math.max(p[1], 0.7) + (i % 3) * 0.6;
  spawn(rng() < 0.85 ? "round" : pickType(), p, [0, 0, 0], true);
}

// the spill: a mound in front of the mouth, dense near the bottle
const CELL = 1.45;
const cells = [];
for (let gx = -16; gx <= 16; gx++)
  for (let gz = -6; gz <= 22; gz++)
    for (let gy = 0; gy < 9; gy++) {
      const p = [gx * CELL + R(-0.2, 0.2), 0.9 + gy * CELL, gz * CELL + R(-0.2, 0.2)];
      if (insideBottleHull(p, 1.2)) continue;
      // coordinates relative to mouth along/sideways
      const along = p[0] * dir[0] + p[2] * dir[2];
      const lat = p[0] * side[0] + p[2] * side[2];
      if (along < -2.0) continue;
      const dist = Math.hypot(Math.max(0, along) * 0.85, lat * 1.0);
      const mound = 9.5 * Math.exp(-dist / 5.0) + 1.2 * Math.exp(-dist / 11);
      const w = mound - p[1] * 0.7 + R(-0.7, 0.7);
      cells.push({ p, w });
    }
cells.sort((a, b) => b.w - a.w);
const OUTSIDE = 1010 - INSIDE;
for (let i = 0; i < OUTSIDE; i++) {
  const { p } = cells[i];
  const along = p[0] * dir[0] + p[2] * dir[2];
  const sp = 4 + 6 * rng();
  spawn(pickType(), p, [dir[0] * sp * Math.min(1, Math.max(0, 1 - along / 12)), -5, dir[2] * sp * 0.5]);
}

console.log("bodies", bodies.length, "cells", cells.length);
const t0 = Date.now();
const STEPS = 300 * 9;
for (let s = 0; s < STEPS; s++) {
  if (s === 300 * 5)
    for (const b of bodies) {
      b.rb.setLinearDamping(4);
      b.rb.setAngularDamping(6);
    }
  world.step();
  if (s % 300 === 0) {
    let maxV = 0;
    for (const b of bodies) {
      const v = b.rb.linvel();
      maxV = Math.max(maxV, Math.hypot(v.x, v.y, v.z));
    }
    console.log("t", (s / 300).toFixed(1), "maxV", maxV.toFixed(2), ((Date.now() - t0) / 1000).toFixed(1) + "s");
  }
}

const r4 = (x) => Math.round(x * 10000) / 10000;
// drop isolated strays (fewer than 2 neighbours within 1.8 cm)
const P = bodies.map((b) => b.rb.translation());
const isolated = new Set(
  bodies.filter((_, i) => P.filter((q, j) => j !== i && Math.hypot(q.x - P[i].x, q.y - P[i].y, q.z - P[i].z) < 1.8).length < 2),
);
const pills = [];
for (const b of bodies) {
  const p = b.rb.translation();
  const q = b.rb.rotation();
  if (isolated.has(b) || p.y < -0.5 || p.y > 5.2 || Math.hypot(p.x, p.z) > 60) continue;
  pills.push({
    t: b.type,
    p: [r4(p.x), r4(p.y), r4(p.z)],
    q: [r4(q.x), r4(q.y), r4(q.z), r4(q.w)],
    v: b.variant,
    ...(b.inside ? { in: 1 } : {}),
  });
}
mkdirSync("data", { recursive: true });
writeFileSync(
  "data/pill-pile.json",
  JSON.stringify({
    units: "cm",
    seed: 3534746,
    dims: DIMS,
    bottle: { base, dir, profile: BOTTLE.profile, wall: BOTTLE.wall, innerR: BOTTLE.innerR, length: L },
    pills,
  }),
);
console.log("saved", pills.length, "pills");
