import * as THREE from "three";
import { padsOf, buildFibreKit, FibrePalette, PlateSpec, BundleSpec } from "../kit/fibreKit";
import { LookInstance } from "../kit/post";
import { LOOP } from "../kit/random";

// Model check for the shared kit: one plate with two fibre bundles, still.
export const createFibreModelCheck = (P: FibrePalette, gl: THREE.WebGLRenderer): LookInstance => {
  const scene = new THREE.Scene();
  const depthScene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 60);
  const plate: PlateSpec = { variant: 2, size: 1.6, matrix: new THREE.Matrix4().makeTranslation(0, 0.4, 0) };
  const pads = padsOf(plate, -1);
  // The two pads furthest apart.
  let best = [0, 1];
  pads.forEach((a, i) => pads.forEach((b, j) => {
    if (a.pos.distanceTo(b.pos) > pads[best[0]].pos.distanceTo(pads[best[1]].pos)) best = [i, j];
  }));
  const bundles: BundleSpec[] = best.map((bi) => pads[bi]).map((pad, i) => ({
    from: pad.pos,
    to: pad.pos.clone().add(new THREE.Vector3(0.1 * (i ? 1 : -1), -3.2, 0.2)),
    padR: pad.r,
    toR: 0.9,
    count: 32,
    seed: 100 + i,
    hang: true,
    width: 0.0035,
  }));
  const kit = buildFibreKit(gl, P, [plate], bundles, scene);
  scene.add(kit.group);
  depthScene.add(kit.depthGroup);
  camera.position.set(0.5, -1.7, 2.6);
  camera.lookAt(0, -0.2, 0);
  return {
    scene,
    camera,
    clearColor: kit.clearColor,
    post: {
      focus: 2.8,
      cocScale: 4,
      maxCoc: 8,
      bloomStrength: 0.5,
      bloomThreshold: 0.6,
      exposure: 1,
      vignette: 0.35,
      grain: 0.015,
    },
    update: (frame, w, h, k) => {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      kit.update(frame % LOOP, w, h, k, camera);
    },
    draw: (g) => {
      g.render(scene, camera);
      g.render(depthScene, camera);
    },
    dispose: kit.dispose,
  };
};
