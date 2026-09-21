/**
 * Build-time scene generation.
 *
 * Everything here runs once, at module evaluation, from a seeded PRNG. Nothing
 * in this file is called from the render path: `useCurrentFrame` only ever
 * reads the structures produced here and evaluates a closed-form position for it.
 *
 * That split is what makes the compositions safe to render out of order across
 * threads -- see README, "Determinism".
 */
import { Rng } from './random';
import type { GeometryMode, LookRow } from './types';

export const FOV = 35;
export const CAMERA_Z = 10;
const TAN_HALF_FOV = Math.tan(((FOV / 2) * Math.PI) / 180);
export const ASPECT = 16 / 9;

/** Half-height of the view frustum at a given world z. */
export const halfHeightAt = (z: number) => (CAMERA_Z - z) * TAN_HALF_FOV;
/** Half-width of the view frustum at a given world z. */
export const halfWidthAt = (z: number) => halfHeightAt(z) * ASPECT;
/** Frame height in world units at z = 0, used to express sizes as fractions. */
export const FRAME_HEIGHT = halfHeightAt(0) * 2;

export type InnerBubble = { offset: [number, number, number]; radius: number };

export type Member = {
  offset: [number, number, number];
  radius: number;
  bubbles: InnerBubble[];
};

export type Bond = { a: number; b: number };

/** Which material group an element is drawn with. */
export type Layer = 'front' | 'mid' | 'back';

export type Cluster = {
  members: Member[];
  bonds: Bond[];
  center: [number, number, number];
  /** Lissajous amplitudes, world units. */
  amp: [number, number, number];
  /** Integer frequencies -- the reason the path closes at t = 1. */
  freq: [number, number, number];
  phase: [number, number, number];
  axis: [number, number, number];
  /** Integer number of full turns over the composition. Never fractional. */
  turns: number;
  layer: Layer;
  /**
   * Set for fused blob clusters. All of them instance ONE generated mesh and
   * vary by scale/rotation/depth: a second fused geometry would need a second
   * transmission material, and two of those cannot both stay deterministic
   * (see Scene.tsx).
   */
  blobIndex?: number;
  /** Uniform scale applied to the shared blob geometry. */
  scale?: number;
  /** Look 5 only: constant upward speed in world units per frame. */
  rise?: number;
  /** Look 5 only: per-bubble film thickness in nm. */
  filmThickness?: number;
  /**
   * Look 6 only: brightness multiplier for the approximated back mass. The
   * glow has to fall off across the frame, otherwise every front sphere
   * transmits the same flat value and nothing reads as backlit.
   */
  tintScale?: number;
};

export type SceneBuild = {
  clusters: Cluster[];
  /** Sphere groups that fuse into a marching-cubes mesh (look 3). */
  blobs: { members: Member[] }[];
};

const innerBubbles = (rng: Rng, parentRadius: number, count: [number, number], size: [number, number]): InnerBubble[] => {
  const n = rng.int(count[0], count[1]);
  return Array.from({ length: n }, () => {
    const dir = rng.unitVector();
    // Biased toward the parent's surface rather than its centre: in the
    // references the inclusions read as sitting just under the skin.
    const r = Math.pow(rng.next(), 0.45) * 0.74;
    const radius = rng.range(size[0], size[1]) * parentRadius;
    return {
      offset: [dir[0] * r * parentRadius, dir[1] * r * parentRadius, dir[2] * r * parentRadius] as [
        number,
        number,
        number,
      ],
      radius,
    };
  });
};

const driftFor = (rng: Rng, diameter: number, ampFraction: [number, number]): Pick<Cluster, 'amp' | 'freq' | 'phase'> => ({
  amp: [
    rng.range(ampFraction[0], ampFraction[1]) * diameter,
    rng.range(ampFraction[0], ampFraction[1]) * diameter,
    rng.range(ampFraction[0], ampFraction[1]) * diameter * 0.7,
  ],
  freq: [rng.int(1, 3), rng.int(1, 3), rng.int(1, 3)],
  phase: [rng.range(0, Math.PI * 2), rng.range(0, Math.PI * 2), rng.range(0, Math.PI * 2)],
});

