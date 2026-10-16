import * as THREE from "three";

// three.js Color parses hex as sRGB and stores linear values (ColorManagement
// is on), which is what the linear half-float scene buffer expects.
export const lin = (hex: string) => new THREE.Color(hex);
export const linArr = (hex: string): [number, number, number] => {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
};
export const glslVec3 = (hex: string, mul = 1) => {
  const c = new THREE.Color(hex);
  return `vec3(${(c.r * mul).toFixed(6)}, ${(c.g * mul).toFixed(6)}, ${(c.b * mul).toFixed(6)})`;
};
