import { useEffect, useMemo, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * Loads the supplied virus GLB.
 *
 * The source file carries POSITION data only — no normals, no UVs, no
 * materials. We therefore compute vertex normals and centre/normalise the
 * mesh so every look can share one canonical unit-radius model. The topology
 * itself is never modified: no decimation, no remeshing, no vertex edits.
 */
let cached: THREE.BufferGeometry | null = null;
let inFlight: Promise<THREE.BufferGeometry> | null = null;

const loadGeometry = (): Promise<THREE.BufferGeometry> => {
  if (cached) return Promise.resolve(cached);
  if (inFlight) return inFlight;

  inFlight = new GLTFLoader()
    .loadAsync(staticFile("virus.glb"))
    .then((gltf) => {
      let found: THREE.BufferGeometry | null = null;
      gltf.scene.traverse((o) => {
        if (!found && (o as THREE.Mesh).isMesh) {
          found = (o as THREE.Mesh).geometry as THREE.BufferGeometry;
        }
      });
      if (!found) throw new Error("No mesh found in virus.glb");

      const geo = (found as THREE.BufferGeometry).clone();
      geo.computeVertexNormals();
      geo.computeBoundingSphere();

      // Centre on the origin and scale so the capsid+spikes fit a unit radius.
      const bs = geo.boundingSphere;
      if (bs) {
        geo.translate(-bs.center.x, -bs.center.y, -bs.center.z);
        geo.scale(1 / bs.radius, 1 / bs.radius, 1 / bs.radius);
      }
      geo.computeBoundingSphere();

      // Per-vertex randomness, used by the point-cloud shaders. Seeded from the
      // vertex index so it is identical on every render pass and every machine.
      const pos = geo.getAttribute("position");
      const count = pos.count;
      const rand = new Float32Array(count * 3);
      let s = 1;
      for (let i = 0; i < count; i++) {
        s = (s * 16807) % 2147483647;
        rand[i * 3] = s / 2147483647;
        s = (s * 16807) % 2147483647;
        rand[i * 3 + 1] = s / 2147483647;
        s = (s * 16807) % 2147483647;
        rand[i * 3 + 2] = s / 2147483647;
      }
      geo.setAttribute("aRand", new THREE.BufferAttribute(rand, 3));

      cached = geo;
      return geo;
    });

  return inFlight;
};

export const useVirusGeometry = (): THREE.BufferGeometry | null => {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(cached);
  const handle = useMemo(
    () => (cached ? null : delayRender("Loading virus.glb")),
    [],
  );

  useEffect(() => {
    if (cached) {
      setGeometry(cached);
      return;
    }
    let alive = true;
    loadGeometry()
      .then((geo) => {
        if (alive) setGeometry(geo);
      })
      .catch((err) => {
        // Surface the failure to the renderer instead of hanging forever.
        if (handle !== null) continueRender(handle);
        throw err;
      });
    return () => {
      alive = false;
    };
  }, [handle]);

  // Released only once the geometry is committed — at which point <ThreeCanvas>
  // has mounted and registered its own delayRender handles, so the renderer
  // keeps waiting until the first WebGL draw has actually happened.
  useEffect(() => {
    if (geometry && handle !== null) continueRender(handle);
  }, [geometry, handle]);

  return geometry;
};
