import * as THREE from "three";
import { LOOP_FRAMES } from "./constants";

/**
 * Small, fully deterministic post pipeline shared by all looks:
 *
 *   scene (HDR, MSAA) -> [depth of field] -> bloom (mip chain) ->
 *   exposure / vignette -> ACES -> sRGB -> grain + ±1/255 dither -> canvas
 *
 * Nothing temporal: no history buffers, no accumulation, no clocks. The only
 * per-frame input is the Remotion frame number (for the grain pattern).
 *
 * DoF and bloom run at a fixed working height (540 px) regardless of output
 * size, so blur radii are the same fraction of the frame at 720p and at 4K.
 */

export type PostConfig = {
  exposure: number;
  bloom: {
    strength: number;
    threshold: number;
    knee: number;
    /** 0..1, how much the wide mip levels contribute (glow spread). */
    spread: number;
  };
  dof?: {
    /** Focus distance in world units (camera space). */
    focus: number;
    /** CoC (in 540p pixels) of an object at infinity. */
    farBlur: number;
    /** CoC multiplier for objects nearer than focus. */
    nearBlur: number;
    /** Clamp, 540p pixels. */
    maxCoc: number;
  };
  vignette: number;
  /** Grain amplitude in display units (0.02 = 2 %). */
  grain: number;
  msaa: number;
  /** Optional colour lift added before tonemapping (linear). */
  lift?: THREE.Color;
};

const WORK_H = 540;

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const HASH = /* glsl */ `
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
vec3 hash3(uvec3 v) { return vec3(pcg3d(v)) * (1.0 / 4294967295.0); }
`;

const makeMat = (
  frag: string,
  uniforms: Record<string, THREE.IUniform>,
  defines: Record<string, string | number> = {},
) =>
  new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: frag,
    uniforms,
    defines,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
  });

const rt = (w: number, h: number, extra: THREE.RenderTargetOptions = {}) =>
  new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    generateMipmaps: false,
    ...extra,
  });

// ---------------------------------------------------------------- shaders --

