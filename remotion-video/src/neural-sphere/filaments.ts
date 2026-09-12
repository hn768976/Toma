import * as THREE from "three";
import {
  FILAMENT_COUNT,
  FILAMENT_MAX_LENGTH,
  FILAMENT_MIN_LENGTH,
  FILAMENT_SAMPLES,
  FILAMENT_START_RADIUS,
} from "./constants";
import { mulberry32 } from "./random";

export type FilamentData = {
  /** xyz per sample, filament-major: [f0s0, f0s1, ... f1s0, ...]. */
  samples: Float32Array;
  /** Per-filament brightness multiplier. */
  brightness: Float32Array;
  count: number;
  samplesPerFilament: number;
};

/** Uniformly distributed point on the unit sphere. */
const randomDirection = (rand: () => number, out: THREE.Vector3) => {
  const z = rand() * 2 - 1;
  const phi = rand() * Math.PI * 2;
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return out.set(r * Math.cos(phi), r * Math.sin(phi), z);
};

/**
 * Grows each filament by walking outward from the core: start pointing
 * straight out along a random radial direction, then bend the heading a
 * little on every step. The bend strength ramps up with distance, which is
 * what gives the reference look — tendrils leave the core as a tight
 * radial starburst and only start curling and looping once they are well
 * clear of it.
 *
 * Deterministic: every value derives from the filament index through a
 * seeded PRNG, never Math.random(), because Remotion renders frames out of
 * order across workers.
 */
export const buildFilaments = (seed = 1): FilamentData => {
  const samples = new Float32Array(FILAMENT_COUNT * FILAMENT_SAMPLES * 3);
  const brightness = new Float32Array(FILAMENT_COUNT);

  const dir = new THREE.Vector3();
  const heading = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const axisA = new THREE.Vector3();
  const axisB = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const perp = new THREE.Vector3();

  for (let f = 0; f < FILAMENT_COUNT; f++) {
    const rand = mulberry32(f * 7919 + seed * 104729 + 17);

    randomDirection(rand, dir);
    randomDirection(rand, axisA);
    randomDirection(rand, axisB);

    // Heavily biased toward short filaments. That distribution is what
    // builds the dense fuzzy corona hugging the core in the reference,
    // with only a handful of strands running right out of frame.
    const lengthMix = Math.pow(rand(), 2.3);
    const length =
      FILAMENT_MIN_LENGTH + (FILAMENT_MAX_LENGTH - FILAMENT_MIN_LENGTH) * lengthMix;

    // How hard this filament curls, and how fast its turning plane spins
    // (the spin is what makes some of them corkscrew rather than arc).
    // Never let a strand run dead straight: a perfectly straight 3D
    // curve that turns toward the camera projects to a hard V-shaped
    // cusp, which reads as a polygon edge rather than as a filament.
    const curl = 0.020 + rand() * 0.060;
    const twist = 0.4 + rand() * 4.2;
    const twistPhase = rand() * Math.PI * 2;

    brightness[f] = 0.32 + Math.pow(rand(), 1.7) * 1.05;

    // Stagger where each strand leaves the core. Starting them all at
    // exactly the same radius reads as a dandelion; a little scatter
    // keeps the origin looking tangled.
    const startRadius = FILAMENT_START_RADIUS * (1 + rand() * 1.6);

    heading.copy(dir);
    pos.copy(dir).multiplyScalar(startRadius);

    const base = f * FILAMENT_SAMPLES * 3;
    for (let s = 0; s < FILAMENT_SAMPLES; s++) {
      samples[base + s * 3 + 0] = pos.x;
      samples[base + s * 3 + 1] = pos.y;
      samples[base + s * 3 + 2] = pos.z;

      if (s === FILAMENT_SAMPLES - 1) break;

      const t = s / (FILAMENT_SAMPLES - 1);

      // Steps lengthen mildly as we move out, so samples still bunch up
      // near the core where curvature detail matters — but not so much
      // that the outer half becomes coarse straight chords.
      const step = (length / (FILAMENT_SAMPLES - 1)) * (0.5 + 1.0 * t);

      // Turning plane rotates along the filament.
      const angle = twistPhase + twist * t * Math.PI * 2;
      axis
        .copy(axisA)
        .multiplyScalar(Math.cos(angle))
        .addScaledVector(axisB, Math.sin(angle))
        .normalize();

      perp.copy(axis).cross(heading);
      if (perp.lengthSq() < 1e-8) {
        perp.set(heading.y, -heading.x, heading.z);
      }
      perp.normalize();

      // Curl ramps in quadratically: near-straight at the core, loose and
      // wandering at the tips.
      heading.addScaledVector(perp, curl * (0.1 + t * t * 3.2)).normalize();
      pos.addScaledVector(heading, step);
    }
  }

  return {
    samples,
    brightness,
    count: FILAMENT_COUNT,
    samplesPerFilament: FILAMENT_SAMPLES,
  };
};

