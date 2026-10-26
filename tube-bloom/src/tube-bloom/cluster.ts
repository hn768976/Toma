import * as THREE from "three";

// Deterministic PRNG so every render (and every machine) builds the same cluster.
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

// A ring of identical tubes arranged around the cluster axis (+Y).
//  - "arc" clusters: free-floating C-shaped tubes (torus segments, both ends
//    cut flat), rings stacked along the axis at `y`.
//  - "hook" clusters: tubes rooted on a core (sphere, or a thin spine when
//    rings also carry `y`) at polar angle `polar`, rising along the surface
//    normal and curling over (one cut end visible).
export type RingSpec = {
  y?: number; // arc: position along the axis (+Y is the camera end)
  polar?: number; // hook: root latitude, radians from the +Y pole
  // Tubes in the ring. Each ring spins independently by exactly one tube
  // spacing (2π / count) per loop, so every ring - and the whole cluster -
  // loops seamlessly while rings with different counts drift against
  // each other.
  count: number;
  shade: number; // 0 = full colour, 1 = fully the look's `shade` colour
};

export type ClusterParams = {
  kind: "arc" | "hook";
  seed: number;
  rings: RingSpec[];
  // Per-ring random ranges (one draw per ring, shared by its tubes).
  orbit: [number, number]; // arc: distance of each arc's centre from the axis
  stemLength: [number, number]; // hook: straight run before the curl
  tubeRadius: [number, number];
  curlRadius: [number, number]; // radius of the C / the hook's bend
  sweep: [number, number]; // angular length of the curl (radians)
  // Curl plane. arc: spanned by the radial direction and a direction tilted
  // from the axis (0) towards the tangent (π/2). hook: the bend direction,
  // tilted from "towards the +Y pole" (0) towards the tangent (π/2).
  planeTilt: [number, number];
  startAngle: [number, number]; // arc: where on the circle the C begins
  // Angular offset of ring i is (i * phaseStep + jitter) tube spacings.
  // A small constant step lines rings up into helical rows of arches.
  phaseStep: number;
  phaseJitter: number;
  // hook: radius of the core the tubes grow out of.
  coreRadius: number;
  coreVisible?: boolean; // hook: render the core sphere (default true)
  coreMatte?: boolean; // hook: matte core (no highlight) so it reads as a dark mass
  // Fraction of the tube length over which the trailing end rounds off to a
  // point (0 = flat cut face). Hides roots that would otherwise show a cut.
  startTaper: number;
  radialSegments: number;
  tubularSegments: number;
};

export type ClusterColors = {
  end: THREE.Color; // colour at the leading cut end (u = 1)
  mid: THREE.Color;
  start: THREE.Color; // colour at the trailing cut end (u = 0)
  cap: THREE.Color; // flat end cap at u = 1
  startCap: THREE.Color; // flat end cap at u = 0
  shade: THREE.Color; // what distant rings fade towards
  // Gradient stops along the tube (0..1): start→mid over [g0,g1], mid→end over [g1,g2].
  gradient: [number, number, number];
};

const lerpRange = (rnd: () => number, [a, b]: [number, number]) =>
  a + (b - a) * rnd();

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / Math.max(1e-6, e1 - e0)));
  return t * t * (3 - 2 * t);
};

const gradientColor = (c: ClusterColors, u: number, out: THREE.Color) => {
  const [g0, g1, g2] = c.gradient;
  if (u < g1) {
    out.copy(c.start).lerp(c.mid, smooth(g0, g1, u));
  } else {
    out.copy(c.mid).lerp(c.end, smooth(g1, g2, u));
  }
  return out;
};

type Centerline = {
  pts: THREE.Vector3[];
  tans: THREE.Vector3[];
  w: THREE.Vector3; // normal of the (planar) centerline
  radius: number;
};

const arcCenterline = (
  center: THREE.Vector3,
  e1: THREE.Vector3,
  e2: THREE.Vector3,
  curl: number,
  start: number,
  sweep: number,
  radius: number,
  n: number,
): Centerline => {
  const pts: THREE.Vector3[] = [];
  const tans: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const a = start + (i / n) * sweep;
    pts.push(
      center
        .clone()
        .addScaledVector(e1, curl * Math.cos(a))
        .addScaledVector(e2, curl * Math.sin(a)),
    );
    tans.push(
      e1.clone().multiplyScalar(-Math.sin(a)).addScaledVector(e2, Math.cos(a)).normalize(),
    );
  }
  return { pts, tans, w: new THREE.Vector3().crossVectors(e1, e2).normalize(), radius };
};