const DOF_PREP = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 srcTexel;
uniform float near, far, focus, farBlur, nearBlur, maxCoc;
varying vec2 vUv;
float viewDist(float d) {
  float z = (near * far) / ((far - near) * d - far);
  return -z;
}
void main() {
  vec2 o = srcTexel;
  vec3 c = texture2D(tColor, vUv + vec2(-o.x, -o.y)).rgb
         + texture2D(tColor, vUv + vec2( o.x, -o.y)).rgb
         + texture2D(tColor, vUv + vec2(-o.x,  o.y)).rgb
         + texture2D(tColor, vUv + vec2( o.x,  o.y)).rgb;
  c *= 0.25;
  if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0);
  c = max(c, vec3(0.0));
  // nearest depth of the 4 taps keeps foreground silhouettes intact
  float d = min(min(texture2D(tDepth, vUv + vec2(-o.x, -o.y)).r, texture2D(tDepth, vUv + vec2(o.x, -o.y)).r),
                min(texture2D(tDepth, vUv + vec2(-o.x, o.y)).r, texture2D(tDepth, vUv + vec2(o.x, o.y)).r));
  float z = viewDist(d);
  float s = 1.0 - focus / max(z, 1e-3); // <0 near, >0 far
  float coc = s < 0.0 ? max(s * nearBlur * farBlur, -maxCoc) : min(s * farBlur, maxCoc);
  gl_FragColor = vec4(min(c, vec3(64.0)), coc);
}`;

const DOF_TILE = /* glsl */ `
uniform sampler2D tPrep;
uniform vec2 prepSize;
varying vec2 vUv;
void main() {
  ivec2 base = ivec2(floor(gl_FragCoord.xy)) * 8;
  float m = 0.0;
  for (int y = 0; y < 8; y++) for (int x = 0; x < 8; x++) {
    ivec2 p = min(base + ivec2(x, y), ivec2(prepSize) - 1);
    m = max(m, abs(texelFetch(tPrep, p, 0).a));
  }
  gl_FragColor = vec4(m, 0.0, 0.0, 1.0);
}`;

const DOF_DILATE = /* glsl */ `
uniform sampler2D tTile;
uniform vec2 tileSize;
varying vec2 vUv;
void main() {
  ivec2 c = ivec2(floor(gl_FragCoord.xy));
  float m = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    ivec2 p = clamp(c + ivec2(x, y), ivec2(0), ivec2(tileSize) - 1);
    m = max(m, texelFetch(tTile, p, 0).r);
  }
  gl_FragColor = vec4(m, 0.0, 0.0, 1.0);
}`;

const DOF_GATHER = /* glsl */ `
uniform sampler2D tPrep;
uniform sampler2D tTile;
uniform vec2 texel;
varying vec2 vUv;
#define TAPS 64
void main() {
  vec4 c = texture2D(tPrep, vUv);
  float R = texture2D(tTile, vUv).r;
  float cc = abs(c.a);
  if (R < 0.75) { gl_FragColor = vec4(c.rgb, cc); return; }
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  float nearAcc = 0.0;
  for (int i = 0; i < TAPS; i++) {
    float fi = float(i) + 0.5;
    float r = R * sqrt(fi / float(TAPS));
    float a = fi * 2.39996323;
    vec2 off = vec2(cos(a), sin(a)) * r;
    vec4 s = texture2D(tPrep, vUv + off * texel);
    float cs = abs(s.a);
    // a sample behind the centre may not blur over it more than the centre itself is blurred
    float eff = s.a > c.a ? min(cs, max(cc, 0.0)) : cs;
    float cover = clamp(eff - r + 1.0, 0.0, 1.0);
    float w = cover / max(eff * eff, 1.0);
    acc += s.rgb * w;
    wsum += w;
    nearAcc += w * (s.a < c.a ? cs : cc);
  }
  // the centre always counts
  float wc = 1.0 / max(cc * cc, 1.0);
  acc += c.rgb * wc;
  wsum += wc;
  nearAcc += wc * cc;
  gl_FragColor = vec4(acc / wsum, nearAcc / wsum);
}`;

const DOF_COMPOSE = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tBlur;
uniform vec2 blurTexel;
uniform float near, far, focus, farBlur, nearBlur, maxCoc;
varying vec2 vUv;
float viewDist(float d) { return -((near * far) / ((far - near) * d - far)); }
void main() {
  vec3 sharp = texture2D(tColor, vUv).rgb;
  if (any(isnan(sharp)) || any(isinf(sharp))) sharp = vec3(0.0);
  sharp = max(sharp, vec3(0.0));
  // 4-tap tent on the low-res blur to hide its texel grid
  vec2 o = blurTexel * 0.5;
  vec4 b = 0.25 * (texture2D(tBlur, vUv + vec2(-o.x, -o.y)) + texture2D(tBlur, vUv + vec2(o.x, -o.y))
                 + texture2D(tBlur, vUv + vec2(-o.x, o.y)) + texture2D(tBlur, vUv + vec2(o.x, o.y)));
  float z = viewDist(texture2D(tDepth, vUv).r);
  float s = 1.0 - focus / max(z, 1e-3);
  float coc = s < 0.0 ? min(-s * nearBlur * farBlur, maxCoc) : min(s * farBlur, maxCoc);
  float t = max(smoothstep(0.2, 1.2, coc), smoothstep(0.35, 1.5, b.a));
  gl_FragColor = vec4(mix(sharp, b.rgb, t), 1.0);
}`;

const BLOOM_PREFILTER = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 srcTexel;
uniform float threshold, knee;
varying vec2 vUv;
vec3 pre(vec3 c) {
  if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0);
  c = clamp(c, vec3(0.0), vec3(48.0));
  float br = max(c.r, max(c.g, c.b));
  float rq = clamp(br - threshold + knee, 0.0, 2.0 * knee);
  rq = rq * rq / (4.0 * knee + 1e-5);
  float w = max(rq, br - threshold) / max(br, 1e-5);
  return c * w;
}
void main() {
  // the source can be up to 4x larger than this target; average a 4x4 block
  vec3 acc = vec3(0.0);
  for (int y = 0; y < 2; y++) for (int x = 0; x < 2; x++) {
    vec2 o = (vec2(float(x), float(y)) - 0.5) * 2.0 * srcTexel;
    acc += pre(texture2D(tSrc, vUv + o).rgb);
  }
  gl_FragColor = vec4(acc * 0.25, 1.0);
}`;

const BLOOM_DOWN = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 srcTexel;
varying vec2 vUv;
void main() {
  vec2 t = srcTexel;
  vec3 a = texture2D(tSrc, vUv + t * vec2(-2.0, 2.0)).rgb;
  vec3 b = texture2D(tSrc, vUv + t * vec2(0.0, 2.0)).rgb;
  vec3 c = texture2D(tSrc, vUv + t * vec2(2.0, 2.0)).rgb;
  vec3 d = texture2D(tSrc, vUv + t * vec2(-2.0, 0.0)).rgb;
  vec3 e = texture2D(tSrc, vUv).rgb;
  vec3 f = texture2D(tSrc, vUv + t * vec2(2.0, 0.0)).rgb;
  vec3 g = texture2D(tSrc, vUv + t * vec2(-2.0, -2.0)).rgb;
  vec3 h = texture2D(tSrc, vUv + t * vec2(0.0, -2.0)).rgb;
  vec3 i = texture2D(tSrc, vUv + t * vec2(2.0, -2.0)).rgb;
  vec3 j = texture2D(tSrc, vUv + t * vec2(-1.0, 1.0)).rgb;
  vec3 k = texture2D(tSrc, vUv + t * vec2(1.0, 1.0)).rgb;
  vec3 l = texture2D(tSrc, vUv + t * vec2(-1.0, -1.0)).rgb;
  vec3 m = texture2D(tSrc, vUv + t * vec2(1.0, -1.0)).rgb;
  vec3 o = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  gl_FragColor = vec4(o, 1.0);
}`;