/**
 * Bakes the filament samples into an RGBA float texture (one row per
 * filament, one texel per sample) so the travelling-node shader can look
 * up a position anywhere along a curve without any CPU work per frame.
 */
export const buildCurveTexture = (data: FilamentData): THREE.DataTexture => {
  const { count, samplesPerFilament, samples } = data;
  const rgba = new Float32Array(count * samplesPerFilament * 4);
  for (let i = 0; i < count * samplesPerFilament; i++) {
    rgba[i * 4 + 0] = samples[i * 3 + 0];
    rgba[i * 4 + 1] = samples[i * 3 + 1];
    rgba[i * 4 + 2] = samples[i * 3 + 2];
    rgba[i * 4 + 3] = 1;
  }
  const texture = new THREE.DataTexture(
    rgba,
    samplesPerFilament,
    count,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  // Nearest sampling + a manual lerp in the shader: linear filtering of
  // float textures needs an extension that isn't guaranteed everywhere.
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
};

/**
 * Builds the ribbon geometry for the filaments: two vertices per sample,
 * offset to either side of the curve in *screen space* by the vertex
 * shader. Plain GL lines can't go above 1px reliably, so the tendrils are
 * camera-facing strips instead.
 */
export const buildFilamentGeometry = (data: FilamentData): THREE.BufferGeometry => {
  const { count, samplesPerFilament, samples, brightness } = data;
  const vertsPerFilament = samplesPerFilament * 2;
  const totalVerts = count * vertsPerFilament;

  const position = new Float32Array(totalVerts * 3);
  const next = new Float32Array(totalVerts * 3);
  const side = new Float32Array(totalVerts);
  const along = new Float32Array(totalVerts);
  const bright = new Float32Array(totalVerts);
  const filamentId = new Float32Array(totalVerts);
  const indices: number[] = [];

  for (let f = 0; f < count; f++) {
    const sBase = f * samplesPerFilament * 3;
    const vBase = f * vertsPerFilament;

    for (let s = 0; s < samplesPerFilament; s++) {
      const px = samples[sBase + s * 3 + 0];
      const py = samples[sBase + s * 3 + 1];
      const pz = samples[sBase + s * 3 + 2];

      // The last sample has no successor, so extrapolate one so its screen
      // -space tangent (and therefore its width) stays well-defined.
      const ns = Math.min(s + 1, samplesPerFilament - 1);
      let nx = samples[sBase + ns * 3 + 0];
      let ny = samples[sBase + ns * 3 + 1];
      let nz = samples[sBase + ns * 3 + 2];
      if (ns === s) {
        const ps = s - 1;
        nx = px * 2 - samples[sBase + ps * 3 + 0];
        ny = py * 2 - samples[sBase + ps * 3 + 1];
        nz = pz * 2 - samples[sBase + ps * 3 + 2];
      }

      const t = s / (samplesPerFilament - 1);
      for (let k = 0; k < 2; k++) {
        const v = vBase + s * 2 + k;
        position[v * 3 + 0] = px;
        position[v * 3 + 1] = py;
        position[v * 3 + 2] = pz;
        next[v * 3 + 0] = nx;
        next[v * 3 + 1] = ny;
        next[v * 3 + 2] = nz;
        side[v] = k === 0 ? -1 : 1;
        along[v] = t;
        bright[v] = brightness[f];
        filamentId[v] = f;
      }

      if (s < samplesPerFilament - 1) {
        const a = vBase + s * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("aNext", new THREE.BufferAttribute(next, 3));
  geometry.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
  geometry.setAttribute("aAlong", new THREE.BufferAttribute(along, 1));
  geometry.setAttribute("aBright", new THREE.BufferAttribute(bright, 1));
  geometry.setAttribute("aFilament", new THREE.BufferAttribute(filamentId, 1));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  // The shader pushes vertices around in screen space; give the culler a
  // generous bound so nothing pops out at the frame edges.
  if (geometry.boundingSphere) geometry.boundingSphere.radius *= 1.5;
  return geometry;
};
