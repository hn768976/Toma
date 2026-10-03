// Static scene layout: hero molecule and the background bodies for each
// background variant. Everything here is generated once, at module level,
// from seeded PRNGs. Animation (animate.ts) is a pure function of the frame.

import {Euler, Quaternion, Vector3} from 'three';
import {BACKGROUNDS, BackgroundId} from '../data';
import {mulberry32, range, Rng} from '../random';

export type Atom = {p: Vector3; r: number};
export type Bond = {i: number; j: number; r: number};

export type Body = {
  atoms: Atom[];
  bonds: Bond[];
  /** World-space centre of the closed drift path. */
  center: Vector3;
  /** Closed drift path: center + ampSin*sin(th) + ampCos*cos(th), th = 2pi(freq*p + phase). */
  ampSin: Vector3;
  ampCos: Vector3;
  driftFreq: number; // whole number
  driftPhase: number;
  /** Rest orientation, then spin about a local axis by whole turns per loop. */
  q0: Quaternion;
  spinAxis: Vector3;
  spinTurns: number; // whole number (may be 0 or negative)
  spinPhase: number;
  /** 0 = hero material, 1 = fully faded into the background colour. */
  pale: number;
  opacity: number;
  bondOpacity: number;
  /** >0: a luminous floating speck instead of a glass bead. */
  glow?: number;
  /** Drawn in front of the hero (foreground bokeh). */
  foreground?: boolean;
};

// Camera: at (0,0,CAM_Z) looking down -z, vertical FOV CAM_FOV.
export const CAM_Z = 10;
export const CAM_FOV = 28;
export const FOCUS_DIST = CAM_Z; // hero sits at the origin
const TAN_HALF = Math.tan(((CAM_FOV / 2) * Math.PI) / 180);
const ASPECT = 16 / 9;

const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

const randomUnit = (rng: Rng) => {
  const z = range(rng, -1, 1);
  const a = range(rng, 0, Math.PI * 2);
  const s = Math.sqrt(1 - z * z);
  return v(s * Math.cos(a), s * Math.sin(a), z);
};

const randomQuat = (rng: Rng) =>
  new Quaternion().setFromAxisAngle(randomUnit(rng), range(rng, 0, Math.PI * 2));

/** World point at view distance `dist`, at normalised screen coords sx,sy in [-1,1]. */
const atScreen = (sx: number, sy: number, dist: number) =>
  v(sx * dist * TAN_HALF * ASPECT, sy * dist * TAN_HALF, CAM_Z - dist);

// ---------------------------------------------------------------- hero

export type Hero = {atoms: Atom[]; bonds: Bond[]};

export const makeHero = (scale: number, bondLength: number, bondRadius: number): Hero => {
  const rc = 0.237 * scale; // ~9.5% of frame height at the focus distance
  const ro = 0.215 * scale;
  const len = bondLength * scale;
  const dirs = [v(1, 1, 1), v(1, -1, -1), v(-1, 1, -1), v(-1, -1, 1)].map((d) =>
    d.normalize(),
  );
  const atoms: Atom[] = [{p: v(0, 0, 0), r: rc}];
  // slightly uneven bond lengths read as a real molecule, not a jack
  const lens = [1.0, 1.04, 0.97, 1.02];
  dirs.forEach((d, k) => atoms.push({p: d.multiplyScalar(len * lens[k]), r: ro}));
  const bonds = [1, 2, 3, 4].map((j) => ({i: 0, j, r: bondRadius * scale}));
  return {atoms, bonds};
};

// Hero rest orientation and spin axis (tilted). One full turn per loop.
export const HERO_Q0 = new Quaternion().setFromEuler(
  // chosen so one atom hangs below, one rises above, two to the sides
  new Euler(0.35, 0.2, 0.95),
);
export const HERO_AXIS = v(0.22, 1, 0.3).normalize();

// ---------------------------------------------------------------- builders