const BLOOM_UP = /* glsl */ `
uniform sampler2D tLow;
uniform sampler2D tHigh;
uniform vec2 lowTexel;
uniform float spread;
varying vec2 vUv;
void main() {
  vec2 t = lowTexel;
  vec3 s = texture2D(tLow, vUv).rgb * 4.0
    + (texture2D(tLow, vUv + vec2(t.x, 0.0)).rgb + texture2D(tLow, vUv - vec2(t.x, 0.0)).rgb
     + texture2D(tLow, vUv + vec2(0.0, t.y)).rgb + texture2D(tLow, vUv - vec2(0.0, t.y)).rgb) * 2.0
    + texture2D(tLow, vUv + t).rgb + texture2D(tLow, vUv - t).rgb
    + texture2D(tLow, vUv + vec2(t.x, -t.y)).rgb + texture2D(tLow, vUv + vec2(-t.x, t.y)).rgb;
  gl_FragColor = vec4(texture2D(tHigh, vUv).rgb + s * (spread / 16.0), 1.0);
}`;

const FINAL = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tBloom;
uniform vec2 bloomTexel;
uniform float exposure, bloomStrength, vignette, grain;
uniform vec3 lift;
uniform uint frame;
varying vec2 vUv;
${HASH}
vec3 RRTAndODTFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 aces(vec3 color) {
  const mat3 ACESInputMat = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 ACESOutputMat = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  color *= 1.0 / 0.6;
  color = ACESInputMat * color;
  color = RRTAndODTFit(color);
  color = ACESOutputMat * color;
  return clamp(color, 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  vec3 c = texture2D(tColor, vUv).rgb;
  if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0);
  c = max(c, vec3(0.0));
  // bicubic-ish (4-tap tent) read of the bloom so its low-res grid never shows
  vec2 o = bloomTexel * 0.5;
  vec3 b = 0.25 * (texture2D(tBloom, vUv + vec2(-o.x, -o.y)).rgb + texture2D(tBloom, vUv + vec2(o.x, -o.y)).rgb
                 + texture2D(tBloom, vUv + vec2(-o.x, o.y)).rgb + texture2D(tBloom, vUv + vec2(o.x, o.y)).rgb);
  c += b * bloomStrength;
  c += lift;
  vec2 q = vUv - 0.5;
  q.x *= 1.25;
  float v = 1.0 - dot(q, q) * 1.6;
  c *= mix(1.0, clamp(v, 0.0, 1.0), vignette);
  c = aces(c * exposure);
  c = toSRGB(c);
  // grain + dither: a fixed function of pixel position and loop frame only
  vec3 h = hash3(uvec3(uvec2(gl_FragCoord.xy), frame));
  vec3 h2 = hash3(uvec3(uvec2(gl_FragCoord.xy) + uvec2(7919u, 104729u), frame + 7777u));
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float g = (h.x + h.y - 1.0) * grain * (0.55 + 0.45 * smoothstep(0.0, 0.35, lum));
  c += g;
  c += (h2 - 0.5 + (h2.zxy - 0.5)) * (1.0 / 255.0);
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

// ------------------------------------------------------------------ class --

export class Post {
  private gl: THREE.WebGLRenderer;
  cfg: PostConfig;
  private w = 0;
  private h = 0;
  private sceneRT!: THREE.WebGLRenderTarget;
  private compRT!: THREE.WebGLRenderTarget;
  private prepRT!: THREE.WebGLRenderTarget;
  private tileRT!: THREE.WebGLRenderTarget;
  private tileDilRT!: THREE.WebGLRenderTarget;
  private gatherRT!: THREE.WebGLRenderTarget;
  private bloomDown: THREE.WebGLRenderTarget[] = [];
  private bloomUp: THREE.WebGLRenderTarget[] = [];

  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: THREE.Mesh;

  private mPrep = makeMat(DOF_PREP, {
    tColor: { value: null },
    tDepth: { value: null },
    srcTexel: { value: new THREE.Vector2() },
    near: { value: 0.1 },
    far: { value: 100 },
    focus: { value: 10 },
    farBlur: { value: 4 },
    nearBlur: { value: 1 },
    maxCoc: { value: 24 },
  });
  private mTile = makeMat(DOF_TILE, {
    tPrep: { value: null },
    prepSize: { value: new THREE.Vector2() },
  });
  private mDilate = makeMat(DOF_DILATE, {
    tTile: { value: null },
    tileSize: { value: new THREE.Vector2() },
  });
  private mGather = makeMat(DOF_GATHER, {
    tPrep: { value: null },
    tTile: { value: null },
    texel: { value: new THREE.Vector2() },
  });
  private mDofCompose = makeMat(DOF_COMPOSE, {
    tColor: { value: null },
    tDepth: { value: null },
    tBlur: { value: null },
    blurTexel: { value: new THREE.Vector2() },
    near: { value: 0.1 },
    far: { value: 100 },
    focus: { value: 10 },
    farBlur: { value: 4 },
    nearBlur: { value: 1 },
    maxCoc: { value: 24 },
  });
  private mPre = makeMat(BLOOM_PREFILTER, {
    tSrc: { value: null },
    srcTexel: { value: new THREE.Vector2() },
    threshold: { value: 1 },
    knee: { value: 0.5 },
  });
  private mDown = makeMat(BLOOM_DOWN, {
    tSrc: { value: null },
    srcTexel: { value: new THREE.Vector2() },
  });
  private mUp = makeMat(BLOOM_UP, {
    tLow: { value: null },
    tHigh: { value: null },
    lowTexel: { value: new THREE.Vector2() },
    spread: { value: 1 },
  });
  private mFinal = makeMat(FINAL, {
    tColor: { value: null },
    tBloom: { value: null },
    bloomTexel: { value: new THREE.Vector2() },
    exposure: { value: 1 },
    bloomStrength: { value: 0.1 },
    vignette: { value: 0 },
    grain: { value: 0.02 },
    lift: { value: new THREE.Color(0, 0, 0) },
    frame: { value: 0 },
  });

  constructor(gl: THREE.WebGLRenderer, cfg: PostConfig) {
    this.gl = gl;
    this.cfg = cfg;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
    );
    this.quad = new THREE.Mesh(geo, this.mFinal);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  private alloc(w: number, h: number) {
    this.dispose();
    this.w = w;
    this.h = h;
    const dof = !!this.cfg.dof;
    this.sceneRT = rt(w, h, {
      samples: this.cfg.msaa,
      depthBuffer: true,
      ...(dof ? { depthTexture: new THREE.DepthTexture(w, h, THREE.UnsignedIntType) } : {}),
    });
    const wh = Math.min(WORK_H, h);
    const ww = Math.round((w / h) * wh);
    if (dof) {
      this.compRT = rt(w, h);
      this.prepRT = rt(ww, wh);
      this.gatherRT = rt(ww, wh);
      const tw = Math.ceil(ww / 8);
      const th = Math.ceil(wh / 8);
      this.tileRT = rt(tw, th, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
      this.tileDilRT = rt(tw, th, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    }
    let bw = ww;
    let bh = wh;
    for (let i = 0; i < 7; i++) {
      this.bloomDown.push(rt(bw, bh));
      this.bloomUp.push(rt(bw, bh));
      bw = Math.max(1, Math.round(bw / 2));
      bh = Math.max(1, Math.round(bh / 2));
    }
  }

  dispose() {
    const all = [
      this.sceneRT,
      this.compRT,
      this.prepRT,
      this.tileRT,
      this.tileDilRT,
      this.gatherRT,
      ...this.bloomDown,
      ...this.bloomUp,
    ];
    for (const t of all) {
      if (t) {
        t.depthTexture?.dispose();
        t.dispose();
      }
    }
    this.bloomDown = [];
    this.bloomUp = [];
  }

  private pass(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    this.gl.setRenderTarget(target);
    this.gl.render(this.quadScene, this.quadCam);
  }

  render(scene: THREE.Scene, camera: THREE.Camera, frame: number) {
    const gl = this.gl;
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    const w = Math.round(size.x);
    const h = Math.round(size.y);
    if (w !== this.w || h !== this.h) this.alloc(w, h);
    const cfg = this.cfg;

    gl.autoClear = true;
    gl.setRenderTarget(this.sceneRT);
    gl.clear(true, true, true);
    gl.render(scene, camera);

    let color: THREE.Texture = this.sceneRT.texture;

    if (cfg.dof) {
      const cam = camera as THREE.PerspectiveCamera;
      const d = cfg.dof;
      for (const m of [this.mPrep, this.mDofCompose]) {
        m.uniforms.near.value = cam.near;
        m.uniforms.far.value = cam.far;
        m.uniforms.focus.value = d.focus;
        m.uniforms.farBlur.value = d.farBlur;
        m.uniforms.nearBlur.value = d.nearBlur;
        m.uniforms.maxCoc.value = d.maxCoc;
      }
      const pw = this.prepRT.width;
      const ph = this.prepRT.height;
      this.mPrep.uniforms.tColor.value = this.sceneRT.texture;
      this.mPrep.uniforms.tDepth.value = this.sceneRT.depthTexture;
      this.mPrep.uniforms.srcTexel.value.set(0.25 / pw, 0.25 / ph);
      this.pass(this.mPrep, this.prepRT);

      this.mTile.uniforms.tPrep.value = this.prepRT.texture;
      this.mTile.uniforms.prepSize.value.set(pw, ph);
      this.pass(this.mTile, this.tileRT);
      this.mDilate.uniforms.tTile.value = this.tileRT.texture;
      this.mDilate.uniforms.tileSize.value.set(this.tileRT.width, this.tileRT.height);
      this.pass(this.mDilate, this.tileDilRT);

      this.mGather.uniforms.tPrep.value = this.prepRT.texture;
      this.mGather.uniforms.tTile.value = this.tileDilRT.texture;
      this.mGather.uniforms.texel.value.set(1 / pw, 1 / ph);
      this.pass(this.mGather, this.gatherRT);

      this.mDofCompose.uniforms.tColor.value = this.sceneRT.texture;
      this.mDofCompose.uniforms.tDepth.value = this.sceneRT.depthTexture;
      this.mDofCompose.uniforms.tBlur.value = this.gatherRT.texture;
      this.mDofCompose.uniforms.blurTexel.value.set(1 / pw, 1 / ph);
      this.pass(this.mDofCompose, this.compRT);
      color = this.compRT.texture;
    }

    // bloom
    const b0 = this.bloomDown[0];
    this.mPre.uniforms.tSrc.value = color;
    this.mPre.uniforms.srcTexel.value.set(1 / w, 1 / h).multiplyScalar(Math.max(1, (h / b0.height) * 0.5));
    this.mPre.uniforms.threshold.value = cfg.bloom.threshold;
    this.mPre.uniforms.knee.value = cfg.bloom.knee;
    this.pass(this.mPre, b0);
    for (let i = 1; i < this.bloomDown.length; i++) {
      const src = this.bloomDown[i - 1];
      this.mDown.uniforms.tSrc.value = src.texture;
      this.mDown.uniforms.srcTexel.value.set(1 / src.width, 1 / src.height);
      this.pass(this.mDown, this.bloomDown[i]);
    }
    const n = this.bloomDown.length;
    let low = this.bloomDown[n - 1];
    for (let i = n - 2; i >= 0; i--) {
      this.mUp.uniforms.tLow.value = low.texture;
      this.mUp.uniforms.tHigh.value = this.bloomDown[i].texture;
      this.mUp.uniforms.lowTexel.value.set(1 / low.width, 1 / low.height);
      this.mUp.uniforms.spread.value = cfg.bloom.spread;
      this.pass(this.mUp, this.bloomUp[i]);
      low = this.bloomUp[i];
    }

    const f = this.mFinal.uniforms;
    f.tColor.value = color;
    f.tBloom.value = this.bloomUp[0].texture;
    f.bloomTexel.value.set(1 / this.bloomUp[0].width, 1 / this.bloomUp[0].height);
    f.exposure.value = cfg.exposure;
    f.bloomStrength.value = cfg.bloom.strength;
    f.vignette.value = cfg.vignette;
    f.grain.value = cfg.grain;
    f.lift.value = cfg.lift ?? new THREE.Color(0, 0, 0);
    f.frame.value = ((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;
    this.pass(this.mFinal, null);
  }
}
