import * as THREE from "three";
import { FRAG_OUT } from "./glsl";

/**
 * Full-screen background drawn behind everything: a base colour plus soft
 * elliptical hazes given in screen space (x,y in 0..1, 0,0 = bottom-left).
 */
export type Haze = { x: number; y: number; rx: number; ry: number; color: string; strength: number };

export const makeBackdrop = (base: string, hazes: Haze[]) => {
  const MAX = 4;
  const hz = hazes.slice(0, MAX);
  const uniforms = {
    base: { value: new THREE.Color(base) },
    hazePos: { value: hz.map((h) => new THREE.Vector4(h.x, h.y, h.rx, h.ry)).concat(Array.from({ length: MAX - hz.length }, () => new THREE.Vector4(0, 0, 1, 1))) },
    hazeCol: { value: hz.map((h) => new THREE.Color(h.color).multiplyScalar(h.strength)).concat(Array.from({ length: MAX - hz.length }, () => new THREE.Color(0, 0, 0))) },
  };
  const mat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms,
    depthWrite: false,
    depthTest: false,
    vertexShader: /* glsl */ `out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }`,
    fragmentShader: /* glsl */ `${FRAG_OUT}
uniform vec3 base;
uniform vec4 hazePos[${MAX}];
uniform vec3 hazeCol[${MAX}];
in vec2 vUv;
void main() {
  vec3 c = base;
  for (int i = 0; i < ${MAX}; i++) {
    vec2 d = (vUv - hazePos[i].xy) / hazePos[i].zw;
    c += hazeCol[i] * exp(-dot(d, d));
  }
  gl_FragColor = vec4(c, 1.0);
}`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return mesh;
};
