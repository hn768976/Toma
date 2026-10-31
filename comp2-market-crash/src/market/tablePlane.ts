import * as THREE from "three";
import { SharedUniforms } from "../engine/layers";

/**
 * Textured 3D plane (ticker table) with per-pixel depth-of-field approximated
 * by mip-biased multi-tap sampling driven by the circle of confusion.
 */
const VERT = /* glsl */ `
varying vec2 vUv;
varying float vD;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vD = -mv.z;
  vUv = uv;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
uniform float uTime;
uniform vec2 uViewport;
uniform float uFocus;
uniform float uAperture;
uniform float uResScale;
uniform float uFogDist;
uniform float uGain;
uniform sampler2D uTex;
uniform vec3 uTint;
uniform float uIntensity;
uniform vec4 uTiming;
uniform vec4 uUvRect;
uniform float uSeed;
uniform float uNearFade;
varying vec2 vUv;
varying float vD;
void main() {
  float appear = clamp((uTime - uTiming.x) / max(uTiming.y, 0.001), 0.0, 1.0);
  if (uTiming.w > 0.0) appear *= 1.0 - clamp((uTime - uTiming.z) / uTiming.w, 0.0, 1.0);
  if (appear <= 0.0 || vD < 0.05) discard;
  float coc = min(uAperture * uResScale * abs(vD - uFocus) / max(vD, 0.001), 600.0 * uResScale);
  vec2 uv = uUvRect.xy + vUv * uUvRect.zw;
  vec2 fw = max(fwidth(uv), vec2(1e-6));
  float bias = log2(1.0 + coc * 0.55);
  vec2 o = fw * coc * 0.33;
  vec3 c = texture2D(uTex, uv, bias).rgb * 0.28;
  c += texture2D(uTex, uv + vec2(o.x, o.y * 0.3), bias).rgb * 0.18;
  c += texture2D(uTex, uv - vec2(o.x, o.y * 0.3), bias).rgb * 0.18;
  c += texture2D(uTex, uv + vec2(-o.x * 0.3, o.y), bias).rgb * 0.18;
  c += texture2D(uTex, uv - vec2(-o.x * 0.3, o.y), bias).rgb * 0.18;
  float edge = smoothstep(0.0, 0.04, vUv.x) * smoothstep(1.0, 0.96, vUv.x)
             * smoothstep(0.0, 0.05, vUv.y) * smoothstep(1.0, 0.95, vUv.y);
  float fog = exp(-vD / uFogDist) * smoothstep(uNearFade * 0.45, uNearFade, vD);
  float flick = 0.94 + 0.06 * sin(uTime * 13.0 + uSeed * 10.0);
  vec3 col = c.r * uTint * uIntensity * edge * fog * appear * flick * uGain;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const createTablePlane = (opts: {
  texture: THREE.Texture;
  width: number;
  height: number;
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  tint: [number, number, number];
  intensity: number;
  appear: number;
  fadeOut?: [number, number];
  nearFade?: number;
  uvRect?: [number, number, number, number];
  uniforms: SharedUniforms;
  seed: number;
}) => {
  const geo = new THREE.PlaneGeometry(opts.width, opts.height);
  const u = opts.uniforms;
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: u.uTime,
      uViewport: u.uViewport,
      uFocus: u.uFocus,
      uAperture: u.uAperture,
      uResScale: u.uResScale,
      uFogDist: u.uFogDist,
      uGain: u.uGain,
      uTex: { value: opts.texture },
      uTint: { value: new THREE.Vector3(...opts.tint) },
      uIntensity: { value: opts.intensity },
      uTiming: {
        value: new THREE.Vector4(opts.appear, 0.8, ...(opts.fadeOut ?? [0, 0])),
      },
      uSeed: { value: opts.seed },
      uNearFade: { value: opts.nearFade ?? 9 },
      uUvRect: { value: new THREE.Vector4(...(opts.uvRect ?? [0, 0, 1, 1])) },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(opts.position);
  mesh.quaternion.copy(opts.quaternion);
  mesh.frustumCulled = false;
  return mesh;
};
