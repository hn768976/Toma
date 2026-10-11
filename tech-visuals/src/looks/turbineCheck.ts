import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Look } from "../lib/LookCanvas";
import { Pipeline } from "../lib/post";
import { buildTurbine } from "./turbine";

/** Dev still: the code-built turbine, 3/4 view on grey (used for the model check). */
export const createTurbineCheck = () => (): Look => {
  const pipe = new Pipeline(4);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 16 / 9, 0.05, 50);
  let env: THREE.Texture | null = null;
  const mat = new THREE.MeshStandardMaterial({ color: 0xdfe3e7, roughness: 0.42, metalness: 0 });
  const t = buildTurbine(mat);
  t.nacelle.rotation.y = THREE.MathUtils.degToRad(-22);
  t.rotor.rotation.z = 0.35;
  scene.add(t.group);
  const key = new THREE.DirectionalLight(0xffffff, 0.9);
  key.position.set(2, 3, 4);
  scene.add(key);
  return {
    render(gl, frame) {
      if (!env) {
        const pm = new THREE.PMREMGenerator(gl);
        env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environment = env;
        scene.environmentIntensity = 0.55;
        pm.dispose();
      }
      t.rotor.rotation.z = 0.35 + frame * 0.03;
      pipe.begin(gl, new THREE.Color("#5A5F66"));
      camera.aspect = pipe.w / pipe.h;
      camera.position.set(1.5, 0.7, 3.1);
      camera.lookAt(0, 0.78, 0);
      camera.updateProjectionMatrix();
      gl.render(scene, camera);
      pipe.finish(gl, { final: { frame, period: 600, grain: 0.0, vignette: 0 } });
    },
    dispose() {
      pipe.dispose();
    },
  };
};
