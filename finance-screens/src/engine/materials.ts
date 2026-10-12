import * as THREE from "three";

// Screen material: shows a canvas texture and writes a signed circle of
// confusion into alpha (negative = in front of focus, positive = behind),
// from a thin-lens model plus an optional world-space "focus slab" term.

export type CocParams = {
  focus: number; // focus distance (view-space units)
  aperture: number; // coc = aperture * (z - focus) / z
  band: number; // dead zone around focus
  bias: number;
  // extra term: k * max(0, |dot(world - p, n)| - band)
  extraK: number;
  extraP: THREE.Vector3;
  extraN: THREE.Vector3;
  extraBand: number;
};

export const defaultCoc = (): CocParams => ({
  focus: 5,
  aperture: 1,
  band: 0.02,
  bias: 0,
  extraK: 0,
  extraP: new THREE.Vector3(),
  extraN: new THREE.Vector3(0, 1, 0),
  extraBand: 0,
});

const VERT = /* glsl */ `
out vec2 vUv;
out float vViewZ;
out vec3 vWorld;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vec4 mv = viewMatrix * w;
  vViewZ = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D map;
uniform vec2 uRepeat;
uniform vec2 uOffset;
uniform float uGain;
uniform float uFocus;
uniform float uAperture;
uniform float uBand;
uniform float uBias;
uniform float uExtraK;
uniform vec3 uExtraP;
uniform vec3 uExtraN;
uniform float uExtraBand;
uniform float uAdditive; // 0 opaque, 1 add (coc = max), 2 add (sharpens coc)
uniform float uOrthoCoc; // >0: constant coc (orthographic layers)
uniform float uEdgeFade; // fade near uv edges (0 = off)
in vec2 vUv;
in float vViewZ;
in vec3 vWorld;
out vec4 outColor;
void main() {
  vec3 c = texture(map, vUv * uRepeat + uOffset).rgb * uGain;
  if (uEdgeFade > 0.0) {
    vec2 e = min(vUv, 1.0 - vUv);
    c *= smoothstep(0.0, uEdgeFade, min(e.x, e.y));
  }
  float coc;
  if (uOrthoCoc != 0.0) {
    coc = uOrthoCoc;
  } else {
    float z = max(vViewZ, 1e-3);
    coc = uAperture * (z - uFocus) / z;
    coc = sign(coc) * max(0.0, abs(coc) - uBand);
  }
  float ex = uExtraK * max(0.0, abs(dot(vWorld - uExtraP, uExtraN)) - uExtraBand);
  coc = coc >= 0.0 ? coc + ex : coc - ex;
  coc = clamp(coc + uBias, -1.0, 1.0);
  if (uAdditive > 2.5) {
    // cutout: opaque where there is content, transparent elsewhere
    if (max(c.r, max(c.g, c.b)) < 0.03) discard;
    outColor = vec4(c, coc);
  } else if (uAdditive > 1.5) {
    float m = smoothstep(0.0, 0.05, max(c.r, max(c.g, c.b)));
    outColor = vec4(c, m);
  } else if (uAdditive > 0.5) {
    float m = smoothstep(0.0, 0.06, max(c.r, max(c.g, c.b)));
    outColor = vec4(c, abs(coc) * m);
  } else {
    outColor = vec4(c, coc);
  }
}`;

// "opaque": writes colour + coc.
// "addBlur": adds colour; coc = max(existing, own) where it has content.
// "addSharp": adds colour; pulls coc toward 0 where it has content.
// "cutout": opaque, but discards near-black texels (own depth + coc).
export type BlendMode = "opaque" | "addBlur" | "addSharp" | "cutout";

export class ScreenMaterial extends THREE.ShaderMaterial {
  constructor(map: THREE.Texture, mode: BlendMode | boolean = "opaque") {
    if (mode === true) mode = "addBlur";
    if (mode === false) mode = "opaque";
    const additive = mode === "addBlur" || mode === "addSharp";
    super({
      glslVersion: THREE.GLSL3,
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        map: { value: map },
        uRepeat: { value: new THREE.Vector2(1, 1) },
        uOffset: { value: new THREE.Vector2(0, 0) },
        uGain: { value: 1 },
        uFocus: { value: 5 },
        uAperture: { value: 1 },
        uBand: { value: 0.02 },
        uBias: { value: 0 },
        uExtraK: { value: 0 },
        uExtraP: { value: new THREE.Vector3() },
        uExtraN: { value: new THREE.Vector3(0, 1, 0) },
        uExtraBand: { value: 0 },
        uAdditive: { value: mode === "cutout" ? 3 : mode === "addSharp" ? 2 : additive ? 1 : 0 },
        uOrthoCoc: { value: 0 },
        uEdgeFade: { value: 0 },
      },
      side: THREE.DoubleSide,
      depthWrite: !additive,
      depthTest: true,
      transparent: additive,
    });
    if (additive) {
      // colour adds; coc (alpha) keeps the max so overlays can blur
      this.blending = THREE.CustomBlending;
      this.blendEquation = THREE.AddEquation;
      this.blendSrc = THREE.OneFactor;
      this.blendDst = THREE.OneFactor;
      if (mode === "addSharp") {
        this.blendEquationAlpha = THREE.AddEquation;
        this.blendSrcAlpha = THREE.ZeroFactor;
        this.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
      } else {
        this.blendEquationAlpha = THREE.MaxEquation;
        this.blendSrcAlpha = THREE.OneFactor;
        this.blendDstAlpha = THREE.OneFactor;
      }
    }
  }

  setCoc(p: Partial<CocParams>) {
    const u = this.uniforms;
    if (p.focus !== undefined) u.uFocus.value = p.focus;
    if (p.aperture !== undefined) u.uAperture.value = p.aperture;
    if (p.band !== undefined) u.uBand.value = p.band;
    if (p.bias !== undefined) u.uBias.value = p.bias;
    if (p.extraK !== undefined) u.uExtraK.value = p.extraK;
    if (p.extraP) u.uExtraP.value.copy(p.extraP);
    if (p.extraN) u.uExtraN.value.copy(p.extraN).normalize();
    if (p.extraBand !== undefined) u.uExtraBand.value = p.extraBand;
    return this;
  }
}
