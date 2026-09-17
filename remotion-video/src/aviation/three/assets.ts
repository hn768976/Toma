import { staticFile } from "remotion";
import { Box3, BufferGeometry, Mesh, Vector3, type Material } from "three/webgpu";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { SCALE } from "../config";

/**
 * Loads the supplied models and normalises them into a scene convention:
 * metres, +Y up, and −Z forward.
 *
 * Both GLBs arrive as a single unparented mesh in arbitrary units, so
 * everything useful about their orientation had to be measured rather than
 * assumed. The container runs along its local Z with the cargo doors at +Z; the
 * aircraft's fuselage runs along local X with the tail at +X, which is why it
 * gets a quarter turn here to point down −Z like every other forward vector in
 * three.
 *
 * The container has no material at all and is shaded procedurally. The aircraft
 * ships base colour, metallic-roughness and normal maps, so its material is
 * carried through and used as delivered.
 */

export type ModelKey = "container-hero" | "container-lod" | "skyliner";

export type LoadedModel = {
  readonly geometry: BufferGeometry;
  /** The GLB's own material, when it ships one. */
  readonly material: Material | null;
  /** Bounding box size in metres, after normalisation. */
  readonly size: Vector3;
  /**
   * Height of the fuselage centreline in local space, and its radius.
   *
   * Measured rather than assumed. Centring a model on its bounding box puts the
   * origin between the belly and the top of the fin, which on a widebody is
   * several metres above the fuselage axis — so anything positioned from the
   * centroid (window line, cheatline, belly soot) lands on the tail instead.
   */
  readonly fuselageAxisY: number;
  readonly fuselageRadius: number;
};

const loader = new GLTFLoader();
const cache = new Map<ModelKey, Promise<LoadedModel>>();

const firstMesh = (root: object): Mesh => {
  let found: Mesh | null = null;
  (root as { traverse(cb: (o: unknown) => void): void }).traverse((child) => {
    if (!found && (child as Mesh).isMesh) found = child as Mesh;
  });
  if (!found) throw new Error("GLB contained no mesh");
  return found;
};

/**
 * Finds the fuselage axis by looking only at vertices near the centreline and
 * amidships — the barrel section, with the wings, fin and nose cone excluded.
 */
const measureFuselage = (
  geometry: BufferGeometry,
  size: Vector3,
): { fuselageAxisY: number; fuselageRadius: number } => {
  const position = geometry.getAttribute("position");
  const halfBeam = size.x * 0.05;
  const halfStation = size.z * 0.16;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    if (Math.abs(x) > halfBeam || Math.abs(z) > halfStation) continue;
    const y = position.getY(i);
    if (y < min) min = y;
    if (y > max) max = y;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { fuselageAxisY: 0, fuselageRadius: size.y * 0.5 };
  }
  return { fuselageAxisY: (min + max) / 2, fuselageRadius: (max - min) / 2 };
};

const load = async (key: ModelKey): Promise<LoadedModel> => {
  const gltf = await loader.loadAsync(staticFile(`models/${key}.glb`));
  const mesh = firstMesh(gltf.scene);
  const geometry = (mesh.geometry as BufferGeometry).clone();
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;

  const isContainer = key.startsWith("container");
  geometry.scale(
    isContainer ? SCALE.container : SCALE.jet,
    isContainer ? SCALE.container : SCALE.jet,
    isContainer ? SCALE.container : SCALE.jet,
  );

  if (!isContainer) {
    // Nose sits at −X in the source; a quarter turn about Y puts it at −Z.
    geometry.rotateY(-Math.PI / 2);
  }

  geometry.computeBoundingBox();
  const box = geometry.boundingBox as Box3;
  const size = new Vector3();
  box.getSize(size);
  const center = new Vector3();
  box.getCenter(center);

  if (isContainer) {
    // Origin at the bottom centre, so stacking is just a Y offset per tier and
    // a container always sits exactly on the one below it.
    geometry.translate(-center.x, -box.min.y, -center.z);
  } else {
    geometry.translate(-center.x, -center.y, -center.z);
  }

  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const { fuselageAxisY, fuselageRadius } = measureFuselage(geometry, size);
  return { geometry, size, material: material ?? null, fuselageAxisY, fuselageRadius };
};

export const loadModel = (key: ModelKey): Promise<LoadedModel> => {
  const existing = cache.get(key);
  if (existing) return existing;
  const promise = load(key);
  cache.set(key, promise);
  return promise;
};