const makeHelix = (
  rng: Rng,
  pairs: number,
  radius: number,
  rise: number,
  atomR: number,
  bend: number,
): Pick<Body, 'atoms' | 'bonds'> => {
  const atoms: Atom[] = [];
  const bonds: Bond[] = [];
  const twist = (Math.PI * 2) / range(rng, 9.5, 11.5);
  const groove = Math.PI * 0.82; // offset between the strands (minor groove)
  const x0 = (-(pairs - 1) * rise) / 2;
  for (let k = 0; k < pairs; k++) {
    const x = x0 + k * rise;
    const a = k * twist;
    // a gentle bow so the strands don't read as ruler-straight
    const yb = bend * (x * x) * 0.01;
    const s1 = v(x, yb + radius * Math.cos(a), radius * Math.sin(a));
    const s2 = v(x, yb + radius * Math.cos(a + groove), radius * Math.sin(a + groove));
    const i1 = atoms.length;
    atoms.push({p: s1, r: atomR * range(rng, 0.92, 1.08)});
    atoms.push({p: s2, r: atomR * range(rng, 0.92, 1.08)});
    // rung (base pair)
    bonds.push({i: i1, j: i1 + 1, r: atomR * 0.24});
    if (k > 0) {
      // backbones
      bonds.push({i: i1 - 2, j: i1, r: atomR * 0.22});
      bonds.push({i: i1 - 1, j: i1 + 1, r: atomR * 0.22});
    }
  }
  return {atoms, bonds};
};

const makeSmallMolecule = (
  rng: Rng,
  atomR: number,
  nAtoms: number,
): Pick<Body, 'atoms' | 'bonds'> => {
  const atoms: Atom[] = [{p: v(0, 0, 0), r: atomR * range(rng, 1.0, 1.15)}];
  const bonds: Bond[] = [];
  const bondLen = atomR * range(rng, 3.4, 4.2);
  // grow a small tree; each new atom attaches to an existing one
  let guard = 0;
  while (atoms.length < nAtoms && guard++ < 200) {
    const parent = atoms.length < 4 ? 0 : Math.floor(rng() * atoms.length);
    const dir = randomUnit(rng);
    const p = atoms[parent].p.clone().addScaledVector(dir, bondLen * range(rng, 0.85, 1.1));
    if (atoms.some((a) => a.p.distanceTo(p) < bondLen * 0.8)) continue;
    atoms.push({p, r: atomR * range(rng, 0.7, 1.0)});
    bonds.push({i: parent, j: atoms.length - 1, r: atomR * 0.2});
  }
  // centre the molecule on its centroid so it spins in place
  const c = atoms.reduce((s, a) => s.add(a.p), v(0, 0, 0)).multiplyScalar(1 / atoms.length);
  atoms.forEach((a) => a.p.sub(c));
  return {atoms, bonds};
};

const makeRing = (rng: Rng, atomR: number): Pick<Body, 'atoms' | 'bonds'> => {
  const atoms: Atom[] = [];
  const bonds: Bond[] = [];
  const ringR = atomR * 4.2;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    atoms.push({p: v(ringR * Math.cos(a), ringR * Math.sin(a), 0), r: atomR});
    bonds.push({i: k, j: (k + 1) % 6, r: atomR * 0.2});
  }
  // one or two substituents pointing outward
  const subs = rng() < 0.5 ? 1 : 2;
  for (let s = 0; s < subs; s++) {
    const k = (s * 3 + Math.floor(rng() * 2)) % 6;
    const out = atoms[k].p.clone().normalize();
    atoms.push({p: atoms[k].p.clone().addScaledVector(out, atomR * 3.6), r: atomR * 0.85});
    bonds.push({i: k, j: atoms.length - 1, r: atomR * 0.2});
  }
  return {atoms, bonds};
};

const paleForDist = (dist: number) => Math.min(0.22, Math.max(0, (dist - 14) * 0.008));
const opacityForDist = (dist: number) => Math.max(0.8, 1 - (dist - 11) * 0.008);

