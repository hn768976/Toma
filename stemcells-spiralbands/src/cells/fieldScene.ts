// Look 1 (Cell Field) and Look 2 (Hero Cell): dozens of glass cells
// floating at many depths, each on a closed path.
import * as THREE from "three";
import { clamp, easeInOut, mulberry32, range, TAU } from "../lib/random";
import { makeOrbit, makeParticles, makeSpin, orbitAt, randomQuat, randomUnit, spinAt, type Orbit, type Spin } from "./motion";
import { fragmentsAt, makeFragmentSeeds, NUCLEUS_SCALE, restCell, type FragmentSeed } from "./restCell";
import type { CellSceneDef, CellState, SceneFrame } from "./types";

type FieldCell = {
  base: THREE.Vector3;
  radius: number;
  orbit: Orbit;
  spin: Spin;
  nucOffset: THREE.Vector3;
  nucQuat: THREE.Quaternion;
  frags: FragmentSeed[];
  wobPh: number;
};

export type FieldOptions = {
  seed: number;
  loopFrames: number;
  fragments: boolean;
  hero: boolean;
};

const FOV = 38;
const FOCUS = 6.2;
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const ASPECT = 16 / 9;

// Hero camera: push from the origin to HERO_STOP, hold with a small orbit,
// pull back.
const HERO_POS = new THREE.Vector3(0.35, 0.15, -15);
const HERO_R = 1.4;
const HERO_DIST = HERO_R / (0.4 * TAN); // ~40% of the frame height
const HERO_STOP = HERO_POS.clone().add(new THREE.Vector3(-0.35, -0.15, HERO_DIST));

const distToSegment = (p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) => {
  const ab = b.clone().sub(a);
  const t = clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1);
  return p.distanceTo(a.clone().addScaledVector(ab, t));
};

