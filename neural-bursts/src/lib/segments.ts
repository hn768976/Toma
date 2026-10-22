import * as THREE from "three";
import { additive, instanced, RIBBON_CHUNK, RIBBON_FRAG, ribbonQuad } from "./glsl";

// Static 3D segments drawn as screen-space ribbons, with depth-of-field:
// defocused segments get wider and dimmer, like the soft dendrites in the
// neuron reference.

const SEGMENT_VERT = /* glsl */ `
attribute vec2 corner;
attribute vec3 aA;
attribute vec3 aB;
attribute vec2 aWidth;  // half width at A / B (1080p px, or world units if uWorld)
attribute vec3 aColor;
attribute vec2 aAlpha;  // alpha at A / B
uniform float uOpacity;
uniform float uPx;
uniform float uFocus;
uniform float uAperture;
uniform float uMaxCoc;
uniform float uWorld;
uniform float uProjScale;
varying vec3 vColor;
varying float vAlpha;
varying float vAcross;
${RIBBON_CHUNK}
void main() {
  vec3 a = (modelViewMatrix * vec4(aA, 1.0)).xyz;
  vec3 b = (modelViewMatrix * vec4(aB, 1.0)).xyz;
  float depth = mix(-a.z, -b.z, corner.x);
  float w = mix(aWidth.x, aWidth.y, corner.x);
  // World-space widths are converted to 1080p pixels at this depth.
  if (uWorld > 0.5) w = w * uProjScale / max(depth, 0.01) / uPx;
  float coc = uAperture > 0.0
    ? min(abs(depth - uFocus) * uAperture / max(depth, 0.1) * uFocus, uMaxCoc) * 0.5
    : 0.0;
  float ww = max(w, coc);
  float behind;
  gl_Position = ribbon(a, b, corner, ww * uPx, 0.0, behind);
  vColor = aColor;
  vAlpha = uOpacity * mix(aAlpha.x, aAlpha.y, corner.x) * clamp(w / ww * 1.25, 0.06, 1.0)
    * smoothstep(0.05, 0.6, depth);
  vAcross = corner.y;
}`;

export type SegmentSpec = {
  a: [number, number, number];
  b: [number, number, number];
  width: [number, number];
  color: [number, number, number];
  alpha: [number, number];
};

export type SegmentUniforms = {
  uOpacity: THREE.IUniform<number>;
  uPx: THREE.IUniform<number>;
  uFocus: THREE.IUniform<number>;
  uAperture: THREE.IUniform<number>;
  uMaxCoc: THREE.IUniform<number>;
  uRes: THREE.IUniform<THREE.Vector2>;
  uNear: THREE.IUniform<number>;
  uWorld: THREE.IUniform<number>;
  uProjScale: THREE.IUniform<number>;
};

export const makeSegments = (
  segs: SegmentSpec[],
  ctx: { px: number; width: number; height: number },
) => {
  const n = segs.length;
  const g = ribbonQuad();
  const A = new Float32Array(n * 3);
  const B = new Float32Array(n * 3);
  const W = new Float32Array(n * 2);
  const C = new Float32Array(n * 3);
  const AL = new Float32Array(n * 2);
  segs.forEach((s, i) => {
    A.set(s.a, i * 3);
    B.set(s.b, i * 3);
    W.set(s.width, i * 2);
    C.set(s.color, i * 3);
    AL.set(s.alpha, i * 2);
  });
  instanced(g, "aA", A, 3);
  instanced(g, "aB", B, 3);
  instanced(g, "aWidth", W, 2);
  instanced(g, "aColor", C, 3);
  instanced(g, "aAlpha", AL, 2);
  g.instanceCount = n;
  const uniforms: SegmentUniforms = {
    uOpacity: { value: 1 },
    uPx: { value: ctx.px },
    uFocus: { value: 5 },
    uAperture: { value: 0 },
    uMaxCoc: { value: 60 },
    uRes: { value: new THREE.Vector2(ctx.width, ctx.height) },
    uNear: { value: 0.05 },
    uWorld: { value: 0 },
    uProjScale: { value: 1 },
  };
  const m = new THREE.ShaderMaterial({
    vertexShader: SEGMENT_VERT,
    fragmentShader: RIBBON_FRAG,
    uniforms,
    ...additive,
  });
  const mesh = new THREE.Mesh(g, m);
  mesh.frustumCulled = false;
  return { object: mesh, u: uniforms };
};
