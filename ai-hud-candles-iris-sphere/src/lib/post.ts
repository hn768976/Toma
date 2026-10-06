import * as THREE from "three";
import { HASH } from "./glsl";

// Final image pipeline:
//   scene (HDR, 4x MSAA) -> bloom (threshold, dual-filter mip chain)
//   -> composite: exposure, bloom, soft tonemap, vignette, sRGB encode,
//      grain (1.5%, hash of pixel + frame) and ±1/255 TPDF dither — last.
// No temporal effects: every frame is computed from scratch.

export type PostParams = {
  exposure: number;
  bloomStrength: number;
  bloomThreshold: number;
  bloomKnee: number;
  bloomTint?: [number, number, number];
  vignette: number;
  grain: number; // display-space amplitude, ~0.015
  saturation?: number;
  lift?: [number, number, number]; // added before tonemap, for black level tint
  tonemap?: boolean; // default true; light scenes keep their whites linear
};

export const defaultPost: PostParams = {
  exposure: 1,
  bloomStrength: 0.8,
  bloomThreshold: 0.9,
  bloomKnee: 0.5,
  vignette: 0.25,
  grain: 0.015,
};

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const PREFILTER = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThreshold, uKnee;
varying vec2 vUv;
void main() {
  vec3 c = vec3(0.0);
  c += texture(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  c += texture(tSrc, vUv + uTexel * vec2( 1.0, -1.0)).rgb;
  c += texture(tSrc, vUv + uTexel * vec2(-1.0,  1.0)).rgb;
  c += texture(tSrc, vUv + uTexel * vec2( 1.0,  1.0)).rgb;
  c *= 0.25;
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-5);
  float contrib = max(soft, br - uThreshold) / max(br, 1e-5);
  gl_FragColor = vec4(min(c * contrib, vec3(64.0)), 1.0);
}`;

const DOWN = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec2 h = uTexel;
  vec3 s = texture(tSrc, vUv).rgb * 4.0;
  s += texture(tSrc, vUv + vec2(-h.x, -h.y)).rgb;
  s += texture(tSrc, vUv + vec2( h.x, -h.y)).rgb;
  s += texture(tSrc, vUv + vec2(-h.x,  h.y)).rgb;
  s += texture(tSrc, vUv + vec2( h.x,  h.y)).rgb;
  gl_FragColor = vec4(s / 8.0, 1.0);
}`;

