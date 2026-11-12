// Procedural "molecular" DNA double helices built from clustered spheres.
// Units are arbitrary (helix radius = 1, B-DNA-like proportions).

import { Vec3, add, lerp3, mulberry32, randInBall, scale } from "./math";

export type Palette = {
  /** Albedo colours (sRGB 0..1) for the two strand families. */
  blue: Vec3[];
  orange: Vec3[];
};

export const DNA_PALETTE: Palette = {
  blue: [
    [0.1, 0.42, 0.98],
    [0.18, 0.56, 1.0],
    [0.32, 0.7, 1.0],
  ],
  orange: [
    [0.98, 0.47, 0.09],
    [1.0, 0.55, 0.14],
    [1.0, 0.64, 0.24],
  ],
};

export type Atom = {
  /** Position in helix-local space (helix axis = +Y). */
  p: Vec3;
  r: number;
  color: Vec3;
  /** Baked ambient occlusion / tint multiplier. */
  ao: number;
};

export type HelixPlacement = {
  /** World position of the helix axis centre. */
  pos: Vec3;
  /** Lean of the axis (radians) around Z (screen roll) and X (towards camera). */
  tiltZ: number;
  tiltX: number;
  /** Spin around its own axis: phase (rad) + angular speed (rad / s). */
  phase: number;
  spin: number;
  seed: number;
  /** Number of base pairs above and below the centre. */
  halfLength: number;
};

const HELIX_RADIUS = 1.0;
const RISE = 0.19; // axial rise per base pair
const TWIST = (2 * Math.PI) / 10; // 10 bp per turn
const GROOVE = Math.PI * 0.78; // angular offset of strand B (major/minor groove)
const BAND = 8; // base pairs per colour period // base pairs per colour band

export const buildHelix = (h: HelixPlacement, palette: Palette): Atom[] => {
  const rnd = mulberry32(h.seed);
  const atoms: Atom[] = [];
  const pick = (list: Vec3[]) => list[Math.floor(rnd() * list.length) % list.length];

  const backbone = (i: number, strand: number): Vec3 => {
    const a = i * TWIST + strand * GROOVE;
    return [HELIX_RADIUS * Math.cos(a), i * RISE, HELIX_RADIUS * Math.sin(a)];
  };

  for (let i = -h.halfLength; i <= h.halfLength; i++) {
    // Colour bands along the helix: 3 orange base pairs, then 5 blue ones
    // (roughly 2:1 blue to orange, as in the reference).
    const inPeriod = (((i % BAND) + BAND) % BAND);
    const baseFam = inPeriod < 3 ? palette.orange : palette.blue;
    for (let s = 0; s < 2; s++) {
      const B = backbone(i, s);
      const Bnext = backbone(i + 1, s);
      const Bother = backbone(i, 1 - s);
      const mid = lerp3(B, Bother, 0.5);

      // Sugar-phosphate cluster: a lumpy bunch of glossy beads.
      for (let k = 0; k < 8; k++) {
        const j = scale(randInBall(rnd), 0.27);
        atoms.push({
          p: add(B, [j[0], j[1] * 0.85, j[2]]),
          r: 0.115 + rnd() * 0.06,
          color: pick(baseFam),
          ao: 0.9 + rnd() * 0.1,
        });
      }
      // Bridge to the next pair along the same strand keeps the strand continuous.
      for (let k = 1; k <= 2; k++) {
        const j = scale(randInBall(rnd), 0.06);
        atoms.push({
          p: add(lerp3(B, Bnext, k / 3), j),
          r: 0.13 + rnd() * 0.04,
          color: pick(baseFam),
          ao: 0.88 + rnd() * 0.1,
        });
      }
      // Base: a lobed finger of beads reaching towards the partner base.
      const wob = scale(randInBall(rnd), 0.12);
      for (let k = 0; k < 6; k++) {
        const f = 0.26 + (k / 5) * 0.72;
        const j = scale(randInBall(rnd), 0.08);
        const lobe = Math.sin(f * Math.PI);
        atoms.push({
          p: add(lerp3(B, mid, f), [j[0] + wob[0] * lobe, j[1] * 0.7 + wob[1] * lobe, j[2] + wob[2] * lobe]),
          r: 0.105 + rnd() * 0.055,
          color: pick(baseFam),
          ao: 0.8 + rnd() * 0.15,
        });
      }
    }
  }
  return atoms;
};

/** Free-floating specks of "dust" in the medium. */
export type Dust = { p: Vec3; r: number; drift: Vec3; tw: number };

export const buildDust = (count: number, seed: number): Dust[] => {
  const rnd = mulberry32(seed);
  const out: Dust[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      p: [rnd() * 10 - 5, rnd() * 7 - 3.5, rnd() * 5 - 2.5],
      r: 0.004 + rnd() * 0.008,
      drift: [(rnd() - 0.5) * 0.06, (rnd() - 0.3) * 0.08, (rnd() - 0.5) * 0.05],
      tw: rnd() * Math.PI * 2,
    });
  }
  return out;
};

/**
 * Layout shared by both versions: one hero helix in the middle, a huge
 * out-of-focus helix in the foreground on the left, a softer one behind on
 * the right and two far helices that read as coloured haze.
 */
export const HELICES: HelixPlacement[] = [
  // Hero (in focus)
  { pos: [0.25, 0, 0], tiltZ: -0.18, tiltX: 0.08, phase: 0.4, spin: 0.16, seed: 11, halfLength: 36 },
  // Foreground left (very blurred)
  { pos: [-1.55, 0.3, 2.4], tiltZ: -0.2, tiltX: 0.05, phase: 2.1, spin: 0.12, seed: 23, halfLength: 34 },
  // Background right
  { pos: [5.1, -0.5, -4.0], tiltZ: -0.11, tiltX: 0.0, phase: 4.0, spin: 0.14, seed: 37, halfLength: 44 },
  // Far haze helices
  { pos: [-4.6, 0.4, -5.5], tiltZ: 0.12, tiltX: 0.0, phase: 1.0, spin: 0.1, seed: 41, halfLength: 50 },
  { pos: [11.0, 0.0, -10.0], tiltZ: -0.05, tiltX: 0.0, phase: 3.0, spin: 0.1, seed: 53, halfLength: 60 },
];
