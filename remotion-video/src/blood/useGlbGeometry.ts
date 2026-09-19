import { useEffect, useState } from "react";
import { staticFile, useDelayRender } from "remotion";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const cache = new Map<string, Promise<THREE.BufferGeometry>>();

/**
 * Pulls the first mesh out of a .glb and normalises it so it can be swapped in
 * for the procedural cell: centred on the origin, radius 1 across the disc face
 * (the face normal is the Z axis), and with non-position attributes dropped so
 * it can be instanced cheaply.
 */
const loadGeometry = (url: string) => {
  const hit = cache.get(url);
  if (hit) {
    return hit;
  }

  const promise = new Promise<THREE.BufferGeometry>((resolve, reject) => {
    new GLTFLoader().load(
      url,
      (gltf) => {
        let found: THREE.BufferGeometry | null = null;
        gltf.scene.traverse((child) => {
          if (!found && (child as THREE.Mesh).isMesh) {
            found = (child as THREE.Mesh).geometry as THREE.BufferGeometry;
          }
        });
        if (!found) {
          reject(new Error(`No mesh found in ${url}`));
          return;
        }

        const geometry = (found as THREE.BufferGeometry).clone();
        geometry.computeBoundingBox();
        const box = geometry.boundingBox as THREE.Box3;
        const center = box.getCenter(new THREE.Vector3());
        geometry.translate(-center.x, -center.y, -center.z);

        // Scale by the disc radius (X/Y extent), not the bounding sphere, so a
        // cell of "size 1" is one world unit across its face whatever the
        // source model's thickness happens to be.
        const size = box.getSize(new THREE.Vector3());
        const radius = Math.max(size.x, size.y) / 2;
        if (radius > 0) {
          geometry.scale(1 / radius, 1 / radius, 1 / radius);
        }

        for (const name of Object.keys(geometry.attributes)) {
          if (name !== "position" && name !== "normal" && name !== "uv") {
            geometry.deleteAttribute(name);
          }
        }
        if (!geometry.attributes.normal) {
          geometry.computeVertexNormals();
        }
        if (!geometry.attributes.uv) {
          // Meshy exports carry no UVs, but the cells sample a speckle map.
          // A spherical projection from the normal is enough for a granular
          // surface pattern and matches what the lathed cell gets.
          const normal = geometry.attributes.normal;
          const uv = new Float32Array(normal.count * 2);
          for (let i = 0; i < normal.count; i++) {
            const nx = normal.getX(i);
            const ny = normal.getY(i);
            const nz = normal.getZ(i);
            uv[i * 2] = (Math.atan2(nz, nx) / (Math.PI * 2) + 0.5) * 2;
            uv[i * 2 + 1] = (Math.asin(THREE.MathUtils.clamp(ny, -1, 1)) / Math.PI + 0.5) * 2;
          }
          geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
        }
        resolve(geometry);
      },
      undefined,
      (error) => reject(error),
    );
  });

  cache.set(url, promise);
  return promise;
};

/**
 * Loads a .glb from `public/` and blocks the Remotion frame until it is ready,
 * so no frame can ever be captured with the hero cells missing.
 */
export const useGlbGeometry = (path: string) => {
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);

  useEffect(() => {
    const handle = delayRender(`Loading cell model ${path}`);
    let cancelled = false;

    loadGeometry(staticFile(path))
      .then((loaded) => {
        if (!cancelled) {
          setGeometry(loaded);
        }
        continueRender(handle);
      })
      .catch((error) => {
        cancelRender(error as Error);
      });

    return () => {
      cancelled = true;
      continueRender(handle);
    };
  }, [path, delayRender, continueRender, cancelRender]);

  return geometry;
};
