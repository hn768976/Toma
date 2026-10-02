import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { staticFile } from "remotion";
import type { Assets } from "../three/ColonWorld";

// The GLBs and the centreline are project files (made once with Meshy + the
// scripts/ folder). Nothing here talks to Meshy.
let pending: Promise<Assets> | null = null;

export const loadAssets = (): Promise<Assets> => {
  if (!pending) {
    pending = (async () => {
      const loader = new GLTFLoader();
      const [colon, clump, centreline] = await Promise.all([
        loader.loadAsync(staticFile("models/colon.glb")),
        loader.loadAsync(staticFile("models/clump.glb")),
        fetch(staticFile("models/centreline.json")).then((r) => r.json() as Promise<Assets["centreline"]>),
      ]);
      const meshes: THREE.Mesh[] = [];
      clump.scene.updateMatrixWorld(true);
      clump.scene.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
      });
      if (meshes.length === 0) throw new Error("clump.glb has no mesh");
      const clumpGeo = meshes[0].geometry.clone().applyMatrix4(meshes[0].matrixWorld);
      const assets: Assets = { colon: colon.scene, clump: clumpGeo, centreline };
      return assets;
    })();
  }
  return pending as Promise<Assets>;
};
