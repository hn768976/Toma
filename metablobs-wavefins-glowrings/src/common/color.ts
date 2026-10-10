import * as THREE from "three";

/** "#RRGGBB" (sRGB) -> linear RGB triple, for shader uniforms. */
export const hexToLinear = (hex: string): THREE.Vector3 => {
  const c = new THREE.Color();
  c.setStyle(hex, THREE.SRGBColorSpace); // converts into the linear working space
  return new THREE.Vector3(c.r, c.g, c.b);
};
