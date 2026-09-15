import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { staticFile } from "remotion";
import { mulberry32 } from "./random";

export type ModelName = "dna" | "molecule";

const URLS: Record<ModelName, string> = {
  dna: staticFile("models/dna.glb"),
  molecule: staticFile("models/molecule.glb"),
};

/**
 * The supplied GLBs contain a single un-materialed mesh each (POSITION /
 * NORMAL / TEXCOORD_0 only). We never touch the vertex data: we read the
 * geometry once, centre it and normalise its scale so every composition can
 * reason in the same units, then attach our own materials per version.
 */
const geometryCache = new Map<ModelName, Promise<THREE.BufferGeometry>>();

const loadGeometry = (name: ModelName): Promise<THREE.BufferGeometry> => {
  const hit = geometryCache.get(name);
  if (hit) return hit;

  const promise = new Promise<THREE.BufferGeometry>((resolve, reject) => {
    new GLTFLoader().load(
      URLS[name],
      (gltf) => {
        let found: THREE.BufferGeometry | null = null;
        gltf.scene.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (!found && mesh.isMesh) found = mesh.geometry;
        });
        if (!found) {
          reject(new Error(`No mesh found in ${name}.glb`));
          return;
        }
        const geo = (found as THREE.BufferGeometry).clone();
        geo.computeBoundingBox();
        const box = geo.boundingBox as THREE.Box3;
        const centre = box.getCenter(new THREE.Vector3());
        // Centre on the origin so rotations happen about the model's middle.
        geo.translate(-centre.x, -centre.y, -centre.z);
        // Normalise so the model's longest axis is exactly 2 units.
        const size = box.getSize(new THREE.Vector3());
        const longest = Math.max(size.x, size.y, size.z);
        geo.scale(2 / longest, 2 / longest, 2 / longest);
        geo.computeBoundingBox();
        geo.computeBoundingSphere();
        if (!geo.attributes.normal) geo.computeVertexNormals();
        resolve(geo);
      },
      undefined,
      (err) => reject(err as Error),
    );
  });

  geometryCache.set(name, promise);
  return promise;
};

export type SampledCloud = {
  positions: Float32Array;
  normals: Float32Array;
  /** Stable 0..1 value per point, for per-particle phase offsets. */
  seeds: Float32Array;
  /** Position along the model's long (X) axis, remapped to 0..1. */
  axis: Float32Array;
  count: number;
};

const cloudCache = new Map<string, SampledCloud>();

/**
 * Area-weighted surface sampling. This reads the loaded geometry and produces
 * a point cloud that sits exactly on the model's surface — the mesh itself is
 * never modified, we are only choosing a different way to draw it for the
 * particle-styled versions.
 */
