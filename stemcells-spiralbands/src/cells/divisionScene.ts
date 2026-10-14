// Look 3 (Cell Division): one cell divides, the camera pulls back while
// the cells around it divide in turn.
//
// Per cell the order is fixed and physical:
//   1. nucleus split   (0-1 s): the nucleus stretches and becomes two,
//                               which move apart inside the round cell;
//   2. pinch           (1-3 s): the membrane elongates into a peanut and the
//                               waist closes to zero (smooth-union lathe);
//   3. separation      (3-4 s): two complete cells drift apart.
import * as THREE from "three";
import { clamp, easeInOut, lerp, mulberry32, range, smoothstep, TAU } from "../lib/random";
import { neckRadius, tipX } from "./lathe";
import { makeParticles, randomQuat, randomUnit } from "./motion";
import { NUCLEUS_SCALE, restCell } from "./restCell";
import type { CellSceneDef, CellState, SceneFrame } from "./types";

const FPS = 30;
const FOV = 38;
const RD = 0.8; // daughter radius (volume roughly conserved: 0.8^3 * 2 ~ 1)
const NUC_SPLIT = 1.0;
const PINCH = 2.0;
const SEP = 1.0;

type DivCell = {
  base: THREE.Vector3;
  radius: number;
  axisQuat: THREE.Quaternion; // local x = division axis
  divideAt: number | null; // seconds
  nucOffset: THREE.Vector3;
  nucQuat: THREE.Quaternion;
  drift: THREE.Vector3;
  ph: THREE.Vector3;
  wobPh: number;
  spinRate: number;
};

/** Division shape at time u (seconds since the division started). */
export const divisionShape = (u: number) => {
  const a = clamp(u / NUC_SPLIT, 0, 1);
  const p = clamp((u - NUC_SPLIT) / PINCH, 0, 1);
  const q = clamp((u - NUC_SPLIT - PINCH) / SEP, 0, 1);
  const ea = easeInOut(a);
  const ep = smoothstep(0, 1, p);
  const eq = easeInOut(q);
  const after = Math.max(0, u - NUC_SPLIT - PINCH - SEP);
  // Membrane: lobes separate (ease-out, so the cell elongates early), and
  // the blend radius k is solved so the waist follows a target that starts
  // as a soft furrow and closes to zero exactly at p = 1.
  const eo = 1 - (1 - p) * (1 - p);
  const d = RD * (lerp(eo, ep, 0.35) + 0.32 * eq) + 0.05 * after;
  let ra = lerp(1, RD, ep);
  const crease = Math.sqrt(Math.max(ra * ra - Math.min(d, ra) ** 2, 0));
  const ratio = Math.pow(Math.cos((Math.PI / 2) * Math.pow(p, 1.4)), 0.9);
  const target = Math.max(ra * ratio, crease * 1.12);
  let k = 0;
  if (p > 0 && p < 1 && crease > 1e-4) {
    let lo = 0;
    let hi = 2;
    for (let i = 0; i < 22; i++) {
      const m = (lo + hi) * 0.5;
      if (neckRadius({ d, ra, k: m }) < target) lo = m;
      else hi = m;
    }
    k = (lo + hi) * 0.5;
  }
  // smin inflates the union where the lobes overlap. Scale the whole shape
  // (which keeps its proportions) so the tips sit where the two plain
  // spheres would: the cell keeps its size while it elongates.
  let dd = d;
  if (k > 1e-6) {
    const f = (d + ra) / tipX({ d, ra, k });
    dd = d * f;
    ra *= f;
    k *= f;
  }
  // Nuclei: from one (two coincident copies) to two, then ride the lobes.
  const split = 0.4 * ea;
  const nx = lerp(split, dd, ep);
  const stretch = 0.32 * Math.sin(Math.PI * a) * (1 - ep);
  const scale = NUCLEUS_SCALE * lerp(1, 0.78, ea) * lerp(1, 1.05, eq);
  return { a, p, q, profile: { d: dd, ra, k }, nx, stretch, scale };
};

export type DivisionOptions = { seed: number; frames: number };