const body = (
  rng: Rng,
  shape: Pick<Body, 'atoms' | 'bonds'>,
  center: Vector3,
  dist: number,
  opts: Partial<Body> = {},
): Body => ({
  ...shape,
  center,
  ampSin: randomUnit(rng).multiplyScalar(range(rng, 0.08, 0.2) * (dist / 15)),
  ampCos: randomUnit(rng).multiplyScalar(range(rng, 0.08, 0.2) * (dist / 15)),
  driftFreq: 1,
  driftPhase: rng(),
  q0: randomQuat(rng),
  spinAxis: randomUnit(rng),
  spinTurns: rng() < 0.5 ? 1 : -1,
  spinPhase: rng(),
  pale: paleForDist(dist),
  opacity: opacityForDist(dist),
  bondOpacity: 0.85,
  ...opts,
});

/** Screen-space keep-out around the hero for near background objects. */
const nearHero = (sx: number, sy: number, dist: number, heroScale: number) =>
  dist < 17 && Math.abs(sx) < 0.2 * heroScale && Math.abs(sy) < 0.36 * heroScale;

const scatter = (
  rng: Rng,
  count: number,
  distRange: [number, number],
  heroScale: number,
  minSep: number,
  placed: {sx: number; sy: number}[],
  make: (dist: number) => Pick<Body, 'atoms' | 'bonds'>,
  opts: (dist: number) => Partial<Body> = () => ({}),
): Body[] => {
  const out: Body[] = [];
  let guard = 0;
  while (out.length < count && guard++ < 5000) {
    const dist = range(rng, distRange[0], distRange[1]);
    const sx = range(rng, -1.08, 1.08);
    const sy = range(rng, -1.1, 1.1);
    if (nearHero(sx, sy, dist, heroScale)) continue;
    if (placed.some((p) => Math.hypot((p.sx - sx) * ASPECT, p.sy - sy) < minSep)) continue;
    placed.push({sx, sy});
    out.push(body(rng, make(dist), atScreen(sx, sy, dist), dist, opts(dist)));
  }
  return out;
};

const particles = (rng: Rng, count: number, distRange: [number, number]): Body[] => {
  const out: Body[] = [];
  for (let k = 0; k < count; k++) {
    const dist = range(rng, distRange[0], distRange[1]);
    const center = atScreen(range(rng, -1.1, 1.1), range(rng, -1.1, 1.1), dist);
    const r = range(rng, 0.012, 0.026) * (dist / 12);
    out.push(
      body(rng, {atoms: [{p: v(0, 0, 0), r}], bonds: []}, center, dist, {
        ampSin: randomUnit(rng).multiplyScalar(range(rng, 0.1, 0.35) * (dist / 15)),
        ampCos: randomUnit(rng).multiplyScalar(range(rng, 0.1, 0.35) * (dist / 15)),
        driftFreq: rng() < 0.7 ? 1 : 2,
        pale: 0.15,
        opacity: range(rng, 0.55, 0.9),
        glow: range(rng, 1.2, 2.5),
        foreground: dist < FOCUS_DIST - 1,
      }),
    );
  }
  return out;
};

// ---------------------------------------------------------------- variants