const spin = (rng: Rng, options: number[]): Pick<Cluster, 'axis' | 'turns'> => ({
  axis: rng.unitVector(),
  turns: rng.pick(options),
});

// ---------------------------------------------------------------------------
// Look 1 -- Molecule Chain
// ---------------------------------------------------------------------------

/**
 * A branching tree of 4-9 nodes with roughly tetrahedral bond angles.
 *
 * The topology is arbitrary and decorative -- it is not modelled on any real
 * structure and no compound is named anywhere in this project.
 */
const buildMoleculeCluster = (rng: Rng, baseRadius: number): { members: Member[]; bonds: Bond[] } => {
  const count = rng.int(4, 9);
  const members: Member[] = [
    {
      offset: [0, 0, 0],
      radius: baseRadius * rng.range(0.9, 1.15),
      bubbles: [],
    },
  ];
  const bonds: Bond[] = [];
  const directions: [number, number, number][][] = [[]];

  for (let i = 1; i < count; i++) {
    const parentIndex = rng.int(0, members.length - 1);
    const parent = members[parentIndex];
    let dir = rng.unitVector();
    // Keep new bonds away from the parent's existing ones so clusters branch
    // outward instead of collapsing into a line.
    for (let attempt = 0; attempt < 12; attempt++) {
      const candidate = rng.unitVector();
      const tooClose = directions[parentIndex].some(
        (d) => d[0] * candidate[0] + d[1] * candidate[1] + d[2] * candidate[2] > 0.34,
      );
      if (!tooClose) {
        dir = candidate;
        break;
      }
    }
    directions[parentIndex].push(dir);
    const radius = baseRadius * rng.range(0.55, 1.05);
    const distance = (parent.radius + radius) * rng.range(1.18, 1.5);
    members.push({
      offset: [
        parent.offset[0] + dir[0] * distance,
        parent.offset[1] + dir[1] * distance,
        parent.offset[2] + dir[2] * distance,
      ],
      radius,
      bubbles: [],
    });
    directions.push([[-dir[0], -dir[1], -dir[2]]]);
    bonds.push({ a: parentIndex, b: i });
  }
  return { members, bonds };
};

const buildMolecule = (rng: Rng): SceneBuild => {
  const clusters: Cluster[] = [];

  const add = (layer: Layer, z: number, baseRadius: number, ampFraction: [number, number], turnOptions: number[]) => {
    const { members, bonds } = buildMoleculeCluster(rng, baseRadius);
    members.forEach((m) => {
      m.bubbles = innerBubbles(rng, m.radius, [4, 11], [0.06, 0.2]);
    });
    const hw = halfWidthAt(z);
    const hh = halfHeightAt(z);
    const diameter = baseRadius * 2;
    clusters.push({
      members,
      bonds,
      center: [rng.range(-hw * 0.82, hw * 0.82), rng.range(-hh * 0.78, hh * 0.78), z],
      ...driftFor(rng, diameter, ampFraction),
      ...spin(rng, turnOptions),
      layer,
    });
  };

  // One sharp mid cluster, slightly off-centre, is the focus of the frame.
  const { members, bonds } = buildMoleculeCluster(rng, 0.62);
  members.forEach((m) => {
    m.bubbles = innerBubbles(rng, m.radius, [5, 12], [0.07, 0.2]);
  });
  clusters.push({
    members,
    bonds,
    center: [-0.85, 0.35, 0.6],
    ...driftFor(rng, 1.24, [0.1, 0.2]),
    ...spin(rng, [1]),
    layer: 'mid',
  });

  // Foreground clusters: large on screen and very soft.
  for (let i = 0; i < 2; i++) add('front', rng.range(3.0, 4.2), rng.range(0.5, 0.66), [0.1, 0.18], [1]);
  // Background clusters: small and blurred to near-shapelessness.
  for (let i = 0; i < 4; i++) add('back', rng.range(-8.5, -2.5), rng.range(0.55, 0.95), [0.12, 0.2], [1, 2]);

  return { clusters, blobs: [] };
};

// ---------------------------------------------------------------------------
// Look 2 -- Giant Sphere Cluster
// ---------------------------------------------------------------------------