// Straight stem along `normal` (starting buried inside the core), then a
// circular curl towards `bend`.
const hookCenterline = (
  origin: THREE.Vector3,
  normal: THREE.Vector3,
  bend: THREE.Vector3,
  stem: number,
  curl: number,
  sweep: number,
  radius: number,
  n: number,
): Centerline => {
  const pts: THREE.Vector3[] = [];
  const tans: THREE.Vector3[] = [];
  const buried = radius * 2;
  const start = origin.clone().addScaledVector(normal, -buried);
  const stemLen = stem + buried;
  const total = stemLen + curl * sweep;
  const pivot = start.clone().addScaledVector(normal, stemLen).addScaledVector(bend, curl);
  for (let i = 0; i <= n; i++) {
    const d = (i / n) * total;
    if (d <= stemLen) {
      pts.push(start.clone().addScaledVector(normal, d));
      tans.push(normal.clone());
    } else {
      const a = (d - stemLen) / curl;
      pts.push(
        pivot
          .clone()
          .addScaledVector(bend, -curl * Math.cos(a))
          .addScaledVector(normal, curl * Math.sin(a)),
      );
      tans.push(
        bend.clone().multiplyScalar(Math.sin(a)).addScaledVector(normal, Math.cos(a)).normalize(),
      );
    }
  }
  return { pts, tans, w: new THREE.Vector3().crossVectors(normal, bend).normalize(), radius };
};

const buildRingCenterlines = (p: ClusterParams): Centerline[][] => {
  const rnd = mulberry32(p.seed);
  const n = p.tubularSegments;
  return p.rings.map((ring, ringIndex) => {
    // One shape per ring (ring-to-ring variety); per-tube variety would break
    // the rotational symmetry the seamless loop relies on.
    const orbit = lerpRange(rnd, p.orbit);
    const radius = lerpRange(rnd, p.tubeRadius);
    const curl = lerpRange(rnd, p.curlRadius);
    const sweep = lerpRange(rnd, p.sweep);
    const tilt = lerpRange(rnd, p.planeTilt);
    const start = lerpRange(rnd, p.startAngle);
    const phase = ringIndex * p.phaseStep + rnd() * p.phaseJitter;
    const stem = p.kind === "hook" ? lerpRange(rnd, p.stemLength) : 0;
    const lines: Centerline[] = [];
    for (let j = 0; j < ring.count; j++) {
      const phi = ((j + phase) / ring.count) * Math.PI * 2;
      const radial = new THREE.Vector3(Math.cos(phi), 0, Math.sin(phi));
      const tangent = new THREE.Vector3(-Math.sin(phi), 0, Math.cos(phi));
      if (p.kind === "arc") {
        const e2 = new THREE.Vector3(0, 1, 0)
          .multiplyScalar(Math.cos(tilt))
          .addScaledVector(tangent, Math.sin(tilt))
          .normalize();
        const center = radial.clone().multiplyScalar(orbit).setY(ring.y ?? 0);
        lines.push(arcCenterline(center, radial, e2, curl, start, sweep, radius, n));
      } else {
        const theta = ring.polar ?? Math.PI / 2;
        const normal = radial
          .clone()
          .multiplyScalar(Math.sin(theta))
          .setY(Math.cos(theta));
        // eTheta points away from the +Y pole.
        const eTheta = radial
          .clone()
          .multiplyScalar(Math.cos(theta))
          .setY(-Math.sin(theta));
        const bend = eTheta
          .multiplyScalar(-Math.cos(tilt))
          .addScaledVector(tangent, Math.sin(tilt))
          .normalize();
        const origin = normal.clone().multiplyScalar(p.coreRadius);
        origin.y += ring.y ?? 0;
        lines.push(hookCenterline(origin, normal, bend, stem, curl, sweep, radius, n));
      }
    }
    return lines;
  });
};

// One geometry per ring so each ring can spin at its own loop-exact rate.
export const buildCluster = (
  p: ClusterParams,
  colors: ClusterColors,
): THREE.BufferGeometry[] =>
  buildRingCenterlines(p).map((lines, i) => {
    const k = p.rings[i].shade;
    const shaded: ClusterColors = {
      ...colors,
      start: colors.start.clone().lerp(colors.shade, k),
      mid: colors.mid.clone().lerp(colors.shade, k),
      end: colors.end.clone().lerp(colors.shade, k),
      cap: colors.cap.clone().lerp(colors.shade, k),
      startCap: colors.startCap.clone().lerp(colors.shade, k),
    };
    return buildTubes(lines, p, shaded);
  });

