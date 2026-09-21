// Build-time geometry. Everything here runs once per look, at module scope.

import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { makeNoise3D, fbm } from "./noise";
import type { SpikeArchetype } from "../data/types";

/**
 * A unit-radius icosphere, displaced by noise and carrying an `aMottle`
 * attribute in [0,1] that the core material ramps into a colour multiplier.
 *
 * The sphere is indexed before displacing so `computeVertexNormals` produces
 * smooth normals — on the non-indexed geometry three hands back, it would
 * give per-face normals and the silhouette would read as faceted.
 */
export const buildCoreGeometry = (opts: {
  detail: number;
  displace: number;
  displaceFreq: number;
  mottleFreq: number;
  seed: number;
}): THREE.BufferGeometry => {
  const { detail, displace, displaceFreq, mottleFreq, seed } = opts;

  const base = new THREE.IcosahedronGeometry(1, detail);
  const geo = mergeVertices(base, 1e-5);
  base.dispose();

  const noise = makeNoise3D(seed);
  const mottleNoise = makeNoise3D(seed ^ 0x9e3779b9);

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const count = pos.count;
  const mottle = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    // Displacement rides on 3 octaves so the surface has both broad dents and
    // fine pitting rather than one smooth wobble.
    const d = fbm(noise, x * displaceFreq, y * displaceFreq, z * displaceFreq, 3);
    const s = 1 + displace * d;
    pos.setXYZ(i, x * s, y * s, z * s);

    const m = fbm(
      mottleNoise,
      x * mottleFreq,
      y * mottleFreq,
      z * mottleFreq,
      4,
    );
    mottle[i] = Math.min(1, Math.max(0, m * 0.5 + 0.5));
  }

  pos.needsUpdate = true;
  geo.setAttribute("aMottle", new THREE.BufferAttribute(mottle, 1));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
};

export interface SpikeParts {
  /** Null for archetypes with no stalk. */
  stalk: THREE.BufferGeometry | null;
  cap: THREE.BufferGeometry;
  /** Tip height in core-radius units, used to seat the spike. */
  height: number;
}

/** An archetype before the per-look stalk/cap scaling is applied. */
interface RawSpike {
  stalk: THREE.BufferGeometry | null;
  /** Stalk length, and therefore where the cap's base sits. */
  stalkHeight: number;
  /** Cap geometry with its base at the origin, so it can be moved and scaled. */
  cap: THREE.BufferGeometry;
  capHeight: number;
}

const cyl = (
  rTop: number,
  rBottom: number,
  h: number,
  radial: number,
): THREE.BufferGeometry => {
  const g = new THREE.CylinderGeometry(rTop, rBottom, h, radial, 1, false);
  g.translate(0, h / 2, 0);
  return g;
};

const sphereAt = (
  r: number,
  x: number,
  y: number,
  z: number,
  seg = 12,
): THREE.BufferGeometry => {
  const g = new THREE.SphereGeometry(r, seg, Math.max(6, seg >> 1));
  g.translate(x, y, z);
  return g;
};

/**
 * A surface of revolution from a 2D profile, used for the shapes a primitive
 * can't give: the teardrop cap and the dished trumpet mouth.
 */
const lathe = (
  profile: [number, number][],
  segments: number,
): THREE.BufferGeometry => {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(1e-4, r), y));
  const g = new THREE.LatheGeometry(pts, segments);
  g.computeVertexNormals();
  return g;
};

/**
 * The five archetypes. Proportions are fractions of core radius; the data row
 * scales them per look. Caps are built with their base at the origin so
 * `stalkScale` can shorten the stalk and bring the cap down with it — that is
 * what turns the trumpet into look 9's stubby nub.
 */
