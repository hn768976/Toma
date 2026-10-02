import * as THREE from 'three';

/**
 * Deterministic post-processing chain, written directly against three.js so
 * that every pass is a pure function of (scene, camera, frame):
 *
 *   scene (HDR, MSAA x4, depth texture)
 *     -> CoC + half-res downsample (mipmapped)
 *     -> near-CoC tile max (1/16) + 3x3 dilate
 *     -> DOF gather (half res, 64 golden-angle taps, 2 layers)
 *     -> bloom: soft-threshold prefilter, 6-level 13-tap down / tent up chain
 *     -> composite: DOF blend + bloom + vignette -> exposure -> ACES (Hill fit)
 *        -> sRGB -> grain (hash of pixel + frame) -> TPDF dither +/-1/255
 *
 * No temporal accumulation of any kind: nothing is carried between frames.
 * All radii are expressed as a fraction of the output height so 720p, 4K and
 * 6K renders look the same.
 */

export type DofParams = {
  enabled: boolean;
  /** world-space distance that is in perfect focus */
  focusDistance: number;
  /** CoC at infinity, as a fraction of image height */
  farBlur: number;
  /** maximum near CoC, as a fraction of image height */
  nearBlur: number;
  /** multiplier on the near CoC slope (1 = physically paired with farBlur) */
  nearScale?: number;
  /** half-width of the perfectly sharp zone, fraction of focusDistance */
  sharpZone?: number;
};

export type PostParams = {
  exposure: number;
  bloomStrength: number;
  /** 0..1 how much of each coarser level is added back (bloom spread) */
  bloomRadius: number;
  bloomThreshold: number;
  bloomKnee?: number;
  dof: DofParams;
  /** grain amplitude in sRGB (0.02 = 2%). 0 disables. */
  grain: number;
  vignette: number;
  /** final saturation tweak in linear space before tonemap */
  saturation?: number;
  /** linear-space colour multiplied in before tonemapping */
  tint?: [number, number, number];
  /** subtracted in linear space before tonemapping so faint bloom tails stay exactly black */
  blackFloor?: number;
  /** loop length in frames: the grain/dither hash uses frame % loopFrames so frame N == frame 0 */
  loopFrames?: number;
};

const FULLSCREEN_VERT = /* glsl */ `
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const COMMON = /* glsl */ `
precision highp float;
precision highp int;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
`;

const makeMat = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: COMMON + frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });

// --- CoC + half-res downsample --------------------------------------------
const COC_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uSrcTexel;
uniform float uNear, uFar, uFocus, uFarBlur, uNearBlur, uNearScale, uSharp, uHalfH;
uniform bool uDofOn;
float viewZ(float d) { return (uNear * uFar) / ((uFar - uNear) * d - uFar); }
float coc(float d) {
  if (!uDofOn) return 0.0;
  float z = -viewZ(d);
  float c = 1.0 - uFocus / max(z, 1e-4);
  if (c < 0.0) c *= uNearScale;
  c = sign(c) * max(0.0, abs(c) - uSharp);
  c *= uFarBlur;
  c = clamp(c, -uNearBlur, uFarBlur);
  return c * uHalfH; // half-res pixels
}
void main() {
  // 4-tap box downsample of colour; depth taken as the nearest of the 4 so
  // foreground edges keep their CoC.
  vec2 o = uSrcTexel * 0.5;
  vec3 c = texture(tColor, vUv + vec2(-o.x, -o.y)).rgb + texture(tColor, vUv + vec2(o.x, -o.y)).rgb
         + texture(tColor, vUv + vec2(-o.x, o.y)).rgb + texture(tColor, vUv + vec2(o.x, o.y)).rgb;
  c *= 0.25;
  float d = min(min(texture(tDepth, vUv + vec2(-o.x, -o.y)).r, texture(tDepth, vUv + vec2(o.x, -o.y)).r),
                min(texture(tDepth, vUv + vec2(-o.x, o.y)).r, texture(tDepth, vUv + vec2(o.x, o.y)).r));
  outColor = vec4(c, coc(d));
}`;

