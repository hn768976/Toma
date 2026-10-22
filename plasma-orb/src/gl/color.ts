import * as THREE from "three";

// Display-space RGB from a hex string, with no colour-management conversion:
// shaders write these values straight to the (linear, untouched) output.
export const rgb = (hex: string) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};
