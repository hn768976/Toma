import * as THREE from "three";
import { GLSL_BLUR_SAMPLE, GLSL_DOF, GLSL_HASH } from "./glsl";

THREE.ColorManagement.enabled = false;

export type DofSettings = {
  /** 0 = screen band (tilt-shift), 1 = view-depth thin lens */
  mode: 0 | 1;
  /** band centre (0..1, screen y from bottom) or focus distance */
  a: number;
  /** band half width or aperture */
  b: number;
  /** band ramp width */
  c: number;
  /** max blur radius, px at 2160p */
  max: number;
  /** blur everywhere, px at 2160p */
  min?: number;
};

export const dofUniforms = (d: DofSettings) => ({
  uDof: { value: new THREE.Vector4(d.mode, d.a, d.b, d.c) },
  uDofMax: { value: d.max },
  uDofMin: { value: d.min ?? 0 },
  uRes: { value: new THREE.Vector2(3840, 2160) },
  uPxScale: { value: 1 },
});

const HUD_VERT = /* glsl */ `
out vec2 vUv;
out float vViewZ;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewZ = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const HUD_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
in float vViewZ;
out vec4 fragColor;
uniform sampler2D uMap;
uniform float uNow;        // current time in the texture's build timeline (0..1)
uniform float uEdge;       // softness of the reveal edge (timeline units)
uniform float uFlash;      // brightness boost of freshly revealed pixels
uniform float uFlashLen;
uniform vec3 uLine;
uniform vec3 uFill;
uniform float uOpacity;
uniform float uFillOpacity;
${GLSL_DOF}
${GLSL_BLUR_SAMPLE}
void main() {
  float r = cocPx(vViewZ);
  if (blurProbe(uMap, vUv, r) < 0.0008) discard;
  vec4 s = blurTex(uMap, vUv, r);
  float cov = s.a;
  if (cov < 0.002) discard;
  float T = s.b / max(cov, 1e-4);
  float dt = uNow - T;
  float reveal = smoothstep(-uEdge, 0.0, dt);
  float flash = 1.0 + uFlash * exp(-max(dt, 0.0) / uFlashLen) * step(0.0, dt);
  vec3 col = (uLine * s.r + uFill * s.g * uFillOpacity) * reveal * flash;
  // energy spreads with blur: keep blurred glow from washing out
  col *= mix(1.0, 0.75, clamp(r / (40.0 * uPxScale), 0.0, 1.0));
  fragColor = vec4(col * uOpacity, 1.0);
}
`;

export type HudMatOpts = {
  map: THREE.Texture;
  line: THREE.ColorRepresentation;
  fill?: THREE.ColorRepresentation;
  dof: DofSettings;
  edge?: number;
  flash?: number;
  flashLen?: number;
  fillOpacity?: number;
};

/** The shared HUD material: time-channel reveal + in-material DoF, additive. */
export const makeHudMaterial = (o: HudMatOpts) =>
  new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: HUD_VERT,
    fragmentShader: HUD_FRAG,
    uniforms: {
      uMap: { value: o.map },
      uNow: { value: 1 },
      uEdge: { value: o.edge ?? 0.004 },
      uFlash: { value: o.flash ?? 1.2 },
      uFlashLen: { value: o.flashLen ?? 0.02 },
      uLine: { value: new THREE.Color(o.line) },
      uFill: { value: new THREE.Color(o.fill ?? o.line) },
      uOpacity: { value: 1 },
      uFillOpacity: { value: o.fillOpacity ?? 0.35 },
      ...dofUniforms(o.dof),
    },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

const TEX_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
in float vViewZ;
out vec4 fragColor;
uniform sampler2D uMap;
uniform vec3 uTint;
uniform float uOpacity;
uniform float uAdditive;
${GLSL_DOF}
${GLSL_BLUR_SAMPLE}
void main() {
  float r = cocPx(vViewZ);
  vec4 s = blurTex(uMap, vUv, r);
  vec3 col = s.rgb * uTint;
  if (uAdditive > 0.5) fragColor = vec4(col * s.a * uOpacity, 1.0);
  else fragColor = vec4(col, s.a * uOpacity);
}
`;

/** Colour texture with in-material DoF (normal or additive blending). */
export const makeTexMaterial = (o: { map: THREE.Texture; dof: DofSettings; tint?: THREE.ColorRepresentation; additive?: boolean; opacity?: number; depthTest?: boolean; depthWrite?: boolean }) =>
  new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: HUD_VERT,
    fragmentShader: TEX_FRAG,
    uniforms: {
      uMap: { value: o.map },
      uTint: { value: new THREE.Color(o.tint ?? "#ffffff") },
      uOpacity: { value: o.opacity ?? 1 },
      uAdditive: { value: o.additive ? 1 : 0 },
      ...dofUniforms(o.dof),
    },
    transparent: true,
    depthWrite: o.depthWrite ?? false,
    depthTest: o.depthTest ?? true,
    blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: THREE.DoubleSide,
  });

/** Update per-frame output-size uniforms on any material that has them. */
export const setResUniforms = (mat: THREE.ShaderMaterial, w: number, h: number) => {
  if (mat.uniforms.uRes) mat.uniforms.uRes.value.set(w, h);
  if (mat.uniforms.uPxScale) mat.uniforms.uPxScale.value = h / 2160;
};

export { GLSL_HASH };