export const sampleSurface = (
  geo: THREE.BufferGeometry,
  count: number,
  seed: number,
): SampledCloud => {
  const key = `${geo.uuid}:${count}:${seed}`;
  const hit = cloudCache.get(key);
  if (hit) return hit;

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const nor = geo.attributes.normal as THREE.BufferAttribute;
  const index = geo.index;
  const triCount = index ? index.count / 3 : pos.count / 3;
  const idx = (i: number) => (index ? index.getX(i) : i);

  // Cumulative triangle areas so that large triangles receive proportionally
  // more samples and the cloud reads as an even skin over the model.
  const cumulative = new Float64Array(triCount);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  let total = 0;
  for (let t = 0; t < triCount; t++) {
    a.fromBufferAttribute(pos, idx(t * 3));
    b.fromBufferAttribute(pos, idx(t * 3 + 1));
    c.fromBufferAttribute(pos, idx(t * 3 + 2));
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    total += ab.cross(ac).length() * 0.5;
    cumulative[t] = total;
  }

  const rand = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const axis = new Float32Array(count);

  const na = new THREE.Vector3();
  const nb = new THREE.Vector3();
  const nc = new THREE.Vector3();

  const pick = (target: number) => {
    let lo = 0;
    let hi = triCount - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  geo.computeBoundingBox();
  const box = geo.boundingBox as THREE.Box3;
  const spanX = Math.max(1e-6, box.max.x - box.min.x);

  for (let i = 0; i < count; i++) {
    const t = pick(rand() * total);
    let u = rand();
    let v = rand();
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    const w = 1 - u - v;
    a.fromBufferAttribute(pos, idx(t * 3));
    b.fromBufferAttribute(pos, idx(t * 3 + 1));
    c.fromBufferAttribute(pos, idx(t * 3 + 2));
    na.fromBufferAttribute(nor, idx(t * 3));
    nb.fromBufferAttribute(nor, idx(t * 3 + 1));
    nc.fromBufferAttribute(nor, idx(t * 3 + 2));

    const px = a.x * w + b.x * u + c.x * v;
    const py = a.y * w + b.y * u + c.y * v;
    const pz = a.z * w + b.z * u + c.z * v;
    positions[i * 3] = px;
    positions[i * 3 + 1] = py;
    positions[i * 3 + 2] = pz;
    normals[i * 3] = na.x * w + nb.x * u + nc.x * v;
    normals[i * 3 + 1] = na.y * w + nb.y * u + nc.y * v;
    normals[i * 3 + 2] = na.z * w + nb.z * u + nc.z * v;
    seeds[i] = rand();
    axis[i] = (px - box.min.x) / spanX;
  }

  const cloud: SampledCloud = { positions, normals, seeds, axis, count };
  cloudCache.set(key, cloud);
  return cloud;
};

const edgeCache = new Map<string, THREE.BufferGeometry>();

/** Sharp-edge line geometry, used for the neon-wireframe versions. */
export const edgesOf = (geo: THREE.BufferGeometry, thresholdAngle: number) => {
  const key = `${geo.uuid}:${thresholdAngle}`;
  const hit = edgeCache.get(key);
  if (hit) return hit;
  const edges = new THREE.EdgesGeometry(geo, thresholdAngle);
  edgeCache.set(key, edges);
  return edges;
};

export { loadGeometry };

/* ------------------------------------------------------------------ *
 * Seamless tiling
 * ------------------------------------------------------------------ */

/**
 * Length of a model along its long axis after `loadGeometry` normalises it.
 * Every model is scaled so its longest axis is exactly this, which makes it
 * the exact spacing for laying copies end to end.
 */
export const TILE_LENGTH = 2;

/**
 * The two ends of the DNA mesh are not identical — it was generated rather than
 * modelled for tiling, and one end is far denser than the other — so butting
 * copies at exactly TILE_LENGTH leaves a visible notch where the thin end meets
 * the bulky one. Copies are drawn this much closer together so the heavier end
 * closes over the lighter one. Small enough to be invisible, large enough that
 * no gap survives.
 */
export const TILE_OVERLAP = 0.12;

/**
 * The DNA model's end cross-section lands back in phase with its start — its
 * twist across the mesh is a whole turn to within measurement error — so copies
 * tile seamlessly by translation alone, with no counter-rotation. The join is
 * only invisible at *exactly* this spacing: a few percent short and the ends
 * interpenetrate into a visibly thickened seam.
 *
 * @param count  how many copies to lay end to end
 * @param scale  the scale the copies are rendered at
 * @param phase  0..1 scroll position; the run shifts by one whole tile per unit
 */
export const helixTiles = (count: number, scale = 1, phase = 0, overlap = TILE_OVERLAP) => {
  const step = (TILE_LENGTH - overlap) * scale;
  const shift = (((phase % 1) + 1) % 1) * step;
  // Centre the run on the origin so framing doesn't drift as `count` changes.
  const first = -step * ((count - 1) / 2);
  return Array.from({ length: count }, (_, i) => first + i * step - shift);
};
