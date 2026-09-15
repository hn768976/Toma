import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * Loads the supplied Meshy GLB once per page and hands back a single, clean
 * BufferGeometry.
 *
 * The file is one mesh ("low_poly_unwrapped", 56,368 verts / 97,396 tris) with
 * POSITION, NORMAL and TEXCOORD_0 and no materials at all, so there is nothing
 * to strip. We deliberately do not touch topology: the only thing baked in here
 * is the node's own +90deg X rotation (so the molecule stands up in world
 * space) plus a recentre and a uniform scale to unit radius, which makes camera
 * framing comparable across the nine versions. Vertex count in == vertex count
 * out.
 */

let cache: Promise<THREE.BufferGeometry> | null = null;

const normalise = (geometry: THREE.BufferGeometry): THREE.BufferGeometry => {
  geometry.computeBoundingSphere();
  const sphere = geometry.boundingSphere;
  if (sphere) {
    geometry.translate(-sphere.center.x, -sphere.center.y, -sphere.center.z);
    if (sphere.radius > 0) {
      const s = 1 / sphere.radius;
      geometry.scale(s, s, s);
    }
  }
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  return geometry;
};

const loadMolecule = (): Promise<THREE.BufferGeometry> => {
  if (cache) {
    return cache;
  }

  cache = new Promise<THREE.BufferGeometry>((resolve, reject) => {
    new GLTFLoader().load(
      staticFile("models/molecule.glb"),
      (gltf) => {
        let found: THREE.BufferGeometry | null = null;

        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse((object) => {
          if (found || !(object as THREE.Mesh).isMesh) {
            return;
          }
          const mesh = object as THREE.Mesh;
          const geometry = mesh.geometry.clone();
          // Bake the node transform (the GLB stores a +90deg X quaternion) so
          // instances can be positioned without inheriting a tilted basis.
          geometry.applyMatrix4(mesh.matrixWorld);
          found = geometry;
        });

        if (!found) {
          reject(new Error("No mesh found in molecule.glb"));
          return;
        }

        resolve(normalise(found));
      },
      undefined,
      (error) => reject(error as Error),
    );
  });

  return cache;
};

export const useMoleculeGeometry = (): THREE.BufferGeometry | null => {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [handle] = useState(() => delayRender("Loading molecule.glb"));

  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadMolecule()
      .then((loaded) => {
        if (!cancelled) {
          setGeometry(loaded);
        }
      })
      .catch((error: Error) => {
        // Surfacing this as a delayRender timeout would hide the real cause.
        console.error("Failed to load molecule.glb", error);
        if (!cancelled) {
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Released only once the geometry has actually been committed. Releasing it
  // inside the promise callback lets Remotion screenshot the frame in the gap
  // before React mounts the canvas, which renders an empty page.
  useEffect(() => {
    if (geometry || failed) {
      continueRender(handle);
    }
  }, [geometry, failed, handle]);

  return geometry;
};
