import * as THREE from "three";
import type { Palette } from "../versions";

export const buildLights = (p: Palette) => {
  const group = new THREE.Group();
  const ambient = new THREE.AmbientLight(new THREE.Color(p.glow), 0.15);
  const key = new THREE.DirectionalLight(new THREE.Color(p.key), 2.4);
  key.position.set(-2, 5, 4);
  const rimL = new THREE.DirectionalLight(new THREE.Color(p.rim), 1.6);
  rimL.position.set(-5, 2, -4);
  const rimR = new THREE.DirectionalLight(new THREE.Color(p.rim), 1.3);
  rimR.position.set(5, 1.5, -3);
  // light from the cube itself (intensity driven by the cube build)
  const cube = new THREE.PointLight(new THREE.Color(p.circuit), 0, 6, 1.6);
  group.add(ambient, key, rimL, rimR, cube);
  return { group, key, cube, ambient, rimL, rimR };
};
