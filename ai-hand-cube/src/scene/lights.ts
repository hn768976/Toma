import * as THREE from "three";
import type { Palette } from "../versions";

export const buildLights = (p: Palette) => {
  const group = new THREE.Group();
  const ambient = new THREE.AmbientLight(new THREE.Color(p.glow), 0.15);
  const key = new THREE.DirectionalLight(new THREE.Color(p.key), 1.9);
  key.position.set(-4, 4.5, 2.2);
  // soft shadows for contact shading (fingers on palm, hinge parts)
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -2.2;
  key.shadow.camera.right = 2.2;
  key.shadow.camera.top = 2.2;
  key.shadow.camera.bottom = -2.2;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 14;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.012;
  key.shadow.radius = 4;
  const rimL = new THREE.DirectionalLight(new THREE.Color(p.rim), 1.6);
  rimL.position.set(-5, 2, -4);
  const rimR = new THREE.DirectionalLight(new THREE.Color(p.rim), 1.3);
  rimR.position.set(5, 1.5, -3);
  // light from the cube itself (intensity driven by the cube build)
  const cube = new THREE.PointLight(new THREE.Color(p.circuit), 0, 6, 1.6);
  group.add(ambient, key, rimL, rimR, cube);
  return { group, key, cube, ambient, rimL, rimR };
};