const buildGiant = (rng: Rng): SceneBuild => {
  const clusters: Cluster[] = [];

  const addSphere = (layer: Layer, z: number, radius: number, ampFraction: [number, number], turnOptions: number[]) => {
    const hw = halfWidthAt(z);
    const hh = halfHeightAt(z);
    clusters.push({
      members: [
        {
          offset: [0, 0, 0],
          radius,
          bubbles: innerBubbles(rng, radius, [7, 16], [0.05, 0.15]),
        },
      ],
      bonds: [],
      // Pushed out past the frame edge on purpose: these should be cropped.
      center: [rng.range(-hw * 1.05, hw * 1.05), rng.range(-hh * 1.0, hh * 1.0), z],
      ...driftFor(rng, radius * 2, ampFraction),
      ...spin(rng, turnOptions),
      layer,
    });
  };

  // Five very large spheres carry the frame; two sit forward and go soft.
  addSphere('mid', 0.4, 2.35, [0.1, 0.16], [1]);
  addSphere('mid', -0.3, 2.0, [0.1, 0.16], [1]);
  addSphere('mid', 1.0, 1.75, [0.1, 0.16], [1]);
  addSphere('front', 3.4, 2.1, [0.1, 0.15], [1]);
  addSphere('front', 2.6, 1.6, [0.1, 0.15], [1]);
  for (let i = 0; i < 4; i++) {
    addSphere('back', rng.range(-7.5, -1.6), rng.range(1.1, 2.2), [0.12, 0.2], [1, 2]);
  }
  return { clusters, blobs: [] };
};

// ---------------------------------------------------------------------------
// Look 3 -- Candy Blob
// ---------------------------------------------------------------------------

const buildBlob = (rng: Rng): SceneBuild => {
  const clusters: Cluster[] = [];
  const blobs: { members: Member[] }[] = [];

  const addSingle = (layer: Layer, z: number, radius: number) => {
    const hw = halfWidthAt(z);
    const hh = halfHeightAt(z);
    clusters.push({
      members: [{ offset: [0, 0, 0], radius, bubbles: [] }],
      bonds: [],
      center: [rng.range(-hw * 0.95, hw * 0.95), rng.range(-hh * 0.95, hh * 0.95), z],
      ...driftFor(rng, radius * 2, [0.1, 0.18]),
      ...spin(rng, [1]),
      layer,
    });
  };

  /**
   * The shared fused shape. Built once from a smooth-minimum field over its
   * member spheres, then instanced at several scales and orientations.
   */
  const blobMembers: Member[] = [{ offset: [0, 0, 0], radius: 1, bubbles: [] }];
  for (let i = 1; i < 3; i++) {
    const anchor = blobMembers[rng.int(0, blobMembers.length - 1)];
    const dir = rng.unitVector();
    const r = rng.range(0.72, 1.0);
    // Close enough that the smooth-min produces a real fused neck rather than
    // two balls touching at a point.
    const distance = (anchor.radius + r) * rng.range(0.9, 1.02);
    blobMembers.push({
      offset: [
        anchor.offset[0] + dir[0] * distance,
        anchor.offset[1] + dir[1] * distance,
        anchor.offset[2] + dir[2] * distance * 0.5,
      ],
      radius: r,
      bubbles: [],
    });
  }
  blobs.push({ members: blobMembers });

  const addFused = (layer: Layer, z: number, scale: number) => {
    const hw = halfWidthAt(z);
    const hh = halfHeightAt(z);
    clusters.push({
      members: [{ offset: [0, 0, 0], radius: scale, bubbles: [] }],
      bonds: [],
      center: [rng.range(-hw * 0.8, hw * 0.8), rng.range(-hh * 0.8, hh * 0.8), z],
      ...driftFor(rng, scale * 2, [0.1, 0.18]),
      ...spin(rng, [1]),
      layer,
      blobIndex: 0,
      scale,
    });
  };

  addFused('mid', 0.5, 0.58);
  addFused('mid', -0.2, 0.5);
  addFused('front', 2.9, 0.6);
  addSingle('mid', 0.9, 0.72);
  addSingle('mid', -0.6, 0.8);
  addSingle('front', 3.1, 0.86);
  addSingle('front', 2.4, 0.74);
  for (let i = 0; i < 6; i++) addSingle('back', rng.range(-5.5, -1.4), rng.range(0.6, 0.95));

  return { clusters, blobs };
};

