import * as THREE from "three";

// Raw sRGB triplet from a hex string (no colour-management conversion).
export const srgb = (hex: string) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};

const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

// Linear-light triplet from an sRGB hex (for values used inside lit three.js scenes).
export const linear = (hex: string) => {
  const s = srgb(hex);
  return new THREE.Vector3(toLin(s.x), toLin(s.y), toLin(s.z));
};

export const linearColor = (hex: string) => {
  const v = linear(hex);
  return new THREE.Color().setRGB(v.x, v.y, v.z, THREE.LinearSRGBColorSpace);
};
