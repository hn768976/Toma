import * as THREE from "three";

// All colours are authored as display (sRGB) values and composited as such.
// Turning colour management off keeps hex values exactly as written.
THREE.ColorManagement.enabled = false;

export { THREE };

export const col = (hex: string) => new THREE.Color(hex);

/** GLSL: integer PCG hash -> uniform [0,1). Same result on every GPU. */
export const GLSL_HASH = /* glsl */ `
uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float rnd3(uvec3 p) {
  return float(pcg(p.x + pcg(p.y + pcg(p.z)))) * (1.0 / 4294967295.0);
}
`;
