import * as THREE from "three";
import { DOF_TEXTURE, DOF_UNIFORMS, HASH } from "./glsl";
import type { Shared } from "./Stage";

// Plane whose uv runs from -m to 1+m, so blurred content can spill past the
// texture's edge (samples outside [0,1] read as transparent).
export const marginPlane = (w: number, h: number, m = 0.04) => {
  const g = new THREE.PlaneGeometry(w * (1 + 2 * m), h * (1 + 2 * m));
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, -m + uv.getX(i) * (1 + 2 * m), -m + uv.getY(i) * (1 + 2 * m));
  return g;
};

export const STD_VERT = /* glsl */ `
varying vec2 vUv;
varying float vDepth;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vec4 mv = viewMatrix * wp;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

// A textured plane with DoF; colour = texture * uGain, premultiplied output.
export const texPlaneMaterial = (
  shared: Shared,
  map: THREE.Texture,
  opts: { gain?: THREE.Color; opacity?: number; additive?: boolean } = {},
) =>
  new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      tMap: { value: map },
      uGain: { value: opts.gain ?? new THREE.Color(1, 1, 1) },
      uOpacity: { value: opts.opacity ?? 1 },
    },
    vertexShader: STD_VERT,
    fragmentShader: /* glsl */ `
      uniform sampler2D tMap; uniform vec3 uGain; uniform float uOpacity;
      varying vec2 vUv; varying float vDepth;
      ${HASH}
      ${DOF_UNIFORMS}
      ${DOF_TEXTURE}
      void main() {
        float coc = cocFrac(vDepth) * uRes.y;
        vec4 c = dofTexture(tMap, vUv, coc);
        gl_FragColor = vec4(c.rgb * uGain * uOpacity, c.a * uOpacity);
      }`,
    transparent: true,
    depthWrite: false,
    blending: opts.additive ? THREE.AdditiveBlending : THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    premultipliedAlpha: true,
  });

// Canvas content is drawn non-premultiplied; texPlaneMaterial expects
// premultiplied rgb, so planes that need it multiply in the shader instead.
export const premulBlend = {
  transparent: true,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneMinusSrcAlphaFactor,
  blendSrcAlpha: THREE.OneFactor,
  blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
} as const;

// Pure additive light (alpha ignored).
export const addBlend = {
  transparent: true,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
  blendSrcAlpha: THREE.ZeroFactor,
  blendDstAlpha: THREE.OneFactor,
} as const;
