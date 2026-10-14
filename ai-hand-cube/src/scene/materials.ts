import * as THREE from "three";
import type { Palette } from "../versions";
import type { HandMaterials } from "./hand";

export const buildHandMaterials = (p: Palette, env: THREE.Texture): HandMaterials => {
  const shell = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(p.handBase),
    metalness: 0.3,
    roughness: 0.3,
    clearcoat: 0.35,
    clearcoatRoughness: 0.18,
    envMap: env,
    envMapIntensity: 1.0,
  });
  const joint = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(p.handJoint),
    metalness: 0.8,
    roughness: 0.32,
    envMap: env,
    envMapIntensity: 1.2,
  });
  const seam = new THREE.MeshStandardMaterial({
    color: new THREE.Color(p.handJoint).multiplyScalar(0.35),
    metalness: 0.5,
    roughness: 0.6,
    envMap: env,
    envMapIntensity: 0.4,
  });
  return { shell, joint, seam };
};
