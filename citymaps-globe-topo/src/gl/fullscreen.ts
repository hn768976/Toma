import * as THREE from "three";

export const FS_VERT = /* glsl */ `
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

// A clip-space triangle covering the frame, for background / 2D map passes.
export const fullscreenMesh = (material: THREE.Material) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const m = new THREE.Mesh(g, material);
  m.frustumCulled = false;
  return m;
};

export const fsMaterial = (frag: string, uniforms: Record<string, THREE.IUniform>, extra: Partial<THREE.ShaderMaterialParameters> = {}) =>
  new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: FS_VERT,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
    ...extra,
  });

// Parse "#RRGGBB" directly. (THREE.Color would apply colour management, which
// R3F re-enables on canvas creation; all colours here are display values.)
export const hexToRGB = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
export const vec3Of = (hex: string) => new THREE.Vector3(...hexToRGB(hex));
