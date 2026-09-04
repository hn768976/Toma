/**
 * The radial arrangement.
 *
 * There is no 3D camera here. Looking straight up at a bare canopy, trunks
 * radiate outward from a bright point overhead; that is reproduced by placing
 * silhouettes around the frame perimeter with their feet off-frame, each
 * rotated so its trunk runs inward toward a shared vanishing point, each with
 * a little perspective taper so the crown end recedes.
 *
 * Every value below is drawn once, at module scope, from a seeded generator.
 */

import { between, mulberry32, pick, type Rng } from "./random";

export const LAYOUT_SEED = 0x7c4d21;

/** Vanishing point, as a fraction of the frame — deliberately off-centre. */
export const VANISHING_POINT = { x: 0.455, y: 0.425 };

export type TreeInstance = {
  /** Index into TREE_SOURCES. */
  asset: number;
  /** Depth tier, 0 = nearest. */
  tier: number;
  /** Bearing from the vanishing point to the tree's foot, in radians. */
  theta: number;
  /** Foot distance from the vanishing point, as a multiple of the frame edge. */
  baseOvershoot: number;
  /** Tree height as a fraction of its own foot distance. */
  reach: number;
  /** Horizontal mirror. */
  flip: 1 | -1;
  /** Perspective foreshortening of the crown end, in degrees. */
  tilt: number;
  swayAmp: number;
  swayFreq: number;
  swayPhase: number;
  tiltAmp: number;
  tiltFreq: number;
  tiltPhase: number;
};

/**
 * Which archetype and which depth tier each slot around the ring gets.
 *
 * Exactly two thirds are the slim long-trunked tree (asset 0) because an upward canopy
 * shot is mostly long trunk runs converging on the zenith, and the four
 * dominant near-tier slots are all asset 0 so what anchors each quadrant is a
 * trunk rather than a mass of crown. The dominant slots are spaced 0, 5, 9, 13
 * rather than evenly so the arrangement does not read as a kaleidoscope. The
 * wide spreading dead tree (asset 2) appears once, far back, where the fog
 * takes most of it.
 */
const SCHEDULE: readonly { tier: number; asset: number }[] = [
  { tier: 0, asset: 0 },
  { tier: 2, asset: 0 },
  { tier: 1, asset: 1 },
  { tier: 3, asset: 1 },
  { tier: 1, asset: 0 },
  { tier: 0, asset: 0 },
  { tier: 2, asset: 1 },
  { tier: 1, asset: 0 },
  { tier: 3, asset: 2 },
  { tier: 2, asset: 0 },
  { tier: 0, asset: 0 },
  { tier: 1, asset: 1 },
  { tier: 2, asset: 0 },
  { tier: 1, asset: 0 },
  { tier: 0, asset: 0 },
  { tier: 3, asset: 1 },
  { tier: 2, asset: 0 },
  { tier: 1, asset: 0 },
];

/**
 * Tree height as a fraction of its own foot distance. The near tiers exceed 1,
 * so their crowns carry past the vanishing point and interlace with each
 * other — that tangle over the bright centre is what makes the shot.
 */
const REACH: readonly [number, number][] = [
  [0.96, 1.2],
  [0.84, 1.04],
  [0.6, 0.82],
  [0.4, 0.58],
];

const OVERSHOOT: readonly [number, number][] = [
  [1.02, 1.1],
  [1.05, 1.16],
  [1.08, 1.22],
  [1.1, 1.28],
];

/** Nearer trees foreshorten harder, because more of their length is "toward" us. */
const TILT: readonly [number, number][] = [
  [14, 24],
  [10, 19],
  [7, 14],
  [4, 10],
];

const buildInstances = (): TreeInstance[] => {
  const rng: Rng = mulberry32(LAYOUT_SEED);
  const n = SCHEDULE.length;

  return SCHEDULE.map((slot, i) => {
    // Spread the slots around the ring, then jitter each within its own arc so
    // the spacing is irregular without any two ever colliding.
    const arc = (Math.PI * 2) / n;
    const theta = -Math.PI * 0.5 + i * arc + between(rng, -0.42, 0.42) * arc;

    return {
      asset: slot.asset,
      tier: slot.tier,
      theta,
      baseOvershoot: between(rng, ...OVERSHOOT[slot.tier]),
      reach: between(rng, ...REACH[slot.tier]),
      flip: pick(rng, [1, -1] as const),
      tilt: between(rng, ...TILT[slot.tier]),
      // Sway is tiny and slow. Rotating about the foot already moves the crown
      // far more than the trunk, which is how a real tree behaves.
      swayAmp: between(rng, 0.16, 0.52) * (slot.tier === 0 ? 0.7 : 1),
      swayFreq: pick(rng, [1, 1, 2] as const),
      swayPhase: rng(),
      tiltAmp: between(rng, 0.5, 1.9),
      tiltFreq: pick(rng, [1, 2] as const),
      tiltPhase: rng(),
    };
  });
};

export const TREE_INSTANCES = buildInstances();

/**
 * Distance from the vanishing point to the frame edge along a bearing. Feet are
 * placed just beyond this, so no tree's base is ever visible.
 */
export const edgeDistance = (
  theta: number,
  width: number,
  height: number,
): number => {
  const vx = VANISHING_POINT.x * width;
  const vy = VANISHING_POINT.y * height;
  const dx = Math.cos(theta);
  const dy = Math.sin(theta);

  const tx = dx > 1e-6 ? (width - vx) / dx : dx < -1e-6 ? -vx / dx : Infinity;
  const ty = dy > 1e-6 ? (height - vy) / dy : dy < -1e-6 ? -vy / dy : Infinity;
  return Math.min(tx, ty);
};