const UP = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uWeight;
varying vec2 vUv;
void main() {
  vec2 h = uTexel;
  vec3 s = vec3(0.0);
  s += texture(tSrc, vUv + vec2(-2.0 * h.x, 0.0)).rgb;
  s += texture(tSrc, vUv + vec2( 2.0 * h.x, 0.0)).rgb;
  s += texture(tSrc, vUv + vec2(0.0, -2.0 * h.y)).rgb;
  s += texture(tSrc, vUv + vec2(0.0,  2.0 * h.y)).rgb;
  s += texture(tSrc, vUv + vec2(-h.x, -h.y)).rgb * 2.0;
  s += texture(tSrc, vUv + vec2( h.x, -h.y)).rgb * 2.0;
  s += texture(tSrc, vUv + vec2(-h.x,  h.y)).rgb * 2.0;
  s += texture(tSrc, vUv + vec2( h.x,  h.y)).rgb * 2.0;
  gl_FragColor = vec4(s / 12.0 * uWeight, 1.0);
}`;

const COMPOSITE = /* glsl */ `
uniform sampler2D tScene; uniform sampler2D tBloom;
uniform float uExposure, uBloom, uVignette, uGrain, uSat, uTone;
uniform vec3 uBloomTint, uLift;
uniform vec2 uRes; uniform float uFrame;
varying vec2 vUv;
${HASH}
vec3 tonemap(vec3 x) {
  // Linear below 0.6, smooth shoulder to 1.0 above: keeps colours, lets cores go white.
  vec3 k = vec3(0.6);
  vec3 over = max(x - k, 0.0);
  vec3 sh = k + (1.0 - k) * (1.0 - exp(-over / (1.0 - k)));
  vec3 m = mix(x, sh, step(k, x));
  // Very bright light bleeds towards white.
  float peak = max(x.r, max(x.g, x.b));
  float w = clamp((peak - 1.2) / 6.0, 0.0, 0.6);
  return mix(m, vec3(max(m.r, max(m.g, m.b))), w * 0.6);
}
vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  vec3 c = texture(tScene, vUv).rgb * uExposure;
  c += texture(tBloom, vUv).rgb * uBloom * uBloomTint;
  c += uLift;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = max(mix(vec3(l), c, uSat), 0.0);
  vec2 q = vUv - 0.5; q.x *= uRes.x / uRes.y;
  c *= 1.0 - uVignette * smoothstep(0.35, 1.25, length(q));
  c = toSRGB(uTone > 0.5 ? tonemap(c) : c);
  uvec2 px = uvec2(gl_FragCoord.xy);
  uint f = uint(uFrame);
  vec3 h1 = hash33u(uvec3(px, f * 2u + 1u));
  vec3 h2 = hash33u(uvec3(px, f * 2u + 2u));
  // Grain: luminance-shaped, mostly mid-tones.
  float g = (h1.x + h1.y - 1.0) * uGrain;
  c += g * (0.35 + 0.65 * smoothstep(0.0, 0.4, l));
  // TPDF dither, +-1/255, after everything else.
  c += (h2 - hash33u(uvec3(px, f * 2u + 77u))) / 255.0;
  gl_FragColor = vec4(c, 1.0);
}`;

const LEVELS = 7;

export class PostFX {
  private w = 0;
  private h = 0;
  sceneRT!: THREE.WebGLRenderTarget;
  private mips: THREE.WebGLRenderTarget[] = [];
  private quad: THREE.Mesh;
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private qScene = new THREE.Scene();
  private prefilter: THREE.ShaderMaterial;
  private down: THREE.ShaderMaterial;
  private up: THREE.ShaderMaterial;
  private composite: THREE.ShaderMaterial;

  constructor() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    const mk = (fs: string, uniforms: Record<string, THREE.IUniform>) =>
      new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: fs, uniforms, depthTest: false, depthWrite: false });
    this.prefilter = mk(PREFILTER, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 1 }, uKnee: { value: 0.5 } });
    this.down = mk(DOWN, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.up = mk(UP, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uWeight: { value: 1 } });
    this.up.blending = THREE.AdditiveBlending;
    this.up.transparent = true;
    this.composite = mk(COMPOSITE, {
      tScene: { value: null }, tBloom: { value: null }, uExposure: { value: 1 }, uBloom: { value: 1 },
      uVignette: { value: 0 }, uGrain: { value: 0.015 }, uSat: { value: 1 }, uBloomTint: { value: new THREE.Vector3(1, 1, 1) },
      uLift: { value: new THREE.Vector3() }, uTone: { value: 1 }, uRes: { value: new THREE.Vector2() }, uFrame: { value: 0 },
    });
    this.quad = new THREE.Mesh(g, this.composite);
    this.quad.frustumCulled = false;
    this.qScene.add(this.quad);
  }

  private ensure(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.sceneRT?.dispose();
    this.mips.forEach((m) => m.dispose());
    this.sceneRT = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType, samples: 4, depthBuffer: true, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    });
    this.mips = [];
    let mw = w, mh = h;
    for (let i = 0; i < LEVELS; i++) {
      mw = Math.max(2, Math.round(mw / 2));
      mh = Math.max(2, Math.round(mh / 2));
      this.mips.push(new THREE.WebGLRenderTarget(mw, mh, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }));
    }
  }

  private pass(r: THREE.WebGLRenderer, m: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null, clear = true) {
    this.quad.material = m;
    r.setRenderTarget(target);
    if (clear) r.clear(true, false, false);
    r.render(this.qScene, this.cam);
  }

  render(r: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, frame: number, p: PostParams, clearColor: THREE.Color) {
    const size = r.getDrawingBufferSize(new THREE.Vector2());
    this.ensure(size.x, size.y);
    r.autoClear = false;
    r.setClearColor(clearColor, 1);
    r.setRenderTarget(this.sceneRT);
    r.clear(true, true, true);
    r.render(scene, camera);

    r.setClearColor(0x000000, 1);
    const pre = this.prefilter.uniforms;
    pre.tSrc.value = this.sceneRT.texture;
    pre.uTexel.value.set(0.5 / this.w, 0.5 / this.h);
    pre.uThreshold.value = p.bloomThreshold;
    pre.uKnee.value = p.bloomKnee;
    this.pass(r, this.prefilter, this.mips[0]);
    for (let i = 1; i < LEVELS; i++) {
      this.down.uniforms.tSrc.value = this.mips[i - 1].texture;
      this.down.uniforms.uTexel.value.set(0.5 / this.mips[i - 1].width, 0.5 / this.mips[i - 1].height);
      this.pass(r, this.down, this.mips[i]);
    }
    for (let i = LEVELS - 1; i > 0; i--) {
      this.up.uniforms.tSrc.value = this.mips[i].texture;
      this.up.uniforms.uTexel.value.set(0.5 / this.mips[i].width, 0.5 / this.mips[i].height);
      this.up.uniforms.uWeight.value = 1.0;
      this.pass(r, this.up, this.mips[i - 1], false);
    }
    const u = this.composite.uniforms;
    u.tScene.value = this.sceneRT.texture;
    u.tBloom.value = this.mips[0].texture;
    u.uExposure.value = p.exposure;
    u.uBloom.value = p.bloomStrength / LEVELS;
    u.uVignette.value = p.vignette;
    u.uGrain.value = p.grain;
    u.uSat.value = p.saturation ?? 1;
    u.uBloomTint.value.set(...(p.bloomTint ?? [1, 1, 1]));
    u.uLift.value.set(...(p.lift ?? [0, 0, 0]));
    u.uRes.value.set(this.w, this.h);
    u.uFrame.value = frame;
    u.uTone.value = p.tonemap === false ? 0 : 1;
    this.pass(r, this.composite, null);
  }
}
