import * as THREE from "three";
import type { Palette } from "../versions";
import { applyFinish } from "./finish";
import type { HandMaterials } from "./hand";

export const buildHandMaterials = (p: Palette, env: THREE.Texture): HandMaterials => {
  const shell = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(p.handBase),
    metalness: 0.5,
    roughness: 0.32,
    clearcoat: 0.12,
    clearcoatRoughness: 0.3,
    envMap: env,
    envMapIntensity: 1.25,
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
  const metal = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#DDE3EC"),
    metalness: 1.0,
    roughness: 0.14,
    envMap: env,
    envMapIntensity: 1.3,
  });
  // fingertip pads: same family as the shell, just a softer matte grip
  const pad = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(p.handBase).multiplyScalar(0.72),
    metalness: 0.1,
    roughness: 0.62,
    envMap: env,
    envMapIntensity: 0.5,
  });
  // satin shell: fine bead-blast speckle and faint moulding blotches
  applyFinish(shell, { grain: 140, roughVar: 0.35, toneVar: 0.03, brush: 0 });
  // graphite joints: bead-blasted
  applyFinish(joint, { grain: 260, roughVar: 0.45, toneVar: 0.06, brush: 0 });
  // polished pins/rods: fine brushing along their length
  applyFinish(metal, { grain: 300, roughVar: 0.6, toneVar: 0.02, brush: 0.7 });
  applyFinish(pad, { grain: 400, roughVar: 0.3, toneVar: 0.08, brush: 0 });
  return { shell, joint, seam, metal, pad };
};
