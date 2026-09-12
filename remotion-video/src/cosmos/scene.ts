// Deterministic scene layout: where every nebula puff, star and warm
// knot sits in space.
//
// Positions are authored as (nx, ny) — the element's offset from the
// vanishing point at frame 0, as a fraction of the frame width — plus a
// depth z. Projection at render time is then a single growth factor
// g = z / (z - camZ) applied to both offset and size. Authoring in
// screen fractions keeps the composition directable; carrying a real z
// gives true parallax when the camera pushes in.

import { mulberry32 } from "./random";
import { Z_FAR, Z_NEAR } from "./constants";

export type Puff = {
  nx: number;
  ny: number;
  z: number;
  sizeNorm: number;
  kind: "puff" | "core" | "haze";
  texIndex: number;
  rotation: number;
  alpha: number;
};

export type Star = {
  nx: number;
  ny: number;
  z: number;
  sizeNorm: number;
  texIndex: number;
  alpha: number;
  twinklePhase: number;
  twinkleAmount: number;
};

export type WarmKnot = {
  nx: number;
  ny: number;
  z: number;
  sizeNorm: number;
  texIndex: number;
  alpha: number;
};

export type HeroStar = Star;

export type Scene = {
  puffs: Puff[];
  stars: Star[];
  heroStars: HeroStar[];
  warmKnots: WarmKnot[];
};

type Rand = () => number;

const range = (rand: Rand, lo: number, hi: number) => lo + rand() * (hi - lo);

// Box–Muller, clipped, for clustering stars around a centre.
const gaussian = (rand: Rand): number => {
  const u = Math.max(1e-6, rand());
  const v = rand();
  const g = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.max(-2.5, Math.min(2.5, g));
};

type ArmSpec = {
  count: number;
  from: [number, number, number];
  to: [number, number, number];
  /** Control-point offset, so the arm sweeps instead of running straight. */
  bow: [number, number];
  sizeFrom: number;
  sizeTo: number;
  alphaFrom: number;
  alphaTo: number;
  jitter: number;
  zJitter: number;
  kind: Puff["kind"];
  texCount: number;
};

const layArm = (out: Puff[], rand: Rand, spec: ArmSpec) => {
  const [ax, ay, az] = spec.from;
  const [bx, by, bz] = spec.to;
  const cx = (ax + bx) / 2 + spec.bow[0];
  const cy = (ay + by) / 2 + spec.bow[1];

  for (let i = 0; i < spec.count; i++) {
    const t = spec.count === 1 ? 0.5 : i / (spec.count - 1);
    const it = 1 - t;
    // Quadratic Bezier through the bowed control point.
    const bezX = it * it * ax + 2 * it * t * cx + t * t * bx;
    const bezY = it * it * ay + 2 * it * t * cy + t * t * by;

    out.push({
      nx: bezX + range(rand, -spec.jitter, spec.jitter),
      ny: bezY + range(rand, -spec.jitter, spec.jitter),
      z: az + (bz - az) * t + range(rand, -spec.zJitter, spec.zJitter),
      sizeNorm:
        (spec.sizeFrom + (spec.sizeTo - spec.sizeFrom) * t) *
        range(rand, 0.72, 1.3),
      kind: spec.kind,
      texIndex: Math.floor(rand() * spec.texCount),
      rotation: rand() * Math.PI * 2,
      alpha:
        (spec.alphaFrom + (spec.alphaTo - spec.alphaFrom) * t) *
        range(rand, 0.75, 1.25),
    });
  }
};

