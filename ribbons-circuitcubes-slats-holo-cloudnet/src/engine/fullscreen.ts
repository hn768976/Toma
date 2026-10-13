import * as THREE from "three";

/** A clip-space quad drawn behind everything (for gradient backgrounds etc.). */
export const fullscreenMesh = (material: THREE.ShaderMaterial, renderOrder = -1000) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  m.frustumCulled = false;
  m.renderOrder = renderOrder;
  return m;
};

export const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.99999, 1.0);
}`;

/** Linear-space colour from a hex string (sRGB → linear). */
export const lin = (hex: string) => new THREE.Color(hex);