// --- near CoC tile max --------------------------------------------------------
const TILEMAX_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uSrcTexel;
uniform int uTaps; // taps per axis
uniform bool uFromCoc; // first pass reads signed CoC in alpha
void main() {
  float m = 0.0;
  float h = float(uTaps) * 0.5;
  for (int y = 0; y < 16; y++) {
    if (y >= uTaps) break;
    for (int x = 0; x < 16; x++) {
      if (x >= uTaps) break;
      vec2 uv = vUv + (vec2(float(x), float(y)) - h + 0.5) * uSrcTexel;
      vec4 s = texture(tSrc, uv);
      float v = uFromCoc ? max(0.0, -s.a) : s.r;
      m = max(m, v);
    }
  }
  outColor = vec4(m, 0.0, 0.0, 1.0);
}`;

// --- DOF gather ---------------------------------------------------------------
const DOF_FRAG = /* glsl */ `
uniform sampler2D tCoc;
uniform sampler2D tNear;
uniform vec2 uTexel;
const int N = 64;
void main() {
  vec4 c0 = textureLod(tCoc, vUv, 0.0);
  float cc = abs(c0.a);
  float nearMax = texture(tNear, vUv).r;
  float R = max(cc, nearMax);
  if (R < 0.5) { outColor = vec4(c0.rgb, 0.0); return; }
  float spacing = R * 1.7725 / sqrt(float(N));
  float lod = clamp(log2(max(spacing, 1.0)) - 0.25, 0.0, 6.0);
  vec3 bg = c0.rgb; float bgW = 1.0;
  vec3 fg = vec3(0.0); float fgW = 0.0;
  for (int i = 0; i < N; i++) {
    float r = R * sqrt((float(i) + 0.5) / float(N));
    float a = float(i) * 2.39996323;
    vec2 off = vec2(cos(a), sin(a)) * r;
    vec4 s = textureLod(tCoc, vUv + off * uTexel, lod);
    float sc = abs(s.a);
    if (s.a < c0.a - 0.5) {
      // nearer than us: scatters over us if its CoC reaches
      float w = clamp(sc - r + 1.0, 0.0, 1.0);
      fg += s.rgb * w; fgW += w;
    } else {
      float w = clamp(min(sc, cc) - r + 1.0, 0.0, 1.0);
      bg += s.rgb * w; bgW += w;
    }
  }
  vec3 bgc = bg / bgW;
  float alpha = clamp(fgW / float(N) * 1.6, 0.0, 1.0);
  vec3 fgc = fgW > 0.0 ? fg / fgW : bgc;
  outColor = vec4(mix(bgc, fgc, alpha), alpha);
}`;

// --- bloom ----------------------------------------------------------------------
const BLOOM_PREFILTER_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uSrcTexel;
uniform float uThreshold, uKnee;
vec3 karis(vec3 a, vec3 b, vec3 c, vec3 d) {
  float wa = 1.0 / (1.0 + luma(a)), wb = 1.0 / (1.0 + luma(b)), wc = 1.0 / (1.0 + luma(c)), wd = 1.0 / (1.0 + luma(d));
  return (a * wa + b * wb + c * wc + d * wd) / (wa + wb + wc + wd);
}
void main() {
  vec2 o = uSrcTexel;
  vec3 a = texture(tSrc, vUv + vec2(-o.x, -o.y)).rgb;
  vec3 b = texture(tSrc, vUv + vec2(o.x, -o.y)).rgb;
  vec3 c = texture(tSrc, vUv + vec2(-o.x, o.y)).rgb;
  vec3 d = texture(tSrc, vUv + vec2(o.x, o.y)).rgb;
  vec3 col = karis(a, b, c, d);
  float br = max(col.r, max(col.g, col.b));
  float rq = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  rq = (rq * rq) / (4.0 * uKnee + 1e-5);
  float w = max(rq, br - uThreshold) / max(br, 1e-5);
  outColor = vec4(col * w, 1.0);
}`;

