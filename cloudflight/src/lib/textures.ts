import * as THREE from "three";
import { blueNoise64, BLUE_NOISE_SIZE } from "./bluenoise";

let blueTex: THREE.DataTexture | null = null;

export const getBlueNoiseTexture = () => {
  if (!blueTex) {
    const src = blueNoise64();
    const data = new Uint8Array(src.length * 4);
    for (let i = 0; i < src.length; i++) {
      data[i * 4] = src[i];
      data[i * 4 + 1] = src[i];
      data[i * 4 + 2] = src[i];
      data[i * 4 + 3] = 255;
    }
    blueTex = new THREE.DataTexture(
      data,
      BLUE_NOISE_SIZE,
      BLUE_NOISE_SIZE,
      THREE.RGBAFormat,
      THREE.UnsignedByteType,
    );
    blueTex.minFilter = THREE.NearestFilter;
    blueTex.magFilter = THREE.NearestFilter;
    blueTex.wrapS = THREE.RepeatWrapping;
    blueTex.wrapT = THREE.RepeatWrapping;
    blueTex.generateMipmaps = false;
    blueTex.needsUpdate = true;
  }
  return blueTex;
};
