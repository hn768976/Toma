import * as THREE from "three";
import { LOOP } from "./rng";

// Post-processing chain, all hand-written so every pass is a pure function
// of its inputs (no TAA, no accumulation, no temporal state):
//
//   scene (HalfFloat, MSAA, alpha = signed circle-of-confusion)
//     -> DoF: half-res prefilter -> half-res gather (golden-angle spiral)
//             -> full-res combine with the sharp image
//     -> bloom: soft-threshold prefilter, dual-filter down/up chain
//     -> final: bloom add, vignette, grain (pixel hash of frame % 600),
//               ±1/255 triangular dither, written to the canvas.

export type PostParams = {
  background: THREE.Color;
  backgroundCoc: number; // [-1, 1] coc written where nothing is drawn
  cocMaxFrac: number; // max blur radius as a fraction of the frame height
  bloomStrength: number;
  bloomThreshold: number;
  bloomKnee: number;
  bloomRadius: number; // 0..1 mix of the wider levels
  vignette: number;
  vignetteShape: number; // >1 squeezes vertically
  grain: number; // amplitude, e.g. 0.015
  grainDarkFade: number; // fade grain to zero below this luminance (0 = off)
  exposure: number;
  dofSharpen: number; // how fast to blend to the blurred image (in px)
};

export const defaultPost = (): PostParams => ({
  background: new THREE.Color(0, 0, 0),
  backgroundCoc: 1,
  cocMaxFrac: 0.03,
  bloomStrength: 0.8,
  bloomThreshold: 0.45,
  bloomKnee: 0.35,
  bloomRadius: 0.6,
  vignette: 0.45,
  vignetteShape: 1,
  grain: 0.015,
  grainDarkFade: 0,
  exposure: 1,
  dofSharpen: 1,
});

const VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const PREFILTER = /* glsl */ `
precision highp float;
uniform sampler2D tSrc;
uniform vec2 uTexel; // source texel
in vec2 vUv;
out vec4 outColor;
void main() {
  // 4 bilinear taps = 16 texel box; coc keeps the value of largest magnitude
  vec4 a = texture(tSrc, vUv + uTexel * vec2(-0.5, -0.5));
  vec4 b = texture(tSrc, vUv + uTexel * vec2( 0.5, -0.5));
  vec4 c = texture(tSrc, vUv + uTexel * vec2(-0.5,  0.5));
  vec4 d = texture(tSrc, vUv + uTexel * vec2( 0.5,  0.5));
  vec3 col = (a.rgb + b.rgb + c.rgb + d.rgb) * 0.25;
  float coc = a.a;
  if (abs(b.a) > abs(coc)) coc = b.a;
  if (abs(c.a) > abs(coc)) coc = c.a;
  if (abs(d.a) > abs(coc)) coc = d.a;
  outColor = vec4(col, coc);
}`;

// Single-pass gather after Gustafsson's "bokeh depth of field in a single
// pass": walk a golden-angle spiral; each sample contributes when its own
// circle of confusion reaches the centre pixel. Samples in front (smaller
// signed coc) may bleed over sharper ones; samples behind are clamped.
const GATHER = /* glsl */ `
precision highp float;
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uMaxR;   // max radius in (half-res) pixels
uniform float uStep;   // spiral step scale
in vec2 vUv;
out vec4 outColor;
const float GOLDEN = 2.39996323;
void main() {
  vec4 center = texture(tSrc, vUv);
  float cSigned = center.a;
  float cSize = abs(cSigned) * uMaxR;
  vec3 col = center.rgb;
  float tot = 1.0;
  float radius = uStep;
  float ang = 0.0;
  for (int i = 0; i < 160; i++) {
    if (radius >= uMaxR) break;
    vec2 off = vec2(cos(ang), sin(ang)) * radius;
    vec4 s = texture(tSrc, vUv + off * uTexel);
    float sSize = abs(s.a) * uMaxR;
    if (s.a > cSigned) sSize = clamp(sSize, 0.0, cSize * 2.0);
    float m = smoothstep(radius - 0.5 * uStep, radius + 0.5 * uStep, sSize);
    col += mix(col / tot, s.rgb, m);
    tot += 1.0;
    radius += uStep * uStep / radius;
    ang += GOLDEN;
  }
  outColor = vec4(col / tot, cSigned);
}`;

