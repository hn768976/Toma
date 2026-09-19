import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { staticFile } from "remotion";
import { BOX_HEIGHT, BOX_LENGTH, BOX_WIDTH, MESH_SCALE } from "./constants";

/**
 * Container geometry at four levels of detail, all in metres and all sharing
 * one origin convention: centred in X/Z, sitting on y = 0. That lets a single
 * instance matrix be handed to whichever LOD bucket a container lands in.
 *
 * LOD0/LOD1 come from the supplied mesh (decimated offline, see
 * scripts/build-lods.mjs) and carry real modelled corrugation and door
 * hardware. LOD2/LOD3 are procedural boxes: past a certain distance the
 * corrugation is sub-pixel and modelling it only buys aliasing, while a
 * container's boxy silhouette is the thing that must stay crisp -- which is
 * exactly what aggressive mesh decimation destroys.
 */

export type LodLevel = 0 | 1 | 2 | 3;

export type ContainerLods = {
  geometries: [THREE.BufferGeometry, THREE.BufferGeometry, THREE.BufferGeometry, THREE.BufferGeometry];
  triangles: [number, number, number, number];
};

const triangleCount = (g: THREE.BufferGeometry) => {
  const idx = g.getIndex();
  return (idx ? idx.count : g.getAttribute("position").count) / 3;
};

/**
 * Puts a loaded mesh into metres with its base at the origin. The source mesh
 * is centred on its bounding box, so this is a scale followed by a lift.
 */
const normalize = (geo: THREE.BufferGeometry): THREE.BufferGeometry => {
  const g = geo.clone();
  g.scale(MESH_SCALE, MESH_SCALE, MESH_SCALE);
  g.computeBoundingBox();
  const bb = g.boundingBox!;
  g.translate(
    -(bb.min.x + bb.max.x) / 2,
    -bb.min.y,
    -(bb.min.z + bb.max.z) / 2,
  );
  if (!g.getAttribute("normal")) g.computeVertexNormals();
  return g;
};

/** Axis-aligned box spanning the container envelope, base at y = 0. */
const boxGeometry = (
  w = BOX_WIDTH,
  h = BOX_HEIGHT,
  l = BOX_LENGTH,
): THREE.BufferGeometry => {
  const g = new THREE.BoxGeometry(w, h, l);
  g.translate(0, h / 2, 0);
  return g;
};

/**
 * LOD2: the envelope plus the eight corner castings, which are what actually
 * reads at middle distance -- they break the silhouette where stacks meet and
 * give the gap between stacked units.
 */
const buildLod2 = (): THREE.BufferGeometry => {
  const parts: THREE.BufferGeometry[] = [];

  // Main body, very slightly inset so the castings proud of it catch light.
  parts.push(boxGeometry(BOX_WIDTH - 0.06, BOX_HEIGHT - 0.12, BOX_LENGTH - 0.12));

  const cast = 0.18;
  const castGeo = new THREE.BoxGeometry(cast, cast, cast);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      for (const sy of [0, 1]) {
        const c = castGeo.clone();
        c.translate(
          sx * (BOX_WIDTH / 2 - cast / 2),
          sy === 0 ? cast / 2 : BOX_HEIGHT - cast / 2,
          sz * (BOX_LENGTH / 2 - cast / 2),
        );
        parts.push(c);
      }
    }
  }
  castGeo.dispose();

  const merged = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return merged;
};

/** LOD3: silhouette only. Corrugation is carried entirely by the normal map. */
const buildLod3 = (): THREE.BufferGeometry => boxGeometry();

/**
 * Minimal geometry merge for non-indexed/indexed mixes, kept local so the
 * bundle does not need three's BufferGeometryUtils.
 */
const mergeGeometries = (geos: THREE.BufferGeometry[]): THREE.BufferGeometry => {
  const attrNames = ["position", "normal", "uv"] as const;
  let vertexTotal = 0;
  let indexTotal = 0;
  const prepared = geos.map((g) => {
    const src = g.getIndex() ? g : g.clone();
    const count = src.getAttribute("position").count;
    const index = src.getIndex()
      ? Array.from(src.getIndex()!.array)
      : Array.from({ length: count }, (_, i) => i);
    vertexTotal += count;
    indexTotal += index.length;
    return { src, count, index };
  });

  const out = new THREE.BufferGeometry();
  for (const name of attrNames) {
    const itemSize = name === "uv" ? 2 : 3;
    const array = new Float32Array(vertexTotal * itemSize);
    let offset = 0;
    for (const { src, count } of prepared) {
      const attr = src.getAttribute(name);
      if (attr) {
        array.set(attr.array as Float32Array, offset);
      }
      offset += count * itemSize;
    }
    out.setAttribute(name, new THREE.BufferAttribute(array, itemSize));
  }

  const indices = new Uint32Array(indexTotal);
  let vOffset = 0;
  let iOffset = 0;
  for (const { index, count } of prepared) {
    for (let i = 0; i < index.length; i++) indices[iOffset + i] = index[i] + vOffset;
    iOffset += index.length;
    vOffset += count;
  }
  out.setIndex(new THREE.BufferAttribute(indices, 1));
  return out;
};

let cache: Promise<ContainerLods> | null = null;

export const loadContainerLods = (): Promise<ContainerLods> => {
  if (cache) return cache;

  cache = (async (): Promise<ContainerLods> => {
    const loader = new GLTFLoader();
    const load = async (name: string) => {
      const gltf = await loader.loadAsync(staticFile(`models/${name}.glb`));
      let found: THREE.BufferGeometry | null = null;
      gltf.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && !found) found = m.geometry as THREE.BufferGeometry;
      });
      if (!found) throw new Error(`No mesh in ${name}.glb`);
      return normalize(found);
    };

    const [lod0, lod1] = await Promise.all([
      load("container-lod0"),
      load("container-lod1"),
    ]);
    const lod2 = buildLod2();
    const lod3 = buildLod3();

    const geometries: ContainerLods["geometries"] = [lod0, lod1, lod2, lod3];
    return {
      geometries,
      triangles: geometries.map(triangleCount) as ContainerLods["triangles"],
    };
  })();

  return cache;
};
