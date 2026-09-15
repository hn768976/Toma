// Loads the "Neural Circuitry" GLB once per render page and hands back a
// normalised BufferGeometry.
//
// The asset is a flat relief panel: roughly 1.75 x 1.90 units across but only
// 0.04 deep, 220k triangles, and it ships with no materials. That shape suits
// the references, which almost all show a flat, camera-facing circuit motif, so
// every version shades the same geometry differently rather than deforming it.
//
// Loading is wrapped in delayRender/continueRender so Remotion never captures a
// frame before the mesh is on the GPU, and the parse is memoised at module
// scope so the 8MB file is only decoded once per browser tab.

import { useEffect, useState } from "react";
import {
  cancelRender,
  continueRender,
  delayRender,
  staticFile,
} from "remotion";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export const NEURAL_GLB_PATH = "models/neural-circuitry.glb";

/** Height, in world units, that the geometry is normalised to. */
export const HERO_HEIGHT = 2;

let geometryPromise: Promise<THREE.BufferGeometry> | null = null;

const parseGeometry = (gltf: { scene: THREE.Object3D }) => {
  let found: THREE.BufferGeometry | null = null;
  gltf.scene.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!found && mesh.isMesh) {
      found = mesh.geometry as THREE.BufferGeometry;
    }
  });
  if (!found) {
    throw new Error("neural-circuitry.glb contains no mesh");
  }

  const geometry = (found as THREE.BufferGeometry).clone();
  geometry.center();
  geometry.computeBoundingBox();

  // Normalise so the panel is always HERO_HEIGHT tall regardless of how the
  // asset was exported, which keeps every version's camera framing portable.
  const box = geometry.boundingBox as THREE.Box3;
  const size = new THREE.Vector3();
  box.getSize(size);
  const scale = HERO_HEIGHT / Math.max(size.y, 1e-6);
  geometry.scale(scale, scale, scale);

  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  if (!geometry.attributes.normal) {
    geometry.computeVertexNormals();
  }
  return geometry;
};

export const loadNeuralGeometry = (): Promise<THREE.BufferGeometry> => {
  if (geometryPromise) {
    return geometryPromise;
  }
  geometryPromise = new Promise<THREE.BufferGeometry>((resolve, reject) => {
    new GLTFLoader().load(
      staticFile(NEURAL_GLB_PATH),
      (gltf) => {
        try {
          resolve(parseGeometry(gltf as unknown as { scene: THREE.Object3D }));
        } catch (err) {
          reject(err as Error);
        }
      },
      undefined,
      (err) => reject(err as unknown as Error),
    );
  });
  return geometryPromise;
};

/**
 * Suspense-free GLB hook. Returns `null` until the geometry is ready; the
 * surrounding frame is held back by delayRender until then, so a `null` return
 * is only ever seen by the studio preview, never by a captured frame.
 */
export const useNeuralGeometry = (): THREE.BufferGeometry | null => {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [handle] = useState(() =>
    delayRender("Loading neural-circuitry.glb", { timeoutInMilliseconds: 120000 }),
  );

  useEffect(() => {
    let live = true;
    loadNeuralGeometry()
      .then((geo) => {
        if (live) {
          setGeometry(geo);
        }
        continueRender(handle);
      })
      .catch((err: Error) => cancelRender(err));
    return () => {
      live = false;
    };
  }, [handle]);

  return geometry;
};

/**
 * Deterministically samples `count` surface points from the geometry, returned
 * as a flat XYZ array. Used by the particle-driven versions so their dust and
 * assembly effects trace the real circuitry rather than an approximation.
 */
export const sampleSurfacePoints = (
  geometry: THREE.BufferGeometry,
  count: number,
  seed = 1,
): Float32Array => {
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const total = position.count;
  const out = new Float32Array(count * 3);
  // Cheap deterministic LCG; Math.random() would desync across frames.
  let state = seed >>> 0 || 1;
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    const index = Math.floor(next() * total) % total;
    out[i * 3] = position.getX(index);
    out[i * 3 + 1] = position.getY(index);
    out[i * 3 + 2] = position.getZ(index);
  }
  return out;
};
