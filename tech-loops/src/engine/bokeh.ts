import * as THREE from "three";
import { HASH } from "./glsl";
import { shaderMat } from "./material";
import { COC_GLSL, PERIODIC_GLSL, type PeriodicUniforms } from "./periodic";

/**
 * Tiny emissive lights drawn as depth-of-field bokeh: each light is a disc whose
 * radius is its own circle of confusion, with energy spread over the disc. They
 * are drawn after the DoF pass, tested against the scene depth at their centre.
 */
export interface BokehLight {
  x: number;
  y: number;
  /** Local z along the periodic strip, in [0, K*P). */
  z: number;
  color: THREE.Color;
  energy: number;
  /** Whole cycles per loop for twinkle (0 = steady). */
  twinkleK: number;
  twinklePhase: number;
  /** Sharp-size multiplier. */
  size: number;
}

const VERT = /* glsl */ `
${PERIODIC_GLSL}
${COC_GLSL}
in vec3 aPos;
in vec3 aCol;
in vec4 aPar; // energy, twinkleK, twinklePhase, size
uniform sampler2D tDepth;
uniform vec2 uRes;
uniform float uNear;
uniform float uFar;
uniform float uSharpR;   // sharp radius, fraction of frame height
uniform float uF;        // frame
uniform float uGain;
uniform vec3 uOffset;    // whole-strip offset (world)
uniform vec2 uFade;      // view depths where lights fade out into the haze
uniform float uFalloff;
uniform float uCocScale; // bokeh size relative to the scene's DoF
out vec2 vLocal;
out float vR;
out vec3 vC;
float viewDepthAt(vec2 uv) {
  float d = texture(tDepth, uv).x;
  float z = d * 2.0 - 1.0;
  return 2.0 * uNear * uFar / ((uFar + uNear) - z * (uFar - uNear));
}
void main() {
  vec3 wp = vec3(aPos.x, aPos.y, wrapZ(aPos.z)) + uOffset;
  vec4 vp = viewMatrix * vec4(wp, 1.0);
  float depth = -vp.z;
  vec4 cp = projectionMatrix * vp;
  if (depth < uNear * 1.5 || cp.w <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec2 ndc = cp.xy / cp.w;
  vec2 suv = ndc * 0.5 + 0.5;
  // Soft occlusion: 5 depth taps around the centre.
  float vis = 0.0;
  vec2 px = 1.5 / uRes;
  for (int i = 0; i < 5; i++) {
    vec2 o = i == 0 ? vec2(0.0) : i == 1 ? vec2(px.x, 0.0) : i == 2 ? vec2(-px.x, 0.0) : i == 3 ? vec2(0.0, px.y) : vec2(0.0, -px.y);
    float sd = viewDepthAt(clamp(suv + o, vec2(0.0), vec2(1.0)));
    vis += step(depth, sd * 1.01 + 0.03);
  }
  vis /= 5.0;
  float coc = abs(cocOf(depth)) * uRes.y * uCocScale;
  float r0 = uSharpR * aPar.w * uRes.y;
  float r = max(coc, r0);
  float tw = aPar.y > 0.0 ? 0.55 + 0.45 * cos(6.2831853 * (mod(aPar.y * uF, 600.0) / 600.0 + aPar.z)) : 1.0;
  // Energy falloff with blur (2.0 = physically energy-conserving; lower keeps
  // big near bokeh visible, as a lens with bright highlights would show them).
  float peak = aPar.x * tw * vis * pow(r0 / r, uFalloff) * uGain;
  // Fade out over the far haze so lights do not pop at the strip's end.
  float far = 1.0 - smoothstep(uFade.x, uFade.y, depth);
  vC = aCol * peak * far;
  float ext = r + 1.5;
  vLocal = position.xy * ext;
  vR = r;
  cp.xy += position.xy * ext * 2.0 / uRes * cp.w;
  gl_Position = (vis * far <= 0.0) ? vec4(2.0, 2.0, 2.0, 1.0) : cp;
}
`;

const FRAG = /* glsl */ `
precision highp float;
in vec2 vLocal;
in float vR;
in vec3 vC;
uniform float uSquare; // 0 round .. 1 square (LED-like)
void main() {
  vec2 a = abs(vLocal);
  float d = mix(length(vLocal), max(a.x, a.y) * 1.08, uSquare);
  float prof;
  if (vR < 2.5) {
    prof = exp(-d * d / (vR * vR * 0.55));
  } else {
    float disc = 1.0 - smoothstep(vR - 1.0, vR + 0.5, d);
    float rim = 1.0 + 0.35 * smoothstep(vR * 0.55, vR, d);
    prof = disc * rim * 0.8;
  }
  gl_FragColor = vec4(vC * prof, 1.0);
}
`;

export const createBokeh = (lights: BokehLight[], pu: PeriodicUniforms) => {
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  const pos = new Float32Array(lights.length * 3);
  const col = new Float32Array(lights.length * 3);
  const par = new Float32Array(lights.length * 4);
  lights.forEach((l, i) => {
    pos.set([l.x, l.y, l.z], i * 3);
    col.set([l.color.r, l.color.g, l.color.b], i * 3);
    par.set([l.energy, l.twinkleK, l.twinklePhase, l.size], i * 4);
  });
  geo.setAttribute("aPos", new THREE.InstancedBufferAttribute(pos, 3));
  geo.setAttribute("aCol", new THREE.InstancedBufferAttribute(col, 3));
  geo.setAttribute("aPar", new THREE.InstancedBufferAttribute(par, 4));
  geo.instanceCount = lights.length;
  const mat = shaderMat({
    vertexShader: VERT,
    fragmentShader: HASH + FRAG,
    uniforms: {
      ...pu,
      tDepth: { value: null },
      uRes: { value: new THREE.Vector2() },
      uNear: { value: 0.1 },
      uFar: { value: 100 },
      uSharpR: { value: 0.0016 },
      uF: { value: 0 },
      uGain: { value: 1 },
      uOffset: { value: new THREE.Vector3() },
      uFade: { value: new THREE.Vector2(1e3, 2e3) },
      uFalloff: { value: 2 },
      uSquare: { value: 0 },
      uCocScale: { value: 1 },
    },
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  return {
    mat,
    scene,
    update(camera: THREE.PerspectiveCamera, depth: THREE.Texture, w: number, h: number, frame: number) {
      const u = mat.uniforms;
      u.tDepth.value = depth;
      u.uRes.value.set(w, h);
      u.uNear.value = camera.near;
      u.uFar.value = camera.far;
      u.uF.value = frame;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
};
