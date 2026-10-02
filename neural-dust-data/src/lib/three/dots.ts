import * as THREE from "three";
import { DOF_GLSL, DofUniforms } from "./post";

/** Small round glowing dots (gl.POINTS), size in 4K pixels, additive, DOF-weighted. */
export const makeDots = (
  dof: DofUniforms,
  view: { uPxScale: THREE.IUniform<number> },
  pos: number[],
  rgb: number[],
  size4k: number,
) => {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("aCol", new THREE.Float32BufferAttribute(rgb, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...dof, uPx: view.uPxScale, uSize: { value: size4k } },
    vertexShader: /* glsl */ `
      attribute vec3 aCol; uniform float uPx; uniform float uSize;
      varying vec3 vCol; varying float vDepth; varying float vA;
      void main() {
        vec4 vp = modelViewMatrix * vec4(position, 1.0);
        vDepth = -vp.z; vCol = aCol;
        float s = uSize * uPx * 6.0 / max(vDepth, 0.5);
        gl_PointSize = max(s, 1.6);
        vA = min(1.0, (s * s) / (1.6 * 1.6));
        gl_Position = projectionMatrix * vp;
      }`,
    fragmentShader: /* glsl */ `
      ${DOF_GLSL}
      varying vec3 vCol; varying float vDepth; varying float vA;
      void main() {
        float w = sliceWeight(vDepth);
        if (w <= 0.0) discard;
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float a = exp(-r * r * 3.0);
        gl_FragColor = vec4(vCol * a * vA * w * 1.6, 1.0);
      }`,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
};