const rawSpike = (archetype: SpikeArchetype): RawSpike => {
  switch (archetype) {
    case "stalk-knob":
      return {
        stalk: cyl(0.021, 0.027, 0.36, 7),
        stalkHeight: 0.36,
        cap: sphereAt(0.055, 0, 0.032, 0, 12),
        capHeight: 0.087,
      };

    case "club": {
      // Swells above the stalk and rounds off, rather than sitting on it as a
      // sphere. Seen end-on it still reads as a modelled knob with shading,
      // where a bare sphere flattens into a painted dot.
      const cap = lathe(
        [
          [0.026, 0.0],
          [0.052, 0.016],
          [0.076, 0.042],
          [0.086, 0.072],
          [0.082, 0.104],
          [0.06, 0.13],
          [0.026, 0.147],
          [0.0005, 0.153],
        ],
        16,
      );
      return { stalk: cyl(0.021, 0.028, 0.26, 8), stalkHeight: 0.26, cap, capHeight: 0.155 };
    }

    case "stalk-teardrop": {
      // Wide at the outer end, tapering back to the stalk: the heart-shaped
      // cap that carries look 7.
      const cap = lathe(
        [
          [0.004, 0.0],
          [0.042, 0.011],
          [0.070, 0.026],
          [0.080, 0.045],
          [0.072, 0.064],
          [0.046, 0.080],
          [0.018, 0.090],
          [0.0005, 0.094],
        ],
        16,
      );
      return { stalk: cyl(0.009, 0.012, 0.38, 7), stalkHeight: 0.38, cap, capHeight: 0.095 };
    }

    case "cluster": {
      // Overlapping spheres of varied size — the broccoli-floret knot. Offsets
      // are fixed constants, not random draws, so the geometry is identical
      // on every run.
      const lobes: [number, number, number, number][] = [
        [0.068, 0.0, 0.062, 0.0],
        [0.055, 0.055, 0.036, 0.02],
        [0.052, -0.043, 0.04, -0.04],
        [0.048, 0.028, 0.03, -0.054],
        [0.045, -0.05, 0.026, 0.045],
        [0.046, 0.01, 0.108, 0.005],
        [0.038, -0.03, 0.095, -0.03],
      ];
      const cap = mergeGeometries(
        lobes.map(([r, x, y, z]) => sphereAt(r, x, y, z, 10)),
        false,
      ) as THREE.BufferGeometry;
      return { stalk: cyl(0.028, 0.038, 0.185, 7), stalkHeight: 0.185, cap, capHeight: 0.17 };
    }

    case "mushroom": {
      const cap = lathe(
        [
          [0.008, 0.0],
          [0.05, 0.012],
          [0.086, 0.036],
          [0.1, 0.066],
          [0.094, 0.092],
          [0.06, 0.105],
          [0.0005, 0.108],
        ],
        16,
      );
      return { stalk: cyl(0.032, 0.04, 0.17, 8), stalkHeight: 0.17, cap, capHeight: 0.11 };
    }

    case "trumpet": {
      // Flares outward and dishes slightly at the mouth.
      const cap = lathe(
        [
          [0.026, 0.0],
          [0.038, 0.028],
          [0.064, 0.062],
          [0.092, 0.098],
          [0.101, 0.118],
          [0.086, 0.112],
          [0.062, 0.09],
          [0.038, 0.072],
          [0.018, 0.062],
          [0.0005, 0.058],
        ],
        16,
      );
      return { stalk: cyl(0.029, 0.037, 0.14, 8), stalkHeight: 0.14, cap, capHeight: 0.125 };
    }

    case "stub-cone": {
      const g = new THREE.ConeGeometry(0.098, 0.2, 9, 1);
      g.translate(0, 0.1, 0);
      return { stalk: null, stalkHeight: 0, cap: g, capHeight: 0.2 };
    }
  }
};

/**
 * Applies the look's stalk and cap scaling and seats the cap on top of the
 * (possibly shortened) stalk.
 */
export const buildSpikeParts = (
  archetype: SpikeArchetype,
  stalkScale = 1,
  capScale = 1,
): SpikeParts => {
  const raw = rawSpike(archetype);

  let stalk: THREE.BufferGeometry | null = null;
  if (raw.stalk && stalkScale > 0.001) {
    stalk = raw.stalk.clone();
    stalk.scale(1, stalkScale, 1);
  }
  const seatY = raw.stalkHeight * (raw.stalk ? stalkScale : 1);

  const cap = raw.cap.clone();
  cap.scale(capScale, capScale, capScale);
  cap.translate(0, seatY, 0);

  return { stalk, cap, height: seatY + raw.capHeight * capScale };
};

/**
 * Golden-angle spiral on the sphere. Even but not gridded, and fully
 * deterministic — no RNG involved.
 */
export const fibonacciSphere = (n: number): THREE.Vector3[] => {
  const out: THREE.Vector3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = n === 1 ? 0 : 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = i * golden;
    out.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r));
  }
  return out;
};

/**
 * How far the displaced surface sits from the centre along `dir`, so spikes
 * can be seated on the real surface instead of the undisplaced unit sphere.
 * Without this, spikes on a dented area float clear of the core.
 */
export const makeSurfaceRadius = (opts: {
  displace: number;
  displaceFreq: number;
  seed: number;
}) => {
  const noise = makeNoise3D(opts.seed);
  return (dir: THREE.Vector3): number => {
    const d = fbm(
      noise,
      dir.x * opts.displaceFreq,
      dir.y * opts.displaceFreq,
      dir.z * opts.displaceFreq,
      3,
    );
    return 1 + opts.displace * d;
  };
};