export const buildDivisionScene = (opt: DivisionOptions): CellSceneDef => {
  const rng = mulberry32(opt.seed);
  const cells: DivCell[] = [];
  const axisFor = (angle: number, tilt: number) =>
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, tilt, angle));
  const mk = (base: THREE.Vector3, radius: number, divideAt: number | null): DivCell => ({
    base,
    radius,
    axisQuat: axisFor(rng() * Math.PI, range(rng, -0.25, 0.25)),
    divideAt,
    nucOffset: randomUnit(rng).multiplyScalar(range(rng, 0.06, 0.14)),
    nucQuat: randomQuat(rng),
    drift: new THREE.Vector3(range(rng, -0.12, 0.12), range(rng, -0.12, 0.12), range(rng, -0.05, 0.05)),
    ph: new THREE.Vector3(rng() * TAU, rng() * TAU, rng() * TAU),
    wobPh: rng(),
    spinRate: range(rng, -0.04, 0.04),
  });
  // The first cell, centred, divides 1.5-5.5 s along a near-horizontal axis.
  const first = mk(new THREE.Vector3(0, 0, 0), 1, 1.5);
  first.axisQuat = axisFor(0.12, 0.04);
  first.nucOffset.set(0.08, 0.06, 0.1);
  cells.push(first);
  // Neighbours: Poisson-disk in a shallow volume around the first cell, in
  // a few depth layers like the reference. Spacing leaves room for the
  // daughters; the centre stays clear in front for the opening close-up.
  const SPACING = 2.45;
  let guard = 0;
  while (cells.length < 27 && guard++ < 80000) {
    const base = new THREE.Vector3(range(rng, -6.6, 6.6), range(rng, -3.9, 3.9), range(rng, -5.0, 1.0));
    // opening frame: nothing in front of or beside the first cell, only behind it
    if (Math.abs(base.x) < 4.3 && Math.abs(base.y) < 2.6 && base.z > -2.6) continue;
    let ok = true;
    for (const c of cells) {
      if (c.base.distanceTo(base) < SPACING) { ok = false; break; }
    }
    if (!ok) continue;
    cells.push(mk(base, range(rng, 0.9, 1.08), null));
  }
  // Division schedule: staggered from the inside out, two cells never divide.
  const others = cells.slice(1).sort((a, b) => Math.hypot(a.base.x, a.base.y) - Math.hypot(b.base.x, b.base.y));
  others.forEach((c, i) => {
    if (i === 7 || i === 18 || i === 24) return;
    const t = 4.0 + (i / (others.length - 1)) * 4.2 + range(rng, -0.35, 0.35);
    c.divideAt = Math.max(3.8, t);
  });
  // Give each cell's division axis a direction away from its nearest neighbour.
  cells.forEach((c) => {
    if (c === first) return;
    let best: DivCell | null = null;
    let bd = Infinity;
    for (const o of cells) {
      if (o === c) continue;
      const d = o.base.distanceTo(c.base);
      if (d < bd) { bd = d; best = o; }
    }
    if (best) {
      const toN = Math.atan2(best.base.y - c.base.y, best.base.x - c.base.x);
      c.axisQuat = axisFor(toN + Math.PI / 2 + range(rng, -0.5, 0.5), range(rng, -0.3, 0.3));
    }
  });

  const particles = makeParticles(rng, 200, { x: 11, y: 7, z0: 4, z1: -12 });
  const states: CellState[] = cells.map(() => restCell());
  const cam = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: FOV, focus: 8 };
  const xAxis = new THREE.Vector3(1, 0, 0);
  const spinQ = new THREE.Quaternion();

  const frameState = (frame: number): SceneFrame => {
    const sec = frame / FPS;
    cells.forEach((c, i) => {
      const s = states[i];
      s.pos.set(
        c.base.x + c.drift.x * sec + 0.08 * Math.sin(sec * 0.5 + c.ph.x),
        c.base.y + c.drift.y * sec + 0.08 * Math.sin(sec * 0.45 + c.ph.y),
        c.base.z + c.drift.z * sec,
      );
      // Slow roll about the division axis keeps the glass alive.
      s.quat.copy(c.axisQuat).multiply(spinQ.setFromAxisAngle(xAxis, c.spinRate * sec * TAU));
      s.radius = c.radius;
      s.wobPhase = (c.wobPh + sec / 12) % 1;
      const n0 = s.nuclei[0];
      const n1 = s.nuclei[1];
      n0.quat.copy(c.nucQuat);
      n1.quat.copy(c.nucQuat);
      if (c.divideAt === null || sec < c.divideAt) {
        s.profile = { d: 0, ra: 1, k: 0 };
        n0.offset.copy(c.nucOffset);
        n0.scale = NUCLEUS_SCALE;
        n0.stretch = 0;
        n1.visible = false;
        return;
      }
      const sh = divisionShape(sec - c.divideAt);
      s.profile = sh.profile;
      // Two copies start coincident (the second slightly smaller, so it is
      // hidden inside the first), then move apart along the axis.
      const off = c.nucOffset.clone().multiplyScalar(1 - sh.p);
      n0.offset.set(-sh.nx, 0, 0).add(off);
      n1.offset.set(sh.nx, 0, 0).add(off);
      n0.scale = sh.scale;
      n1.scale = sh.scale * lerp(0.97, 1, smoothstep(0, 0.25, sh.a));
      n0.stretch = sh.stretch;
      n1.stretch = sh.stretch;
      n1.visible = true;
    });
    // Camera: close on the first cell, eases back while it divides, pulls
    // back to the wide view, holds.
    const D =
      7.2 +
      0.9 * easeInOut((sec - 1.5) / 4.0) +
      1.6 * easeInOut((sec - 5.0) / 4.5) +
      0.3 * easeInOut((sec - 9) / 3);
    const ctr = states[0].pos;
    const wide = easeInOut((sec - 5) / 4.5);
    cam.target.set(lerp(ctr.x, 0.2, wide), lerp(ctr.y, -0.1, wide), lerp(0, -1.2, wide));
    cam.pos.set(cam.target.x + 0.25 * Math.sin(sec * 0.35), cam.target.y + 0.4 + 0.15 * Math.sin(sec * 0.3), D);
    cam.focus = cam.pos.distanceTo(new THREE.Vector3(cam.target.x, cam.target.y, lerp(0, -0.8, wide)));
    return {
      camera: cam,
      cells: states,
      phase: sec / (opt.frames / FPS),
      apertureScale: lerp(1.25, 1.7, wide),
    };
  };

  return {
    cellCount: cells.length,
    cellSeeds: cells.map((_, i) => 31 + i * 11),
    nucleusVariant: cells.map((_, i) => i % 4),
    hiDetail: cells.map((_, i) => i === 0),
    fragmentCount: cells.map(() => 0),
    particles,
    frameState,
  };
};
