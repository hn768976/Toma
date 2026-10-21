import * as THREE from "three";
import colors from "../../../data/colors.json";
import { mod } from "../../lib/math";
import { Blur, TexturePass } from "../../lib/three/blur";
import { GLStage, Stage, StageContext } from "../../lib/three/GLStage";
import { add } from "./geometry";
import { FOV, LOOP, TILE, layout } from "./networkLayout";
import { SparkBuffer, neuronMaterial, sparkMaterial } from "./material";

const build = (ctx: StageContext): Stage => {
  const { renderer, width, height, px } = ctx;
  const L = layout();
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.1, 60);
  const mat = neuronMaterial({ silver: colors.neuron.silver });
  const farMat = neuronMaterial({ silver: colors.neuron.silver });
  farMat.uniforms.uDim.value = 0.8;
  mat.uniforms.uFibre.value = 0.72;
  farMat.uniforms.uFibre.value = 0.72;
  mat.uniforms.uViewportH.value = height;
  farMat.uniforms.uViewportH.value = height;
  const nearScene = new THREE.Scene();
  const farScene = new THREE.Scene();
  for (let k = -1; k <= 1; k++) {
    const m = new THREE.Mesh(L.near, mat);
    m.position.x = k * TILE;
    m.frustumCulled = false;
    nearScene.add(m);
    const f = new THREE.Mesh(L.far, farMat);
    f.position.x = k * TILE;
    f.frustumCulled = false;
    farScene.add(f);
  }
  const sparks = new SparkBuffer(512);
  const sparkMesh = new THREE.Points(sparks.geo, sparkMaterial(px));
  sparkMesh.frustumCulled = false;
  nearScene.add(sparkMesh);

  const farTarget = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, samples: 4 });
  const farBlur = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType });
  const blur = new Blur(width, height);
  const overlay = new TexturePass(THREE.NoBlending);
  const flash = mat.uniforms.uFlash.value as Float32Array;

  return {
    render: (frame, target) => {
      const f = mod(frame, LOOP);
      camera.position.set((TILE * f) / LOOP, 0, 0);
      camera.lookAt(camera.position.x, 0, -10);
      camera.updateMatrixWorld();

      // Signals: sparks run in along dendrites, the soma flashes, one
      // spark leaves along the axon. Everything is periodic in 600 frames.
      flash.fill(0);
      sparks.reset();
      for (const ev of L.events) {
        const dt = mod(f - ev.t + LOOP / 2, LOOP) - LOOP / 2; // relative to soma arrival
        const P = L.paths[ev.n];
        const n = L.neurons[ev.n];
        ev.dend.forEach((di, j) => {
          const dur = ev.dendDur[j];
          const u = (dt + dur + j * 2) / dur;
          if (u > 0 && u < 1) {
            const fade = Math.min(1, u * 6, (1 - u) * 12);
            for (let k = -1; k <= 1; k++) sparks.push(add(P.dend[di].at(u), [k * TILE, 0, 0]), 0.9 * fade, 260);
          }
        });
        if (dt >= -2 && dt < 40) {
          const a = dt < 2 ? (dt + 2) / 4 : Math.exp(-(dt - 2) / 9);
          flash[n.id] = Math.max(flash[n.id], 0.55 * a);
        }
        const ua = (dt - 4) / ev.axonDur;
        if (ua > 0 && ua < 1) {
          const fade = Math.min(1, ua * 10, (1 - ua) * 8);
          for (let k = -1; k <= 1; k++) sparks.push(add(P.axon.at(ua), [k * TILE, 0, 0]), fade, 240);
        }
      }
      (farMat.uniforms.uFlash.value as Float32Array).set(flash);
      sparks.commit();

      // Far layer, softened.
      renderer.setRenderTarget(farTarget);
      renderer.setClearColor(0x000000, 1);
      renderer.clear(true, true, true);
      renderer.render(farScene, camera);
      blur.run(renderer, farTarget.texture, farBlur, 1.1 * px * 1.5);

      renderer.setRenderTarget(target);
      renderer.setClearColor(0x000000, 1);
      renderer.clear(true, true, true);
      overlay.run(renderer, farBlur.texture);
      renderer.render(nearScene, camera);
    },
  };
};

export const NeuronNetwork_Silver: React.FC = () => <GLStage build={build} background="#000000" />;
