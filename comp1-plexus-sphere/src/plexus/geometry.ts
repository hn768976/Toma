// Deterministic geometry for the plexus sphere: vertices on a sphere,
// triangulated via a brute-force 3D convex hull, plus free-floating dust.

export type Vec3 = [number, number, number];

// Loop-safe drift: integer harmonics of the clip length, so every point
// returns exactly to its start on the last frame → seamless loop.
export type Wobble = { amp: Vec3; phase: Vec3; k: [number, number, number] };

export type PlexusNode = {
  p: Vec3; // unit-sphere position (radius ~1)
  size: number; // relative dot radius multiplier
  wob: Wobble;
};

export type PlexusEdge = {
  a: number;
  b: number;
  weight: number; // 0..1 relative line strength
};

export type Dust = {
  p: Vec3;
  size: number;
  wob: Wobble;
};

export type PlexusGeometry = {
  nodes: PlexusNode[];
  edges: PlexusEdge[];
  dust: Dust[];
};

// Mulberry32 seeded PRNG — fully deterministic across renders/threads.
export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const randomUnit = (rnd: () => number): Vec3 => {
  const z = rnd() * 2 - 1;
  const phi = rnd() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return [r * Math.cos(phi), r * Math.sin(phi), z];
};

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

// Poisson-disk style rejection sampling on the sphere gives the
// irregular-but-even triangle sizes seen in the reference.
const sampleSphere = (rnd: () => number, count: number, minAngle: number) => {
  const pts: Vec3[] = [];
  const minDot = Math.cos(minAngle);
  let guard = 0;
  while (pts.length < count && guard < 200000) {
    guard++;
    const c = randomUnit(rnd);
    let ok = true;
    for (const p of pts) {
      if (dot(p, c) > minDot) {
        ok = false;
        break;
      }
    }
    if (ok) pts.push(c);
  }
  return pts;
};

// Brute-force convex hull: every triple whose plane has all other points
// on one side is a hull face. For points on a sphere this is the
// spherical Delaunay triangulation. O(n^4) but n≈100 → instant.
const hullEdges = (pts: Vec3[]) => {
  const n = pts.length;
  const set = new Set<string>();
  const eps = 1e-9;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        const nrm = cross(sub(pts[j], pts[i]), sub(pts[k], pts[i]));
        let pos = false;
        let neg = false;
        for (let m = 0; m < n; m++) {
          if (m === i || m === j || m === k) continue;
          const d = dot(nrm, sub(pts[m], pts[i]));
          if (d > eps) pos = true;
          else if (d < -eps) neg = true;
          if (pos && neg) break;
        }
        if (!(pos && neg)) {
          set.add(`${i}-${j}`);
          set.add(`${i}-${k}`);
          set.add(`${j}-${k}`);
        }
      }
    }
  }
  return [...set].map((s) => s.split("-").map(Number) as [number, number]);
};

const makeWobble = (rnd: () => number, amp: number): Wobble => ({
  amp: [(rnd() * 2 - 1) * amp, (rnd() * 2 - 1) * amp, (rnd() * 2 - 1) * amp],
  phase: [rnd() * Math.PI * 2, rnd() * Math.PI * 2, rnd() * Math.PI * 2],
  k: [1 + Math.floor(rnd() * 3), 1 + Math.floor(rnd() * 3), 1 + Math.floor(rnd() * 3)],
});

// Displace a point by its wobble at loop phase t (0..1).
export const wobbleAt = (p: Vec3, w: Wobble, t: number): Vec3 => [
  p[0] + w.amp[0] * Math.sin(Math.PI * 2 * w.k[0] * t + w.phase[0]),
  p[1] + w.amp[1] * Math.sin(Math.PI * 2 * w.k[1] * t + w.phase[1]),
  p[2] + w.amp[2] * Math.sin(Math.PI * 2 * w.k[2] * t + w.phase[2]),
];

export const buildGeometry = (seed: number): PlexusGeometry => {
  const rnd = mulberry32(seed);
  const wrnd = mulberry32(seed ^ 0x5bd1e995);
  const verts = sampleSphere(rnd, 58, 0.31);

  const nodes: PlexusNode[] = verts.map((p) => {
    const r = rnd();
    // Mostly small/medium vertices with a few heavy "hub" dots.
    const size = r < 0.2 ? 1.7 + rnd() * 0.45 : r < 0.75 ? 1.15 + rnd() * 0.5 : 0.8 + rnd() * 0.3;
    // Slight radial jitter so the hull is not a perfect geodesic.
    const s = 1 + (rnd() - 0.5) * 0.04;
    return { p: [p[0] * s, p[1] * s, p[2] * s], size, wob: makeWobble(wrnd, 0.045) };
  });

  const edges: PlexusEdge[] = hullEdges(verts).map(([a, b]) => ({
    a,
    b,
    weight: 0.55 + rnd() * 0.45,
  }));

  const dust: Dust[] = [];
  for (let i = 0; i < 150; i++) {
    const u = randomUnit(rnd);
    const shell = rnd();
    // ~55% hug the outer shell (forming the soft halo seen at the
    // silhouette), the rest float inside the volume.
    const rad = shell < 0.75 ? 0.99 + rnd() * 0.16 : Math.cbrt(rnd()) * 0.95;
    const size = 0.65 + rnd() * 0.55;
    const wob = makeWobble(wrnd, 0.03);
    dust.push({ p: [u[0] * rad, u[1] * rad, u[2] * rad], size, wob });
    // Occasional tight pairs of dust (visible in the reference).
    if (rnd() < 0.12) {
      const o = 0.018 + rnd() * 0.02;
      dust.push({
        p: [u[0] * rad + o, u[1] * rad + (rnd() - 0.5) * o, u[2] * rad],
        size: size * 0.8,
        wob,
      });
    }
  }

  return { nodes, edges, dust };
};
