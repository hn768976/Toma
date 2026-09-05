import * as THREE from "three";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import { duneHeight, FIELD_PERIOD } from "./field";
import { mulberry32 } from "./random";
import {
  CORNER_SLOPE,
  G_FAR,
  G_NEAR,
  HALF_WIDTH,
  PARTICLE_COUNT,
  SAMPLER_SEGMENTS_X,
  SAMPLER_SEGMENTS_Z,
} from "./constants";

// ---------------------------------------------------------------------------
// Particles are scattered once, here, at module scope. Re-sampling per frame
// would be far too slow and, worse, would make the whole field crawl with
// flicker as every grain landed somewhere new.
//
// Sampling happens over the *displaced* dune surface via MeshSurfaceSampler,
// so density follows true surface area: steep flanks get proportionally more
// grains than they would from a flat-plane scatter, and the skin stays even.
//
// That weighting keeps holding for the whole 15s, which is not obvious. A
// particle's world position never changes -- the camera moves past it -- and
// when a particle falls off the near edge it is pushed back exactly one
// FIELD_PERIOD, where the tiling field is identical. So each grain sits on the
// same patch of terrain for the entire loop.
// ---------------------------------------------------------------------------

/**
 * Stored in three's own `position` attribute as (world x, 0, -g0), where g0 is
 * the ground distance ahead of the camera at t=0. Reusing `position` rather
 * than adding a custom attribute keeps three's draw-count bookkeeping happy
 * and saves a second buffer; the shader reads the height back out of the
 * field, so the y slot carries nothing.
 */
export type DuneParticles = {
  readonly positions: Float32Array;
  /** x: fuzz height 0..1, y: size jitter, z: shimmer phase, w: shimmer draw. */
  readonly rand: Float32Array;
  readonly count: number;
};

const buildSurfaceMesh = () => {
  const nx = SAMPLER_SEGMENTS_X + 1;
  const nz = SAMPLER_SEGMENTS_Z + 1;
  const positions = new Float32Array(nx * nz * 3);

  for (let j = 0; j < nz; j++) {
    const g = G_NEAR + (FIELD_PERIOD * j) / SAMPLER_SEGMENTS_Z;
    for (let i = 0; i < nx; i++) {
      const x = -HALF_WIDTH + (2 * HALF_WIDTH * i) / SAMPLER_SEGMENTS_X;
      const o = (j * nx + i) * 3;
      positions[o] = x;
      // World z of this column is fixed at -g; see the note above.
      positions[o + 1] = duneHeight(x, -g, 0);
      positions[o + 2] = -g;
    }
  }

  const indices = new Uint32Array(SAMPLER_SEGMENTS_X * SAMPLER_SEGMENTS_Z * 6);
  let k = 0;
  for (let j = 0; j < SAMPLER_SEGMENTS_Z; j++) {
    for (let i = 0; i < SAMPLER_SEGMENTS_X; i++) {
      const a = j * nx + i;
      const b = a + 1;
      const c = a + nx;
      const d = c + 1;
      // Counter-clockwise seen from above, so the surface faces up and
      // survives backface culling.
      indices[k++] = a;
      indices[k++] = b;
      indices[k++] = c;
      indices[k++] = b;
      indices[k++] = d;
      indices[k++] = c;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  return new THREE.Mesh(geometry);
};

const buildParticles = (): DuneParticles => {
  const mesh = buildSurfaceMesh();
  const rand = mulberry32(0x5eed_d17e);
  // The sampler defaults to Math.random(); give it the seeded stream instead
  // so every value below depends only on the particle index. three ships
  // setRandomGenerator at runtime but @types/three 0.171 has not caught up.
  const sampler = (
    new MeshSurfaceSampler(mesh) as MeshSurfaceSampler & {
      setRandomGenerator: (fn: () => number) => MeshSurfaceSampler;
    }
  )
    .setRandomGenerator(rand)
    .build();

  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const randAttr = new Float32Array(PARTICLE_COUNT * 4);
  const p = new THREE.Vector3();

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    sampler.sample(p);
    positions[i * 3] = p.x;
    positions[i * 3 + 2] = p.z; // -g0
    const o = i * 4;
    randAttr[o] = rand();
    randAttr[o + 1] = rand();
    randAttr[o + 2] = rand();
    randAttr[o + 3] = rand();
  }

  mesh.geometry.dispose();
  return { positions, rand: randAttr, count: PARTICLE_COUNT };
};

let cached: DuneParticles | null = null;

/** Built on first use and reused for every frame this worker renders. */
export const getDuneParticles = (): DuneParticles => {
  cached ??= buildParticles();
  return cached;
};

/**
 * Lattice for the occluder surface: a solid, background-coloured shell that
 * writes depth so near crests genuinely hide the dunes behind them. It is
 * camera-static (the terrain slides through it) and spans exactly one
 * FIELD_PERIOD, so it never needs to wrap.
 *
 * Built as a fan aligned to the frustum rather than a plain grid: each row is
 * only as wide as the frame is at that distance, so screen-space resolution is
 * roughly constant instead of collapsing to a few huge triangles near the
 * camera -- which is exactly where a faceted silhouette would cut visibly
 * across the particle field.
 */
export const buildOccluderGeometry = (segX: number, segZ: number) => {
  const nx = segX + 1;
  const nz = segZ + 1;
  const positions = new Float32Array(nx * nz * 3);
  for (let j = 0; j < nz; j++) {
    // Rows packed toward the camera, where the ground races away fastest.
    const g = G_NEAR + (G_FAR - G_NEAR) * Math.pow(j / segZ, 1.7);
    const halfWidth = Math.min(g * CORNER_SLOPE * 1.06, HALF_WIDTH);
    for (let i = 0; i < nx; i++) {
      const o = (j * nx + i) * 3;
      positions[o] = -halfWidth + (2 * halfWidth * i) / segX;
      positions[o + 1] = 0; // displaced in the vertex shader
      positions[o + 2] = -g;
    }
  }
  const indices = new Uint32Array(segX * segZ * 6);
  let k = 0;
  for (let j = 0; j < segZ; j++) {
    for (let i = 0; i < segX; i++) {
      const a = j * nx + i;
      const b = a + 1;
      const c = a + nx;
      const d = c + 1;
      // Counter-clockwise seen from above, so the surface faces up and
      // survives backface culling.
      indices[k++] = a;
      indices[k++] = b;
      indices[k++] = c;
      indices[k++] = b;
      indices[k++] = d;
      indices[k++] = c;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  return geometry;
};