const buildDna = (heroScale: number): Body[] => {
  const rng = mulberry32(0x0d1a);
  const bodies: Body[] = [];
  // three long double helices crossing the frame diagonally at different depths
  const helices: {
    sx: number;
    sy: number;
    dist: number;
    dir: Vector3;
    pairs: number;
    turns: number;
  }[] = [
    // mostly parallel, rising lower-left -> upper-right, at several depths
    {sx: -0.35, sy: 0.4, dist: 13.5, dir: v(1, 0.55, -0.25), pairs: 40, turns: 1},
    {sx: 0.62, sy: -0.55, dist: 12.5, dir: v(1, 0.5, 0.15), pairs: 34, turns: -1},
    {sx: 0.55, sy: 0.55, dist: 17, dir: v(1, 0.6, 0.1), pairs: 40, turns: 1},
    {sx: -0.55, sy: -0.75, dist: 16, dir: v(1, 0.45, 0.2), pairs: 40, turns: -1},
    {sx: -0.2, sy: 0.95, dist: 22, dir: v(1, 0.5, 0.0), pairs: 46, turns: 1},
    {sx: 0.95, sy: 0.0, dist: 21, dir: v(1, 0.65, -0.1), pairs: 40, turns: -1},
  ];
  for (const h of helices) {
    const shape = makeHelix(
      rng,
      h.pairs,
      range(rng, 0.55, 0.68),
      range(rng, 0.38, 0.44),
      range(rng, 0.12, 0.14),
      range(rng, -1, 1),
    );
    const q0 = new Quaternion().setFromUnitVectors(v(1, 0, 0), h.dir.clone().normalize());
    bodies.push(
      body(rng, shape, atScreen(h.sx, h.sy, h.dist), h.dist, {
        q0,
        spinAxis: v(1, 0, 0),
        spinTurns: h.turns,
        ampSin: v(0.12, 0.18, 0.05),
        ampCos: v(-0.1, 0.06, 0.08),
        bondOpacity: 0.75,
      }),
    );
  }
  const placed = helices.map((h) => ({sx: h.sx, sy: h.sy}));
  bodies.push(
    ...scatter(rng, 16, [11.5, 22], heroScale, 0.22, placed, (d) =>
      makeSmallMolecule(rng, 0.0095 * d, 3 + Math.floor(rng() * 3)),
    ),
  );
  bodies.push(
    ...scatter(rng, 3, [11.5, 15], heroScale, 0.25, placed, (d) => makeRing(rng, 0.0085 * d), () => ({
      // rings face the camera so they read as hexagons
      spinAxis: v(0, 0, 1),
      q0: new Quaternion().setFromEuler(new Euler(range(rng, -0.5, 0.5), range(rng, -0.5, 0.5), 0)),
    })),
  );
  bodies.push(...particles(rng, 70, [12, 34]));
  bodies.push(...particles(rng, 7, [3.5, 7.5]));
  return bodies;
};

const buildStructures = (heroScale: number): Body[] => {
  const rng = mulberry32(0x5717);
  const bodies: Body[] = [];
  const placed: {sx: number; sy: number}[] = [];
  // two large rings at the hero's depth, half hidden behind it
  const bigRings: [number, number, number, Euler][] = [
    [0.3, 0.3, 13, new Euler(0.25, -0.45, 0.25)],
    [-0.05, -0.62, 13.8, new Euler(-0.9, 0.2, -0.3)],
  ];
  for (const [sx, sy, dist, e] of bigRings) {
    bodies.push(
      body(rng, makeRing(rng, 0.2), atScreen(sx, sy, dist), dist, {
        q0: new Quaternion().setFromEuler(e),
        spinAxis: v(0, 0, 1),
        spinTurns: 0,
        ampSin: v(0.12, 0.08, 0),
        ampCos: v(0.04, -0.1, 0.08),
        pale: 0,
        opacity: 1,
      }),
    );
    placed.push({sx, sy});
  }
  bodies.push(
    ...scatter(rng, 2, [17, 26], heroScale, 0.45, placed, (d) => makeRing(rng, 0.0095 * d)),
  );
  bodies.push(
    ...scatter(rng, 17, [12, 20], heroScale, 0.4, placed, (d) =>
      makeSmallMolecule(rng, 0.012 * d, 3 + Math.floor(rng() * 5)),
    ),
  );
  bodies.push(...particles(rng, 80, [12, 34]));
  bodies.push(...particles(rng, 7, [3.5, 7.5]));
  return bodies;
};

const BUILDERS: Record<BackgroundId, (heroScale: number) => Body[]> = {
  dna: buildDna,
  structures: buildStructures,
};

// Built once at module level from the seeded PRNGs above.
export const BACKGROUND_BODIES = Object.fromEntries(
  BACKGROUNDS.map((b) => [b.id, BUILDERS[b.id](b.heroScale)]),
) as Record<BackgroundId, Body[]>;

export const HEROES = Object.fromEntries(
  BACKGROUNDS.map((b) => [b.id, makeHero(b.heroScale, b.heroBondLength, b.heroBondRadius)]),
) as Record<BackgroundId, Hero>;
