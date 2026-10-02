import * as THREE from "three";

/** Hex sRGB colour → linear RGB triple (for shader uniforms in the HDR buffer). */
export const lin = (hex: string): THREE.Vector3 => {
  const c = new THREE.Color(hex); // three converts sRGB hex → linear working space
  return new THREE.Vector3(c.r, c.g, c.b);
};