export const buildFieldScene = (opt: FieldOptions): CellSceneDef => {
  const rng = mulberry32(opt.seed);
  const cells: FieldCell[] = [];
  const tryPlace = (base: THREE.Vector3, radius: number) => {
    for (const c of cells) {
      if (c.base.distanceTo(base) < (c.radius + radius) * 1.15 + 0.4) return false;
    }
    if (opt.hero) {
      const camSeg = distToSegment(base, new THREE.Vector3(0, 0, 0.5), HERO_STOP);
      if (camSeg < radius + 1.3) return false;
      const sight = distToSegment(base, HERO_STOP, HERO_POS);
      if (sight < radius + HERO_R * 0.9) return false;
      if (base.distanceTo(HERO_POS) < radius + HERO_R + 0.7) return false;
    }
    return true;
  };
  const makeCell = (base: THREE.Vector3, radius: number, orbitAmp: number): FieldCell => ({
    base,
    radius,
    orbit: makeOrbit(rng, orbitAmp, orbitAmp * 0.35),
    spin: makeSpin(rng, 0.45),
    nucOffset: randomUnit(rng).multiplyScalar(range(rng, 0.08, 0.2)),
    nucQuat: randomQuat(rng),
    frags: opt.fragments && rng() < 0.35 ? makeFragmentSeeds(rng, 3 + Math.floor(rng() * 4)) : [],
    wobPh: rng(),
  });

  if (opt.hero) {
    const h = makeCell(HERO_POS.clone(), HERO_R, 0.0);
    h.orbit = makeOrbit(rng, 0.12, 0.04);
    h.spin = makeSpin(rng, 0.25);
    h.nucOffset.set(0.1, 0.06, 0.12);
    cells.push(h);
  }
  // Hero version: a ring of neighbours at the hero's depth, so the end of
  // the push is a packed close-up like the reference.
  if (opt.hero) {
    let g2 = 0;
    let placed = 0;
    while (placed < 12 && g2++ < 8000) {
      const a = rng() * TAU;
      const rr = range(rng, 2.9, 6.5);
      const base = new THREE.Vector3(
        HERO_POS.x + Math.cos(a) * rr * 1.45,
        HERO_POS.y + Math.sin(a) * rr * 0.8,
        HERO_POS.z + range(rng, -2.5, 1.5),
      );
      const r = range(rng, 0.9, 1.35);
      if (!tryPlace(base, r)) continue;
      cells.push(makeCell(base, r, 0.25));
      placed++;
    }
  }
  // Near cells that sweep past the lens, very blurred.
  let guard = 0;
  let near = 0;
  while (near < 3 && guard++ < 5000) {
    const z = -range(rng, 2.6, 5.5);
    const hw = -z * TAN * ASPECT;
    const hh = -z * TAN;
    const base = new THREE.Vector3(range(rng, -hw, hw) * 1.1, range(rng, -hh, hh) * 1.1, z);
    const r = range(rng, 0.9, 1.4);
    if (Math.abs(base.x) < hw * 0.35 && Math.abs(base.y) < hh * 0.35) continue; // keep the centre open
    if (!tryPlace(base, r)) continue;
    cells.push(makeCell(base, r, 0.9));
    near++;
  }
  const total = opt.hero ? 52 : 55;
  guard = 0;
  while (cells.length < total && guard++ < 20000) {
    const u = rng();
    // a dozen big cells round the focus, the rest further back fading out
    const z = -(4.0 + 36 * Math.pow(u, 1.15));
    const hw = -z * TAN * ASPECT * 1.12;
    const hh = -z * TAN * 1.12;
    const base = new THREE.Vector3(range(rng, -hw, hw), range(rng, -hh, hh), z);
    const r = range(rng, 0.6, 1.4);
    if (!tryPlace(base, r)) continue;
    cells.push(makeCell(base, r, 0.55));
  }

  const nucleusVariant = cells.map((_, i) => i % 4);
  const hiDetail = cells.map((c, i) => (opt.hero && i === 0) || c.base.z > -9);
  const particles = makeParticles(rng, 200, { x: 16, y: 9, z0: -2, z1: -36 });
  const states: CellState[] = cells.map(() => restCell());
  const tmp = new THREE.Vector3();
  const cam = { pos: new THREE.Vector3(), target: new THREE.Vector3(), fov: FOV, focus: FOCUS };

  const heroCamAt = (sec: number) => {
    // 0-12 push (eased), 12-17 hold with a slight orbit, 17-20 pull back.
    const L = opt.loopFrames / 30;
    const push = sec < 12 ? easeInOut(sec / 12) : sec < 17 ? 1 : 1 - easeInOut((sec - 17) / (L - 17));
    const pos = new THREE.Vector3(0, 0, 0).lerp(HERO_STOP, push);
    let orbitA = 0;
    if (sec >= 12 && sec < 17) orbitA = Math.sin((Math.PI * (sec - 12)) / 5) ** 2 * THREE.MathUtils.degToRad(9);
    if (orbitA !== 0) {
      const rel = pos.clone().sub(HERO_POS);
      rel.applyAxisAngle(new THREE.Vector3(0, 1, 0), orbitA);
      rel.applyAxisAngle(new THREE.Vector3(1, 0, 0), -orbitA * 0.35);
      pos.copy(HERO_POS).add(rel);
    }
    // Small breathing drift so the start/end of the loop is not static.
    const ph = (sec / L) * TAU;
    pos.x += 0.12 * Math.sin(ph);
    pos.y += 0.08 * Math.sin(ph + 1.1);
    return pos;
  };

  const frameState = (frame: number): SceneFrame => {
    const u = (((frame % opt.loopFrames) + opt.loopFrames) % opt.loopFrames) / opt.loopFrames;
    cells.forEach((c, i) => {
      const s = states[i];
      s.pos.copy(c.base).add(orbitAt(c.orbit, u, tmp));
      spinAt(c.spin, u, s.quat);
      s.radius = c.radius;
      s.nuclei[0].offset.copy(c.nucOffset);
      s.nuclei[0].quat.copy(c.nucQuat);
      s.nuclei[0].scale = NUCLEUS_SCALE;
      s.fragments = c.frags.length ? fragmentsAt(c.frags, u) : [];
      s.wobPhase = (u + c.wobPh) % 1;
    });
    if (opt.hero) {
      const sec = (frame % opt.loopFrames) / 30;
      cam.pos.copy(heroCamAt(sec));
      const heroNow = states[0].pos;
      // Look slightly ahead of the hero early on, settle on it when close.
      cam.target.copy(heroNow);
      cam.focus = cam.pos.distanceTo(heroNow);
    } else {
      const t = u * TAU;
      cam.pos.set(0.45 * Math.sin(t), 0.28 * Math.sin(t + 1.3), -0.04 * FOCUS * (1 - Math.cos(t)) + 0.04 * FOCUS * 0.5);
      cam.target.set(cam.pos.x * 0.4 + 0.25 * Math.sin(t + 0.6), cam.pos.y * 0.4, -FOCUS);
      cam.focus = FOCUS;
    }
    // Hero shot stays mostly sharp, as in its reference.
    return { camera: cam, cells: states, phase: u, apertureScale: opt.hero ? 0.55 : 1 };
  };

  return {
    cellCount: cells.length,
    cellSeeds: cells.map((_, i) => 17 + i * 7),
    nucleusVariant,
    hiDetail,
    fragmentCount: cells.map((c) => c.frags.length),
    particles,
    frameState,
  };
};