const COMBINE = /* glsl */ `
precision highp float;
uniform sampler2D tSharp;
uniform sampler2D tBlur;
uniform vec2 uBlurTexel;
uniform float uMaxRFull;
uniform float uSharpen;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec4 sharp = texture(tSharp, vUv);
  // 9-tap tent on the half-res blur smooths the sparse spiral
  vec3 b = texture(tBlur, vUv).rgb * 4.0;
  b += texture(tBlur, vUv + uBlurTexel * vec2( 1.0, 0.0)).rgb * 2.0;
  b += texture(tBlur, vUv + uBlurTexel * vec2(-1.0, 0.0)).rgb * 2.0;
  b += texture(tBlur, vUv + uBlurTexel * vec2(0.0,  1.0)).rgb * 2.0;
  b += texture(tBlur, vUv + uBlurTexel * vec2(0.0, -1.0)).rgb * 2.0;
  b += texture(tBlur, vUv + uBlurTexel * vec2( 1.0,  1.0)).rgb;
  b += texture(tBlur, vUv + uBlurTexel * vec2(-1.0,  1.0)).rgb;
  b += texture(tBlur, vUv + uBlurTexel * vec2( 1.0, -1.0)).rgb;
  b += texture(tBlur, vUv + uBlurTexel * vec2(-1.0, -1.0)).rgb;
  b /= 16.0;
  float blurA = texture(tBlur, vUv).a;
  float px = max(abs(sharp.a), abs(blurA)) * uMaxRFull;
  float k = smoothstep(0.35 * uSharpen, 1.6 * uSharpen, px);
  outColor = vec4(mix(sharp.rgb, b, k), 1.0);
}`;

const BLOOM_PRE = /* glsl */ `
precision highp float;
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uThreshold;
uniform float uKnee;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec3 c = texture(tSrc, vUv + uTexel * vec2(-0.5,-0.5)).rgb;
  c += texture(tSrc, vUv + uTexel * vec2( 0.5,-0.5)).rgb;
  c += texture(tSrc, vUv + uTexel * vec2(-0.5, 0.5)).rgb;
  c += texture(tSrc, vUv + uTexel * vec2( 0.5, 0.5)).rgb;
  c *= 0.25;
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-5);
  float contrib = max(soft, br - uThreshold) / max(br, 1e-5);
  outColor = vec4(c * contrib, 1.0);
}`;

const DOWN = /* glsl */ `
precision highp float;
uniform sampler2D tSrc;
uniform vec2 uTexel;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec3 s = texture(tSrc, vUv).rgb * 4.0;
  s += texture(tSrc, vUv + uTexel * vec2(-1.0,-1.0)).rgb;
  s += texture(tSrc, vUv + uTexel * vec2( 1.0,-1.0)).rgb;
  s += texture(tSrc, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
  s += texture(tSrc, vUv + uTexel * vec2( 1.0, 1.0)).rgb;
  outColor = vec4(s / 8.0, 1.0);
}`;

const UP = /* glsl */ `
precision highp float;
uniform sampler2D tSrc;   // smaller level
uniform sampler2D tBase;  // same-size level to add
uniform vec2 uTexel;      // texel of tSrc
uniform float uMix;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec3 s = texture(tSrc, vUv + uTexel * vec2(-1.0, 0.0)).rgb;
  s += texture(tSrc, vUv + uTexel * vec2( 1.0, 0.0)).rgb;
  s += texture(tSrc, vUv + uTexel * vec2( 0.0, -1.0)).rgb;
  s += texture(tSrc, vUv + uTexel * vec2( 0.0, 1.0)).rgb;
  s += (texture(tSrc, vUv + uTexel * vec2(-0.5,-0.5)).rgb +
        texture(tSrc, vUv + uTexel * vec2( 0.5,-0.5)).rgb +
        texture(tSrc, vUv + uTexel * vec2(-0.5, 0.5)).rgb +
        texture(tSrc, vUv + uTexel * vec2( 0.5, 0.5)).rgb) * 2.0;
  s /= 12.0;
  outColor = vec4(texture(tBase, vUv).rgb + s * uMix, 1.0);
}`;