// ---------------------------------------------------------------------------
// Look 4 -- Fine Bubble Field
// ---------------------------------------------------------------------------

const buildField = (rng: Rng): SceneBuild => {
  const clusters: Cluster[] = [];
  // Deliberately no hero: an even scatter, coverage out to all four edges, at
  // enough distinct depths that the sharpness falls off gradually.
  const bands: { layer: Layer; z: [number, number]; count: number; radius: [number, number] }[] = [
    { layer: 'front', z: [3.2, 5.0], count: 5, radius: [0.26, 0.5] },
    { layer: 'mid', z: [0.2, 1.6], count: 7, radius: [0.2, 0.42] },
    { layer: 'back', z: [-2.5, -0.4], count: 9, radius: [0.2, 0.44] },
    { layer: 'back', z: [-7.0, -3.0], count: 12, radius: [0.3, 0.62] },
  ];
  bands.forEach((band) => {
    for (let i = 0; i < band.count; i++) {
      const z = rng.range(band.z[0], band.z[1]);
      const radius = rng.range(band.radius[0], band.radius[1]);
      const hw = halfWidthAt(z);
      const hh = halfHeightAt(z);
      clusters.push({
        members: [{ offset: [0, 0, 0], radius, bubbles: [] }],
        bonds: [],
        center: [rng.range(-hw * 1.02, hw * 1.02), rng.range(-hh * 1.02, hh * 1.02), z],
        ...driftFor(rng, radius * 2, [0.12, 0.2]),
        ...spin(rng, [1, 2]),
        layer: band.layer,
      });
    }
  });
  return { clusters, blobs: [] };
};

// ---------------------------------------------------------------------------
// Look 5 -- Iridescent Rise (not a loop)
// ---------------------------------------------------------------------------

const buildIridescent = (rng: Rng): SceneBuild => {
  const clusters: Cluster[] = [];
  const add = (layer: Layer, z: number, radius: number) => {
    const hw = halfWidthAt(z);
    const span = halfHeightAt(z) * 2 + radius * 4;
    clusters.push({
      members: [{ offset: [0, 0, 0], radius, bubbles: innerBubbles(rng, radius, [2, 5], [0.08, 0.2]) }],
      bonds: [],
      center: [rng.range(-hw * 0.9, hw * 0.9), rng.range(-span / 2, span / 2), z],
      ...driftFor(rng, radius * 2, [0.08, 0.16]),
      ...spin(rng, [1]),
      layer,
      rise: rng.range(0.016, 0.03),
      // Film thickness varies per bubble so they do not all shift hue in unison.
      filmThickness: rng.range(180, 560),
    });
  };
  // A tight hero group, then a few stragglers -- not an even field.
  const cluster = (layer: Layer, z: number, cx: number, cy: number, n: number, radius: [number, number]) => {
    for (let i = 0; i < n; i++) {
      const r = rng.range(radius[0], radius[1]);
      const span = halfHeightAt(z) * 2 + r * 4;
      clusters.push({
        members: [{ offset: [0, 0, 0], radius: r, bubbles: [] }],
        bonds: [],
        center: [cx + rng.range(-0.75, 0.75), cy + rng.range(-0.75, 0.75) + rng.range(-span / 2, span / 2) * 0.12, z],
        ...driftFor(rng, r * 2, [0.08, 0.16]),
        ...spin(rng, [1]),
        layer,
        rise: rng.range(0.016, 0.03),
        filmThickness: rng.range(180, 560),
      });
    }
  };
  cluster('mid', 0.6, -0.3, 0.2, 5, [0.42, 0.82]);
  for (let i = 0; i < 3; i++) add('front', rng.range(2.6, 4.2), rng.range(0.34, 0.6));
  for (let i = 0; i < 5; i++) add('back', rng.range(-6.0, -1.2), rng.range(0.3, 0.56));
  return { clusters, blobs: [] };
};

// ---------------------------------------------------------------------------
// Look 6 -- Golden Oil Cluster
// ---------------------------------------------------------------------------

/**
 * Packing is what separates this look from look 2. The spheres must be in
 * contact with no background between them, so the back layer is laid out on a
 * jittered hex lattice sized to tile the frustum at its depth -- coverage is
 * solved at build time rather than hoped for.
 */