const BLOOM_DOWN_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uSrcTexel;
void main() {
  vec2 t = uSrcTexel;
  vec3 a = texture(tSrc, vUv + t * vec2(-2.0, -2.0)).rgb;
  vec3 b = texture(tSrc, vUv + t * vec2( 0.0, -2.0)).rgb;
  vec3 c = texture(tSrc, vUv + t * vec2( 2.0, -2.0)).rgb;
  vec3 d = texture(tSrc, vUv + t * vec2(-2.0,  0.0)).rgb;
  vec3 e = texture(tSrc, vUv).rgb;
  vec3 f = texture(tSrc, vUv + t * vec2( 2.0,  0.0)).rgb;
  vec3 g = texture(tSrc, vUv + t * vec2(-2.0,  2.0)).rgb;
  vec3 h = texture(tSrc, vUv + t * vec2( 0.0,  2.0)).rgb;
  vec3 i = texture(tSrc, vUv + t * vec2( 2.0,  2.0)).rgb;
  vec3 j = texture(tSrc, vUv + t * vec2(-1.0, -1.0)).rgb;
  vec3 k = texture(tSrc, vUv + t * vec2( 1.0, -1.0)).rgb;
  vec3 l = texture(tSrc, vUv + t * vec2(-1.0,  1.0)).rgb;
  vec3 m = texture(tSrc, vUv + t * vec2( 1.0,  1.0)).rgb;
  vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  outColor = vec4(col, 1.0);
}`;

const BLOOM_UP_FRAG = /* glsl */ `
uniform sampler2D tLow;   // coarser, already-accumulated level
uniform sampler2D tHigh;  // this level's downsample
uniform vec2 uLowTexel;
uniform float uRadius;
void main() {
  vec2 t = uLowTexel;
  vec3 s = texture(tLow, vUv).rgb * 4.0;
  s += (texture(tLow, vUv + vec2(-t.x, 0.0)).rgb + texture(tLow, vUv + vec2(t.x, 0.0)).rgb
      + texture(tLow, vUv + vec2(0.0, -t.y)).rgb + texture(tLow, vUv + vec2(0.0, t.y)).rgb) * 2.0;
  s += texture(tLow, vUv + vec2(-t.x, -t.y)).rgb + texture(tLow, vUv + vec2(t.x, -t.y)).rgb
     + texture(tLow, vUv + vec2(-t.x, t.y)).rgb + texture(tLow, vUv + vec2(t.x, t.y)).rgb;
  s /= 16.0;
  outColor = vec4(texture(tHigh, vUv).rgb + s * uRadius, 1.0);
}`;

// --- final composite -------------------------------------------------------------
const FINAL_FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tDepth;
uniform sampler2D tDof;
uniform sampler2D tBloom;
uniform bool uDofOn;
uniform float uNear, uFar, uFocus, uFarBlur, uNearBlur, uNearScale, uSharp, uHalfH;
uniform float uExposure, uBloom, uGrain, uVignette, uSat, uAspect, uBlackFloor;
uniform vec3 uTint;
uniform uint uFrame;

float viewZ(float d) { return (uNear * uFar) / ((uFar - uNear) * d - uFar); }
float coc(float d) {
  float z = -viewZ(d);
  float c = 1.0 - uFocus / max(z, 1e-4);
  if (c < 0.0) c *= uNearScale;
  c = sign(c) * max(0.0, abs(c) - uSharp);
  c *= uFarBlur;
  c = clamp(c, -uNearBlur, uFarBlur);
  return c * uHalfH;
}

// Stephen Hill's ACES fit (RRT + ODT), sRGB primaries in/out.
const mat3 ACESIn = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
const mat3 ACESOut = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
vec3 RRTAndODTFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 aces(vec3 c) { return clamp(ACESOut * RRTAndODTFit(ACESIn * c), 0.0, 1.0); }
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
// PCG3D integer hash: a fixed formula of pixel position and frame number.
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
void main() {
  vec3 sharp = texture(tScene, vUv).rgb;
  vec3 col = sharp;
  if (uDofOn) {
    float c = abs(coc(texture(tDepth, vUv).r));
    vec4 dof = texture(tDof, vUv);
    float blend = max(smoothstep(0.35, 1.25, c), dof.a);
    col = mix(sharp, dof.rgb, blend);
  }
  col += texture(tBloom, vUv).rgb * uBloom;
  // vignette (elliptical, aspect-corrected)
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
  float v = 1.0 - uVignette * smoothstep(0.35, 1.05, length(p));
  col *= v * uTint;
  float l = luma(col);
  col = max(vec3(0.0), mix(vec3(l), col, uSat));
  col = max(col - uBlackFloor, 0.0);
  col = aces(col * uExposure);
  col = toSRGB(col);
  uvec3 h = pcg3d(uvec3(uvec2(gl_FragCoord.xy), uFrame));
  vec3 r = vec3(h) * (1.0 / 4294967295.0);
  if (uGrain > 0.0) {
    float g = (r.x + r.y - 1.0) * uGrain * mix(0.45, 1.0, sqrt(luma(col)));
    col += g;
  }
  // TPDF dither, +/-1/255; scaled to zero for pure black so black stays 0,0,0.
  uvec3 h2 = pcg3d(uvec3(uvec2(gl_FragCoord.xy) + 7919u, uFrame + 104729u));
  vec3 r2 = vec3(h2) * (1.0 / 4294967295.0);
  float dz = clamp(max(col.r, max(col.g, col.b)) * 255.0, 0.0, 1.0);
  col += (r.z + r2.x - 1.0) * (1.0 / 255.0) * dz;
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

const BLOOM_LEVELS = 6;

export class PostPipeline {
  private gl: THREE.WebGLRenderer;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: THREE.Mesh;
  private w = 0;
  private h = 0;
  private sceneRT!: THREE.WebGLRenderTarget;
  private cocRT!: THREE.WebGLRenderTarget;
  private tileRT!: THREE.WebGLRenderTarget;
  private tile2RT!: THREE.WebGLRenderTarget;
  private dofRT!: THREE.WebGLRenderTarget;
  private down: THREE.WebGLRenderTarget[] = [];
  private up: THREE.WebGLRenderTarget[] = [];
  private cocMat = makeMat(COC_FRAG, {
    tColor: { value: null },
    tDepth: { value: null },
    uSrcTexel: { value: new THREE.Vector2() },
    uNear: { value: 0.1 },
    uFar: { value: 100 },
    uFocus: { value: 10 },
    uFarBlur: { value: 0 },
    uNearBlur: { value: 0 },
    uNearScale: { value: 1 },
    uSharp: { value: 0 },
    uHalfH: { value: 1 },
    uDofOn: { value: true },
  });
  private tileMat = makeMat(TILEMAX_FRAG, {
    tSrc: { value: null },
    uSrcTexel: { value: new THREE.Vector2() },
    uTaps: { value: 8 },
    uFromCoc: { value: true },
  });
  private dofMat = makeMat(DOF_FRAG, {
    tCoc: { value: null },
    tNear: { value: null },
    uTexel: { value: new THREE.Vector2() },
  });
  private preMat = makeMat(BLOOM_PREFILTER_FRAG, {
    tSrc: { value: null },
    uSrcTexel: { value: new THREE.Vector2() },
    uThreshold: { value: 1 },
    uKnee: { value: 0.5 },
  });
  private downMat = makeMat(BLOOM_DOWN_FRAG, {
    tSrc: { value: null },
    uSrcTexel: { value: new THREE.Vector2() },
  });
  private upMat = makeMat(BLOOM_UP_FRAG, {
    tLow: { value: null },
    tHigh: { value: null },
    uLowTexel: { value: new THREE.Vector2() },
    uRadius: { value: 0.8 },
  });
  private finalMat = makeMat(FINAL_FRAG, {
    tScene: { value: null },
    tDepth: { value: null },
    tDof: { value: null },
    tBloom: { value: null },
    uDofOn: { value: true },
    uNear: { value: 0.1 },
    uFar: { value: 100 },
    uFocus: { value: 10 },
    uFarBlur: { value: 0 },
    uNearBlur: { value: 0 },
    uNearScale: { value: 1 },
    uSharp: { value: 0 },
    uHalfH: { value: 1 },
    uExposure: { value: 1 },
    uBloom: { value: 0 },
    uGrain: { value: 0 },
    uVignette: { value: 0 },
    uSat: { value: 1 },
    uAspect: { value: 16 / 9 },
    uBlackFloor: { value: 0 },
    uTint: { value: new THREE.Vector3(1, 1, 1) },
    uFrame: { value: 0 },
  });

  constructor(gl: THREE.WebGLRenderer) {
    this.gl = gl;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.quad = new THREE.Mesh(geo, this.finalMat);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  private rt(w: number, h: number, opts: THREE.RenderTargetOptions = {}) {
    return new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      ...opts,
    } as THREE.RenderTargetOptions);
  }

  setSize(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    this.dispose();
    this.w = w;
    this.h = h;
    const depthTexture = new THREE.DepthTexture(w, h, THREE.FloatType);
    depthTexture.minFilter = THREE.NearestFilter;
    depthTexture.magFilter = THREE.NearestFilter;
    this.sceneRT = this.rt(w, h, { samples: 4, depthBuffer: true, depthTexture });
    const hw = Math.ceil(w / 2);
    const hh = Math.ceil(h / 2);
    this.cocRT = this.rt(hw, hh, {
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
    });
    this.tileRT = this.rt(Math.ceil(hw / 8), Math.ceil(hh / 8), {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    });
    this.tile2RT = this.rt(Math.ceil(hw / 8), Math.ceil(hh / 8));
    this.dofRT = this.rt(hw, hh);
    this.down = [];
    this.up = [];
    let bw = hw;
    let bh = hh;
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      bw = Math.max(1, Math.ceil(bw / 2));
      bh = Math.max(1, Math.ceil(bh / 2));
      this.down.push(this.rt(bw, bh));
      this.up.push(this.rt(bw, bh));
    }
  }

  dispose() {
    const all = [this.sceneRT, this.cocRT, this.tileRT, this.tile2RT, this.dofRT, ...this.down, ...this.up];
    for (const t of all) {
      if (t) {
        t.depthTexture?.dispose();
        t.dispose();
      }
    }
  }

  private pass(mat: THREE.Material, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    this.gl.setRenderTarget(target);
    this.gl.render(this.quadScene, this.quadCam);
  }

  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera, frame: number, p: PostParams) {
    const gl = this.gl;
    const { w, h } = this;
    gl.autoClear = true;
    gl.setClearColor(0x000000, 1);
    gl.setRenderTarget(this.sceneRT);
    gl.clear(true, true, true);
    gl.render(scene, camera);

    const d = p.dof;
    const dofUniforms = (u: Record<string, THREE.IUniform>) => {
      u.uNear.value = camera.near;
      u.uFar.value = camera.far;
      u.uFocus.value = d.focusDistance;
      u.uFarBlur.value = d.farBlur;
      u.uNearBlur.value = d.nearBlur;
      u.uNearScale.value = d.nearScale ?? 1;
      u.uSharp.value = d.sharpZone ?? 0;
      u.uHalfH.value = this.cocRT.height;
    };

    // CoC + downsample (also used as bloom source when DOF is off)
    const cu = this.cocMat.uniforms;
    cu.tColor.value = this.sceneRT.texture;
    cu.tDepth.value = this.sceneRT.depthTexture;
    cu.uSrcTexel.value.set(1 / w, 1 / h);
    cu.uDofOn.value = d.enabled;
    dofUniforms(cu);
    this.pass(this.cocMat, this.cocRT);

    let bloomSrc: THREE.Texture = this.cocRT.texture;
    if (d.enabled) {
      const tu = this.tileMat.uniforms;
      tu.tSrc.value = this.cocRT.texture;
      tu.uSrcTexel.value.set(1 / this.cocRT.width, 1 / this.cocRT.height);
      tu.uTaps.value = 8;
      tu.uFromCoc.value = true;
      this.pass(this.tileMat, this.tileRT);
      tu.tSrc.value = this.tileRT.texture;
      tu.uSrcTexel.value.set(1 / this.tileRT.width, 1 / this.tileRT.height);
      tu.uTaps.value = 3;
      tu.uFromCoc.value = false;
      this.pass(this.tileMat, this.tile2RT);

      const du = this.dofMat.uniforms;
      du.tCoc.value = this.cocRT.texture;
      du.tNear.value = this.tile2RT.texture;
      du.uTexel.value.set(1 / this.cocRT.width, 1 / this.cocRT.height);
      this.pass(this.dofMat, this.dofRT);
      bloomSrc = this.dofRT.texture;
    }

    // Bloom chain
    const pu = this.preMat.uniforms;
    pu.tSrc.value = bloomSrc;
    pu.uSrcTexel.value.set(1 / this.cocRT.width, 1 / this.cocRT.height);
    pu.uThreshold.value = p.bloomThreshold;
    pu.uKnee.value = p.bloomKnee ?? 0.5;
    this.pass(this.preMat, this.down[0]);
    const dn = this.downMat.uniforms;
    for (let i = 1; i < BLOOM_LEVELS; i++) {
      dn.tSrc.value = this.down[i - 1].texture;
      dn.uSrcTexel.value.set(1 / this.down[i - 1].width, 1 / this.down[i - 1].height);
      this.pass(this.downMat, this.down[i]);
    }
    const uu = this.upMat.uniforms;
    let low = this.down[BLOOM_LEVELS - 1];
    for (let i = BLOOM_LEVELS - 2; i >= 0; i--) {
      uu.tLow.value = low.texture;
      uu.tHigh.value = this.down[i].texture;
      uu.uLowTexel.value.set(1 / low.width, 1 / low.height);
      uu.uRadius.value = p.bloomRadius;
      this.pass(this.upMat, this.up[i]);
      low = this.up[i];
    }

    const fu = this.finalMat.uniforms;
    fu.tScene.value = this.sceneRT.texture;
    fu.tDepth.value = this.sceneRT.depthTexture;
    fu.tDof.value = this.dofRT.texture;
    fu.tBloom.value = this.up[0].texture;
    fu.uDofOn.value = d.enabled;
    dofUniforms(fu);
    fu.uExposure.value = p.exposure;
    // normalise bloom so the strength reads the same regardless of radius
    let norm = 0;
    for (let i = 0; i < BLOOM_LEVELS; i++) norm += Math.pow(p.bloomRadius, i);
    fu.uBloom.value = p.bloomStrength / norm;
    fu.uGrain.value = p.grain;
    fu.uVignette.value = p.vignette;
    fu.uSat.value = p.saturation ?? 1;
    fu.uBlackFloor.value = p.blackFloor ?? 0;
    fu.uAspect.value = w / h;
    const t = p.tint ?? [1, 1, 1];
    fu.uTint.value.set(t[0], t[1], t[2]);
    fu.uFrame.value = (p.loopFrames ? frame % p.loopFrames : frame) >>> 0;
    this.pass(this.finalMat, null);
  }
}
