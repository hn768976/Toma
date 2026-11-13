import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { Palette } from "./palette";
import { getTimeline } from "./timeline";
import { createBackdrop } from "./backdrop";
import { createHair, HAIR_TILT } from "./hair";
import { createDroplet } from "./droplet";

export type HairScene = {
  render: (frame: number) => void;
  dispose: () => void;
};

export const createHairScene = (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  palette: Palette,
): HairScene => {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false, // MSAA happens in the composer's render target
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, width / height, 0.5, 200);

  const backdrop = createBackdrop(palette, width / height);
  const hair = createHair(palette);
  const droplet = createDroplet(palette);
  scene.add(backdrop.mesh, hair.mesh, droplet.halo, droplet.mesh);

  // Post: MSAA scene -> bloom (glowing front, grid and droplet) -> sRGB
  const target = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.HalfFloatType,
    samples: 4,
  });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(1);
  composer.setSize(width, height);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.38, 0.5, 0.9);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const cameraTarget = new THREE.Vector3(-1.2, 0.6, 0);
  const dropPosition = new THREE.Vector3();

  const render = (frame: number) => {
    const tl = getTimeline(frame);

    cameraTarget.x = tl.cameraX;
    camera.position.set(cameraTarget.x, cameraTarget.y, tl.cameraDistance);
    camera.lookAt(cameraTarget);
    camera.updateMatrixWorld();

    dropPosition.set(tl.dropX, tl.dropY, tl.dropZ);

    backdrop.update(frame, tl);
    hair.update(tl, dropPosition, camera.position);
    droplet.update(frame, tl, dropPosition, camera.position, HAIR_TILT);

    composer.render();
  };

  const dispose = () => {
    backdrop.dispose();
    hair.dispose();
    droplet.dispose();
    bloom.dispose();
    target.dispose();
    composer.dispose();
    renderer.dispose();
  };

  return { render, dispose };
};