const FINAL = /* glsl */ `
precision highp float;
uniform sampler2D tColor;
uniform sampler2D tBloom;
uniform float uBloom;
uniform float uVignette;
uniform float uVigShape;
uniform float uAspect;
uniform float uGrain;
uniform float uGrainDark;
uniform float uExposure;
uniform uint uFrame;   // frame % 600
uniform vec2 uRes;
in vec2 vUv;
out vec4 outColor;

uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}

void main() {
  vec3 c = texture(tColor, vUv).rgb + texture(tBloom, vUv).rgb * uBloom;
  c *= uExposure;
  // gentle shoulder instead of a hard clip
  vec3 over = max(c - 0.8, 0.0);
  c = min(c, 0.8) + over / (1.0 + over * 2.5);
  vec2 q = (vUv - 0.5) * vec2(uAspect, uVigShape);
  float v = smoothstep(1.15, 0.25, length(q));
  c *= mix(1.0, v, uVignette);

  uvec2 p = uvec2(gl_FragCoord.xy);
  uvec3 h = pcg3d(uvec3(p, uFrame));
  vec3 r = vec3(h) / 4294967295.0;
  // grain: fixed formula of pixel position and frame, monochrome
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float gmask = uGrainDark > 0.0 ? smoothstep(0.0, uGrainDark, lum) : 1.0;
  c += (r.x - 0.5) * 2.0 * uGrain * gmask;
  // triangular dither, +-1/255
  c += (r.y + r.z - 1.0) / 255.0;
  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

const makeRT = (w: number, h: number, samples = 0) =>
  new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: samples > 0,
    samples,
    generateMipmaps: false,
    colorSpace: THREE.NoColorSpace,
  });

const pass = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VERT,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });

export class Pipeline {
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: THREE.Mesh;
  private W = 0;
  private H = 0;
  private sceneRT!: THREE.WebGLRenderTarget;
  private halfA!: THREE.WebGLRenderTarget;
  private halfB!: THREE.WebGLRenderTarget;
  private dofRT!: THREE.WebGLRenderTarget;
  private bloomDown: THREE.WebGLRenderTarget[] = [];
  private bloomUp: THREE.WebGLRenderTarget[] = [];
  private mPre = pass(PREFILTER, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
  private mGather = pass(GATHER, {
    tSrc: { value: null },
    uTexel: { value: new THREE.Vector2() },
    uMaxR: { value: 10 },
    uStep: { value: 1 },
  });
  private mCombine = pass(COMBINE, {
    tSharp: { value: null },
    tBlur: { value: null },
    uBlurTexel: { value: new THREE.Vector2() },
    uMaxRFull: { value: 10 },
    uSharpen: { value: 1 },
  });
  private mBloomPre = pass(BLOOM_PRE, {
    tSrc: { value: null },
    uTexel: { value: new THREE.Vector2() },
    uThreshold: { value: 0.5 },
    uKnee: { value: 0.3 },
  });
  private mDown = pass(DOWN, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
  private mUp = pass(UP, {
    tSrc: { value: null },
    tBase: { value: null },
    uTexel: { value: new THREE.Vector2() },
    uMix: { value: 1 },
  });
  private mFinal = pass(FINAL, {
    tColor: { value: null },
    tBloom: { value: null },
    uBloom: { value: 1 },
    uVignette: { value: 0.4 },
    uVigShape: { value: 1 },
    uAspect: { value: 16 / 9 },
    uGrain: { value: 0.015 },
    uGrainDark: { value: 0 },
    uExposure: { value: 1 },
    uFrame: { value: 0 },
    uRes: { value: new THREE.Vector2() },
  });

  constructor(private renderer: THREE.WebGLRenderer) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
    );
    this.quad = new THREE.Mesh(geo, this.mFinal);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  setSize(W: number, H: number) {
    if (W === this.W && H === this.H) return;
    this.dispose();
    this.W = W;
    this.H = H;
    const hw = Math.max(1, Math.round(W / 2));
    const hh = Math.max(1, Math.round(H / 2));
    this.sceneRT = makeRT(W, H, 4);
    this.halfA = makeRT(hw, hh);
    this.halfB = makeRT(hw, hh);
    this.dofRT = makeRT(W, H);
    this.bloomDown = [];
    this.bloomUp = [];
    let w = hw;
    let h = hh;
    for (let i = 0; i < 6; i++) {
      this.bloomDown.push(makeRT(w, h));
      this.bloomUp.push(makeRT(w, h));
      w = Math.max(1, Math.round(w / 2));
      h = Math.max(1, Math.round(h / 2));
    }
  }

  private run(m: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = m;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCam);
  }

  render(scene: THREE.Scene, camera: THREE.Camera, post: PostParams, frame: number) {
    const r = this.renderer;
    const { W, H } = this;
    r.autoClear = false;
    // 1. scene
    r.setRenderTarget(this.sceneRT);
    r.setClearColor(post.background, post.backgroundCoc);
    r.clear(true, true, true);
    r.render(scene, camera);

    // 2. DoF
    const hw = this.halfA.width;
    const hh = this.halfA.height;
    this.mPre.uniforms.tSrc.value = this.sceneRT.texture;
    this.mPre.uniforms.uTexel.value.set(1 / W, 1 / H);
    this.run(this.mPre, this.halfA);
    const maxRHalf = Math.max(1, post.cocMaxFrac * hh);
    this.mGather.uniforms.tSrc.value = this.halfA.texture;
    this.mGather.uniforms.uTexel.value.set(1 / hw, 1 / hh);
    this.mGather.uniforms.uMaxR.value = maxRHalf;
    // ~80 spiral samples regardless of resolution
    this.mGather.uniforms.uStep.value = Math.max(0.75, maxRHalf / 12.5);
    this.run(this.mGather, this.halfB);
    this.mCombine.uniforms.tSharp.value = this.sceneRT.texture;
    this.mCombine.uniforms.tBlur.value = this.halfB.texture;
    this.mCombine.uniforms.uBlurTexel.value.set(1 / hw, 1 / hh);
    this.mCombine.uniforms.uMaxRFull.value = maxRHalf * 2;
    this.mCombine.uniforms.uSharpen.value = post.dofSharpen * (H / 720);
    this.run(this.mCombine, this.dofRT);

    // 3. bloom
    this.mBloomPre.uniforms.tSrc.value = this.dofRT.texture;
    this.mBloomPre.uniforms.uTexel.value.set(1 / W, 1 / H);
    this.mBloomPre.uniforms.uThreshold.value = post.bloomThreshold;
    this.mBloomPre.uniforms.uKnee.value = post.bloomKnee;
    this.run(this.mBloomPre, this.bloomDown[0]);
    for (let i = 1; i < this.bloomDown.length; i++) {
      const src = this.bloomDown[i - 1];
      this.mDown.uniforms.tSrc.value = src.texture;
      this.mDown.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      this.run(this.mDown, this.bloomDown[i]);
    }
    const n = this.bloomDown.length;
    let cur = this.bloomDown[n - 1];
    for (let i = n - 2; i >= 0; i--) {
      this.mUp.uniforms.tSrc.value = cur.texture;
      this.mUp.uniforms.tBase.value = this.bloomDown[i].texture;
      this.mUp.uniforms.uTexel.value.set(1 / cur.width, 1 / cur.height);
      // wider levels weigh by bloomRadius
      this.mUp.uniforms.uMix.value = post.bloomRadius;
      this.run(this.mUp, this.bloomUp[i]);
      cur = this.bloomUp[i];
    }

    // 4. final
    const f = this.mFinal.uniforms;
    f.tColor.value = this.dofRT.texture;
    f.tBloom.value = cur.texture;
    f.uBloom.value = post.bloomStrength;
    f.uVignette.value = post.vignette;
    f.uVigShape.value = post.vignetteShape;
    f.uAspect.value = W / H;
    f.uGrain.value = post.grain;
    f.uGrainDark.value = post.grainDarkFade;
    f.uExposure.value = post.exposure;
    f.uFrame.value = ((frame % LOOP) + LOOP) % LOOP;
    f.uRes.value.set(W, H);
    this.run(this.mFinal, null);
  }

  dispose() {
    [this.sceneRT, this.halfA, this.halfB, this.dofRT, ...this.bloomDown, ...this.bloomUp].forEach(
      (t) => t?.dispose(),
    );
  }
}
