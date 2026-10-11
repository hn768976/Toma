import * as THREE from "three";

/** Hex sRGB string -> linear THREE.Color. */
export const lin = (hex: string) => new THREE.Color().setStyle(hex, THREE.SRGBColorSpace);
export const linArr = (hex: string): [number, number, number] => {
  const c = lin(hex);
  return [c.r, c.g, c.b];
};