const buildPuffs = (rand: Rand): Puff[] => {
  const puffs: Puff[] = [];

  // Distant wash. Sits far enough back that it barely moves, which reads
  // as depth behind everything else.
  layArm(puffs, rand, {
    count: 5,
    from: [-0.55, -0.2, 19],
    to: [0.5, 0.25, 16.5],
    bow: [0.05, -0.18],
    sizeFrom: 0.95,
    sizeTo: 1.15,
    alphaFrom: 0.30,
    alphaTo: 0.24,
    jitter: 0.12,
    zJitter: 1.2,
    kind: "haze",
    texCount: 2,
  });

  // Main mass: a broad diagonal running lower-left to upper-centre.
  layArm(puffs, rand, {
    count: 22,
    from: [-0.42, 0.34, 12.5],
    to: [0.12, -0.26, 5.4],
    bow: [-0.1, 0.06],
    sizeFrom: 0.2,
    sizeTo: 0.42,
    alphaFrom: 0.50,
    alphaTo: 0.66,
    jitter: 0.07,
    zJitter: 0.9,
    kind: "puff",
    texCount: 6,
  });

  // Bright, dense core just off the vanishing point — the visual anchor.
  layArm(puffs, rand, {
    count: 12,
    from: [-0.12, 0.1, 10.5],
    to: [0.08, -0.05, 6.8],
    bow: [0.06, 0.04],
    sizeFrom: 0.3,
    sizeTo: 0.5,
    alphaFrom: 0.44,
    alphaTo: 0.58,
    jitter: 0.06,
    zJitter: 0.7,
    kind: "core",
    texCount: 3,
  });

  // Thin filament curtain down the right side, echoing the reference's
  // hanging strands near the frame edge.
  layArm(puffs, rand, {
    count: 18,
    from: [0.29, -0.4, 9.4],
    to: [0.45, 0.36, 6.4],
    bow: [0.14, 0.02],
    sizeFrom: 0.13,
    sizeTo: 0.24,
    alphaFrom: 0.55,
    alphaTo: 0.48,
    jitter: 0.05,
    zJitter: 0.6,
    kind: "puff",
    texCount: 6,
  });

  // A short counter-strand bottom-left, so the composition isn't a
  // single diagonal.
  layArm(puffs, rand, {
    count: 8,
    from: [-0.46, 0.12, 8.2],
    to: [-0.2, 0.42, 6.0],
    bow: [-0.1, 0.08],
    sizeFrom: 0.16,
    sizeTo: 0.24,
    alphaFrom: 0.40,
    alphaTo: 0.34,
    jitter: 0.05,
    zJitter: 0.5,
    kind: "puff",
    texCount: 6,
  });

  // Loose scatter to break up the arms.
  for (let i = 0; i < 10; i++) {
    puffs.push({
      nx: range(rand, -0.55, 0.55),
      ny: range(rand, -0.42, 0.42),
      z: range(rand, 6.5, 13),
      sizeNorm: range(rand, 0.12, 0.28),
      kind: "puff",
      texIndex: Math.floor(rand() * 6),
      rotation: rand() * Math.PI * 2,
      alpha: range(rand, 0.20, 0.34),
    });
  }

  // Painter's algorithm: far puffs first, so near material layers on top.
  return puffs.sort((a, b) => b.z - a.z);
};

const buildWarmKnots = (rand: Rand, count: number): WarmKnot[] => {
  const knots: WarmKnot[] = [];
  // Hand-placed so the warm accents spread across the frame instead of
  // clumping wherever the PRNG happens to land.
  const anchors: [number, number][] = [
    [-0.27, -0.19],
    [0.02, -0.28],
    [-0.38, 0.14],
    [-0.19, 0.26],
    [0.26, 0.3],
    [0.34, -0.08],
    [0.1, 0.4],
  ];
  for (let i = 0; i < count; i++) {
    const [ax, ay] = anchors[i % anchors.length];
    knots.push({
      nx: ax + range(rand, -0.03, 0.03),
      ny: ay + range(rand, -0.03, 0.03),
      z: range(rand, 6.2, 11.5),
      sizeNorm: range(rand, 0.045, 0.085),
      texIndex: Math.floor(rand() * 3),
      alpha: range(rand, 0.5, 0.8),
    });
  }
  return knots;
};

