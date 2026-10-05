import * as THREE from "three";
import { mulberry32 } from "./random";

export const NOISE_N = 128;

// Module-level seeded lattice; the GPU texture is created lazily per WebGL
// context but always from this same array.
const rand = mulberry32(0x5eed1234);
const lattice = new Uint16Array(NOISE_N * NOISE_N * NOISE_N);
for (let i = 0; i < lattice.length; i++) {
  lattice[i] = THREE.DataUtils.toHalfFloat(rand());
}

export const createNoiseTexture = () => {
  const tex = new THREE.Data3DTexture(lattice, NOISE_N, NOISE_N, NOISE_N);
  tex.format = THREE.RedFormat;
  tex.type = THREE.HalfFloatType;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.wrapR = THREE.RepeatWrapping;
  tex.generateMipmaps = false;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  return tex;
};