const buildOil = (rng: Rng): SceneBuild => {
  const clusters: Cluster[] = [];

  const addSphere = (layer: Layer, x: number, y: number, z: number, radius: number, bubbleCount: [number, number]) => {
    clusters.push({
      members: [{ offset: [0, 0, 0], radius, bubbles: innerBubbles(rng, radius, bubbleCount, [0.018, 0.042]) }],
      bonds: [],
      center: [x, y, z],
      // Packed spheres cannot drift far without interpenetrating, so the
      // amplitudes here are a fraction of the other looks'. The rotation
      // carries the movement: refraction through a turning sphere changes
      // dramatically even when the sphere barely moves.
      ...driftFor(rng, radius * 2, [0.03, 0.05]),
      ...spin(rng, [1]),
      layer,
    });
  };

  // Back layer: a jittered hex lattice that tiles the frustum at z, with
  // enough overlap that no gap can open up.
  const backZ = -1.6;
  const backRadius = 1.62;
  const stepX = backRadius * 1.55;
  const stepY = backRadius * 1.34;
  const hw = halfWidthAt(backZ) + backRadius;
  const hh = halfHeightAt(backZ) + backRadius;
  const cols = Math.ceil((hw * 2) / stepX) + 1;
  const rows = Math.ceil((hh * 2) / stepY) + 1;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = -hw + col * stepX + (row % 2 === 0 ? 0 : stepX * 0.5) + rng.range(-0.06, 0.06);
      const y = -hh + row * stepY + rng.range(-0.06, 0.06);
      addSphere('back', x, y, backZ + rng.range(-0.3, 0.3), backRadius * rng.range(1.0, 1.14), [1, 3]);
      // Falls off from a hot spot slightly above centre, so the mass behind
      // the hero spheres is a gradient rather than a flat panel.
      const nx = (x - 0.6) / hw;
      const ny = (y - 0.5) / hh;
      const falloff = Math.max(0, 1 - Math.hypot(nx * 0.85, ny) * 0.92);
      clusters[clusters.length - 1].tintScale = 0.34 + 1.5 * falloff * falloff;
    }
  }

  // Mid and front layers: fewer, larger, jammed against each other so the
  // foreground spheres refract their neighbours edge-on into dark ovals.
  const placed: { x: number; y: number; z: number; r: number }[] = [];
  const tryPlace = (layer: Layer, z: number, radius: number, attempts: number) => {
    const phw = halfWidthAt(z);
    const phh = halfHeightAt(z);
    for (let i = 0; i < attempts; i++) {
      const x = rng.range(-phw * 1.12, phw * 1.12);
      const y = rng.range(-phh * 1.12, phh * 1.12);
      // In contact: centres closer than the sum of radii, but not concentric.
      const ok = placed.every((p) => {
        const d = Math.hypot(p.x - x, p.y - y);
        return d > (p.r + radius) * 0.52;
      });
      if (ok) {
        placed.push({ x, y, z, r: radius });
        addSphere(layer, x, y, z, radius, [2, 6]);
        return;
      }
    }
  };
  for (let i = 0; i < 14; i++) tryPlace('mid', rng.range(0.2, 1.3), rng.range(1.5, 2.0), 50);
  for (let i = 0; i < 7; i++) tryPlace('front', rng.range(2.4, 3.6), rng.range(1.7, 2.3), 50);

  return { clusters, blobs: [] };
};

const BUILDERS: Record<GeometryMode, (rng: Rng) => SceneBuild> = {
  molecule: buildMolecule,
  giant: buildGiant,
  blob: buildBlob,
  field: buildField,
  iridescent: buildIridescent,
  oil: buildOil,
};

const cache = new Map<number, SceneBuild>();

/**
 * Built once per geometry seed and shared by every colourway of that look, so
 * colour variants are guaranteed to have identical geometry and motion.
 */
export const buildScene = (row: LookRow): SceneBuild => {
  const existing = cache.get(row.geometrySeed);
  if (existing) return existing;
  const built = BUILDERS[row.mode](new Rng(row.geometrySeed));
  cache.set(row.geometrySeed, built);
  return built;
};
