import * as THREE from "three";

// Shared point-sprite code with single-pass depth of field.
//
// Each point carries "light" proportional to (base size)^2. The sprite is
// drawn at diameter D = sqrt(base^2 + coc^2), clamped to >= MIN_PX so that
// sub-pixel points never alias, and its peak is scaled by base^2 / D^2 so a
// defocused point spreads the same light over a larger disc instead of
// getting brighter. Small sprites use a gaussian profile, defocused ones a
// flat bokeh disc with a soft rim.

export const SPRITE_VERT_HEAD = /* glsl */ `
uniform float uProj;     // pixels per world unit at distance 1
uniform float uPx;       // drawing-buffer height / 2160
uniform float uFocus;    // focus distance (world units)
uniform float uAperture; // CoC diameter at infinity, in 4K pixels
uniform float uMaxPx;    // largest sprite diameter, in 4K pixels
uniform float uTime;     // loop phase 0..1
varying vec3 vColor;
varying float vSoft;
const float TAU = 6.28318530718;

void sprite(vec4 mv, float worldSize, vec3 color) {
  float dist = max(-mv.z, 1e-3);
  float base = worldSize * uProj / dist;
  float coc = uAperture * uPx * abs(1.0 - uFocus / dist);
  float d = sqrt(base * base + coc * coc);
  float D = clamp(d, 1.6, max(uMaxPx * uPx, 1.6));
  vColor = color * (base * base) / (D * D);
  vSoft = smoothstep(0.35, 0.9, coc / max(d, 1e-4));
  gl_PointSize = D;
  gl_Position = projectionMatrix * mv;
}
`;

export const SPRITE_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vSoft;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  float g = exp(-r2 * 5.0);
  float disc = 1.0 - smoothstep(0.55, 1.0, r2);
  float a = mix(g, disc * 0.29, vSoft);
  gl_FragColor = vec4(vColor * a, 1.0);
}
`;

export type SpriteUniforms = {
  uProj: { value: number };
  uPx: { value: number };
  uFocus: { value: number };
  uAperture: { value: number };
  uMaxPx: { value: number };
  uTime: { value: number };
  [k: string]: { value: unknown };
};

export const spriteMaterial = (
  vertexBody: string,
  uniforms: Record<string, { value: unknown }>,
  base: { px: number; height: number; fovDeg: number; focus: number; aperture: number; maxPx: number },
  fragment = SPRITE_FRAG,
) =>
  new THREE.ShaderMaterial({
    vertexShader: SPRITE_VERT_HEAD + vertexBody,
    fragmentShader: fragment,
    uniforms: {
      uProj: { value: base.height / (2 * Math.tan(((base.fovDeg / 2) * Math.PI) / 180)) },
      uPx: { value: base.px },
      uFocus: { value: base.focus },
      uAperture: { value: base.aperture },
      uMaxPx: { value: base.maxPx },
      uTime: { value: 0 },
      ...uniforms,
    },
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });

export const pointsFrom = (
  attrs: Record<string, { array: Float32Array; size: number }>,
  material: THREE.Material,
) => {
  const g = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(attrs)) {
    g.setAttribute(name, new THREE.BufferAttribute(a.array, a.size));
  }
  const p = new THREE.Points(g, material);
  p.frustumCulled = false;
  return p;
};