const makeStar = (
  rand: Rand,
  nx: number,
  ny: number,
  z: number,
  sizeBias: number,
  tintCount: number,
  warmBias: boolean,
): Star => {
  // Cubed uniform => many faint pinpricks, a few bright ones.
  const magnitude = Math.pow(rand(), 3.7);
  // Dividing by z means a star's frame-0 size already encodes its
  // distance; the per-frame growth factor then takes over from there.
  const sizeNorm = Math.min(
    0.045,
    (0.0030 + magnitude * 0.034) * sizeBias * (8 / z),
  );
  const depthFade = Math.max(0.35, 1.15 - z / 22);
  const texIndex = warmBias
    ? 3 + Math.floor(rand() * 2)
    : Math.floor(rand() * Math.min(3, tintCount));

  return {
    nx,
    ny,
    z,
    sizeNorm,
    texIndex: Math.min(texIndex, tintCount - 1),
    alpha: (0.22 + 0.72 * Math.pow(rand(), 1.6)) * depthFade,
    twinklePhase: rand() * Math.PI * 2,
    twinkleAmount: range(rand, 0.04, 0.16),
  };
};

const buildStars = (
  rand: Rand,
  ambientCount: number,
  clusterCount: number,
  knots: WarmKnot[],
  tintCount: number,
): Star[] => {
  const stars: Star[] = [];

  // Ambient field across the whole frame, biased toward the far half so
  // the sky reads as deep rather than as a flat sheet of dots.
  for (let i = 0; i < ambientCount; i++) {
    const z = Z_NEAR + (Z_FAR - Z_NEAR) * Math.pow(rand(), 0.55);
    stars.push(
      makeStar(
        rand,
        range(rand, -0.78, 0.78),
        range(rand, -0.55, 0.55),
        z,
        1,
        tintCount,
        false,
      ),
    );
  }

  // Extra density inside the nebula core, matching how the reference's
  // brightest star population sits inside the bright cloud.
  const coreShare = Math.round(clusterCount * 0.62);
  for (let i = 0; i < coreShare; i++) {
    const z = range(rand, 5.5, 12);
    stars.push(
      makeStar(
        rand,
        -0.04 + gaussian(rand) * 0.19,
        0.0 + gaussian(rand) * 0.14,
        z,
        1.15,
        tintCount,
        false,
      ),
    );
  }

  // Tight warm swarms around each amber knot.
  const perKnot = Math.round((clusterCount - coreShare) / Math.max(1, knots.length));
  for (const knot of knots) {
    for (let i = 0; i < perKnot; i++) {
      stars.push(
        makeStar(
          rand,
          knot.nx + gaussian(rand) * knot.sizeNorm * 0.85,
          knot.ny + gaussian(rand) * knot.sizeNorm * 0.85,
          knot.z + range(rand, -0.4, 0.4),
          0.8,
          tintCount,
          rand() < 0.6,
        ),
      );
    }
  }

  return stars.sort((a, b) => b.z - a.z);
};

const buildHeroStars = (
  rand: Rand,
  count: number,
  tintCount: number,
): HeroStar[] => {
  const heroes: HeroStar[] = [];
  for (let i = 0; i < count; i++) {
    const z = range(rand, 4.0, 11.0);
    const base = makeStar(
      rand,
      range(rand, -0.7, 0.7),
      range(rand, -0.5, 0.5),
      z,
      1,
      tintCount,
      false,
    );
    heroes.push({
      ...base,
      sizeNorm: Math.min(0.05, range(rand, 0.016, 0.032) * (8 / z)),
      alpha: range(rand, 0.8, 1),
      twinkleAmount: range(rand, 0.05, 0.12),
    });
  }
  return heroes.sort((a, b) => b.z - a.z);
};

const sceneCache = new Map<string, Scene>();

export const getScene = (
  seed: number,
  ambientStars: number,
  clusterStars: number,
  heroStars: number,
  warmKnots: number,
  tintCount: number,
): Scene => {
  const key = `${seed}|${ambientStars}|${clusterStars}|${heroStars}|${warmKnots}|${tintCount}`;
  const cached = sceneCache.get(key);
  if (cached) return cached;

  const rand = mulberry32(seed);
  const puffs = buildPuffs(rand);
  const knots = buildWarmKnots(rand, warmKnots);
  const stars = buildStars(rand, ambientStars, clusterStars, knots, tintCount);
  const heroes = buildHeroStars(rand, heroStars, tintCount);

  const scene: Scene = { puffs, stars, heroStars: heroes, warmKnots: knots };
  sceneCache.set(key, scene);
  return scene;
};
