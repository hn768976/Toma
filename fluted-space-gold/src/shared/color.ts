import * as THREE from "three";

/** '#RRGGBB' → THREE.Color holding the raw sRGB-encoded components (0..1). */
export const hex = (h: string): THREE.Color => {
  const n = parseInt(h.replace("#", ""), 16);
  return new THREE.Color(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};