const buildTubes = (
  lines: Centerline[],
  p: ClusterParams,
  colors: ClusterColors,
): THREE.BufferGeometry => {
  const positions: number[] = [];
  const normals: number[] = [];
  const cols: number[] = [];
  const indices: number[] = [];
  const tmpC = new THREE.Color();
  const R = p.radialSegments;
  const n = p.tubularSegments;

  const addCap = (
    at: THREE.Vector3,
    facing: THREE.Vector3,
    u1: THREE.Vector3,
    u2: THREE.Vector3,
    radius: number,
    color: THREE.Color,
  ) => {
    const centerIdx = positions.length / 3;
    positions.push(at.x, at.y, at.z);
    normals.push(facing.x, facing.y, facing.z);
    cols.push(color.r, color.g, color.b);
    for (let k = 0; k < R; k++) {
      const ang = (k / R) * Math.PI * 2;
      positions.push(
        at.x + (u1.x * Math.cos(ang) + u2.x * Math.sin(ang)) * radius,
        at.y + (u1.y * Math.cos(ang) + u2.y * Math.sin(ang)) * radius,
        at.z + (u1.z * Math.cos(ang) + u2.z * Math.sin(ang)) * radius,
      );
      normals.push(facing.x, facing.y, facing.z);
      cols.push(color.r, color.g, color.b);
    }
    // Wind counter-clockwise when seen from the `facing` side.
    const ccw = new THREE.Vector3().crossVectors(u1, u2).dot(facing) > 0;
    for (let k = 0; k < R; k++) {
      const a = centerIdx + 1 + k;
      const b = centerIdx + 1 + ((k + 1) % R);
      if (ccw) indices.push(centerIdx, a, b);
      else indices.push(centerIdx, b, a);
    }
  };

  const taper = p.startTaper;
  // Elliptical round-off of the trailing end: r(u) = R * sqrt(1 - (1 - u/taper)^2).
  const profile = (u: number) =>
    taper > 0 && u < taper ? Math.sqrt(Math.max(0, 1 - (1 - u / taper) ** 2)) : 1;

  for (const { pts, tans, w, radius } of lines) {
    const base = positions.length / 3;
    let length = 0;
    for (let i = 1; i <= n; i++) length += pts[i].distanceTo(pts[i - 1]);
    for (let i = 0; i <= n; i++) {
      const t = tans[i];
      const n2 = new THREE.Vector3().crossVectors(t, w).normalize();
      gradientColor(colors, i / n, tmpC);
      const u = i / n;
      const r = radius * profile(u);
      // Surface normal tilts back along the tube where the radius changes.
      const du = 1e-3;
      const slope = (radius * (profile(Math.min(1, u + du)) - profile(Math.max(0, u - du)))) /
        (length * (Math.min(1, u + du) - Math.max(0, u - du)));
      const tilt = Math.atan(slope);
      for (let k = 0; k < R; k++) {
        const ang = (k / R) * Math.PI * 2;
        const rx = w.x * Math.cos(ang) + n2.x * Math.sin(ang);
        const ry = w.y * Math.cos(ang) + n2.y * Math.sin(ang);
        const rz = w.z * Math.cos(ang) + n2.z * Math.sin(ang);
        positions.push(pts[i].x + rx * r, pts[i].y + ry * r, pts[i].z + rz * r);
        const nx = rx * Math.cos(tilt) - t.x * Math.sin(tilt);
        const ny = ry * Math.cos(tilt) - t.y * Math.sin(tilt);
        const nz = rz * Math.cos(tilt) - t.z * Math.sin(tilt);
        normals.push(nx, ny, nz);
        cols.push(tmpC.r, tmpC.g, tmpC.b);
      }
    }
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < R; k++) {
        const a = base + i * R + k;
        const b = base + i * R + ((k + 1) % R);
        const c = base + (i + 1) * R + k;
        const d = base + (i + 1) * R + ((k + 1) % R);
        indices.push(a, b, c, b, d, c);
      }
    }
    // Flat cut faces at both ends.
    const tEnd = tans[n];
    addCap(pts[n], tEnd, w, new THREE.Vector3().crossVectors(tEnd, w).normalize(), radius, colors.cap);
    if (taper <= 0) {
      const tStart = tans[0].clone().negate();
      addCap(pts[0], tStart, w, new THREE.Vector3().crossVectors(tans[0], w).normalize(), radius, colors.startCap);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  g.setIndex(indices);
  return g;
};
