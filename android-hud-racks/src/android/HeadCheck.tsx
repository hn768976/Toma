import * as THREE from "three";
import { GLStage, SceneFactory } from "../lib/GLStage";
import { PostChain } from "../lib/post";
import { HeadAsset, loadHead, makeHeadMaterial, makeStudioEnv } from "./head";

// The model check: the bare head, three-quarter view, on plain grey.
const factory: SceneFactory<HeadAsset> = ({ renderer, width, height, assets }) => {
  const env = makeStudioEnv(renderer, [
    { pos: [-4, 3, 5], size: [5, 4], color: 0xdde8ff, intensity: 2.2 },
    { pos: [5, 1, -2], size: [2, 6], color: 0x8ab8ff, intensity: 2.5 },
    { pos: [0, 8, 0], size: [8, 8], color: 0xffffff, intensity: 0.6 },
  ], 0x2a2a2a);
  const scene = new THREE.Scene();
  const head = new THREE.Mesh(assets.geometry, makeHeadMaterial(env));
  head.rotation.y = 0.62;
  scene.add(head);
  // Unlit eyeballs (they glow in the real scene).
  for (const e of assets.header.eyes) {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.052, 48, 32),
      new THREE.MeshPhysicalMaterial({ color: 0x1a2a40, roughness: 0.1, clearcoat: 1, envMap: env }),
    );
    eye.position.set(e.x, e.y, e.z);
    head.add(eye);
  }
  const key = new THREE.DirectionalLight(0xeef4ff, 2.2);
  key.position.set(-3, 2, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8ab8ff, 1.5);
  rim.position.set(4, 1, -3);
  scene.add(rim);
  const cam = new THREE.PerspectiveCamera(26, width / height, 0.1, 50);
  cam.position.set(0, -0.25, 5.2);
  cam.lookAt(0, -0.35, 0);
  const post = new PostChain(renderer, width, height, {
    bloom: { threshold: 4, knee: 0.5, intensity: 0.0 },
    grade: { exposure: 1, tint: [1, 1, 1], lift: [0, 0, 0], saturation: 1, contrast: 1 },
    vignette: { strength: 0, radius: 1, softness: 1 },
    grain: 0,
    loop: 600,
    clearColor: new THREE.Color(0.2, 0.2, 0.2),
  });
  return {
    render(frame) {
      post.render(scene, cam, frame, 5);
    },
    dispose() {
      post.dispose();
    },
  };
};

export const HeadCheck = () => <GLStage load={loadHead} factory={factory} />;
