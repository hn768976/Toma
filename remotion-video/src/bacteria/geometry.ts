import { useEffect, useState } from "react";
import { staticFile, continueRender, delayRender } from "remotion";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MODEL_SRC } from "./constants";

/**
 * The supplied bacillus GLB is a raw trimesh export: 50,374 positions
 * and an index buffer, nothing else. No normals, no UVs, no materials.
 *
 * We never touch the vertex positions or the index buffer -- the
 * silhouette that comes out of the file is the silhouette that ends up
 * on screen. What we do add is the data the file omits but any shader
 * needs in order to light a surface at all:
 *
 *   - vertex normals, derived from the faces that are already there
 *   - a cylindrical UV projection around the rod's long axis, derived
 *     from the same positions
 *
 * Both are computed from the existing geometry, so this is strictly
 * "give the mesh a surface to shade", not a remodel.
 */
const prepare = (source: THREE.BufferGeometry) => {
  const geometry = source.clone();
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  const box = geometry.boundingBox as THREE.Box3;
  const centre = new THREE.Vector3();
  box.getCenter(centre);

  // Re-centre on the origin so instance transforms rotate about the
  // rod's middle rather than an arbitrary export pivot. This is a
  // transform of the whole mesh, not a change to its shape.
  geometry.translate(-centre.x, -centre.y, -centre.z);
  geometry.computeBoundingBox();

  const position = geometry.getAttribute("position");
  const span = Math.max(
    1e-6,
    (geometry.boundingBox as THREE.Box3).max.x -
      (geometry.boundingBox as THREE.Box3).min.x,
  );
  const minX = (geometry.boundingBox as THREE.Box3).min.x;

  const uv = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    // u runs around the rod, v runs from cap to cap.
    uv[i * 2] = (Math.atan2(z, y) + Math.PI) / (Math.PI * 2);
    uv[i * 2 + 1] = (x - minX) / span;
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));

  return geometry;
};

let cached: THREE.BufferGeometry | null = null;
let pending: Promise<THREE.BufferGeometry> | null = null;

const loadGeometry = () => {
  if (cached) {
    return Promise.resolve(cached);
  }
  if (!pending) {
    pending = new Promise<THREE.BufferGeometry>((resolve, reject) => {
      new GLTFLoader().load(
        staticFile(MODEL_SRC),
        (gltf) => {
          let found: THREE.BufferGeometry | null = null;
          gltf.scene.traverse((child) => {
            if (!found && (child as THREE.Mesh).isMesh) {
              found = (child as THREE.Mesh).geometry as THREE.BufferGeometry;
            }
          });
          if (!found) {
            reject(new Error("No mesh found in bacillus.glb"));
            return;
          }
          cached = prepare(found);
          resolve(cached);
        },
        undefined,
        (err) => reject(err as Error),
      );
    });
  }
  return pending;
};

/**
 * Loads the bacillus once per render and holds the frame until it is
 * ready, so no frame is ever written with an empty scene.
 */
export const useBacillusGeometry = () => {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(cached);

  useEffect(() => {
    if (cached) {
      setGeometry(cached);
      return;
    }
    const handle = delayRender("Loading bacillus.glb");
    let alive = true;
    loadGeometry()
      .then((loaded) => {
        if (alive) {
          setGeometry(loaded);
        }
        continueRender(handle);
      })
      .catch((err) => {
        continueRender(handle);
        throw err;
      });
    return () => {
      alive = false;
    };
  }, []);

  return geometry;
};
