import * as THREE from "three";

/*
 * Post pipeline shared by all looks.
 *
 *   scene (MSAA, half float, alpha = circle-of-confusion when DoF is on)
 *     -> [DoF: quarter-res downsample, golden-angle gather, full-res combine]
 *     -> bloom (mip chain, 13-tap down / tent up, resolution independent)
 *     -> composite: exposure, ACES, sRGB encode, vignette, grain, dither.
 *
 * Every pass is a pure function of its inputs and of the frame uniform; no
 * history buffers, no temporal accumulation.
 */

const VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

export const HASH_GLSL = /* glsl */ `
uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float hash3(uvec3 v) {
  return float(pcg(v.x + pcg(v.y + pcg(v.z)))) / 4294967295.0;
}`;

const DOWN_FIRST = /* glsl */ `
precision highp float;
uniform sampler2D tSrc;
uniform vec2 texel;
in vec2 vUv;
out vec4 outColor;
float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 karis(vec3 a, vec3 b, vec3 c, vec3 d) {
  float wa = 1.0 / (1.0 + lum(a)), wb = 1.0 / (1.0 + lum(b));
  float wc = 1.0 / (1.0 + lum(c)), wd = 1.0 / (1.0 + lum(d));
  return (a * wa + b * wb + c * wc + d * wd) / (wa + wb + wc + wd);
}
uniform float threshold;
uniform float knee;
vec3 pre(vec3 c) {
  float br = max(c.r, max(c.g, c.b));
  float rq = clamp(br - threshold + knee, 0.0, 2.0 * knee);
  rq = (rq * rq) / (4.0 * knee + 1e-5);
  float w = max(rq, br - threshold) / max(br, 1e-5);
  return c * w;
}
void main() {
  vec2 t = texel;
  vec3 a = texture(tSrc, vUv + t * vec2(-2, 2)).rgb;
  vec3 b = texture(tSrc, vUv + t * vec2(0, 2)).rgb;
  vec3 c = texture(tSrc, vUv + t * vec2(2, 2)).rgb;
  vec3 d = texture(tSrc, vUv + t * vec2(-2, 0)).rgb;
  vec3 e = texture(tSrc, vUv).rgb;
  vec3 f = texture(tSrc, vUv + t * vec2(2, 0)).rgb;
  vec3 g = texture(tSrc, vUv + t * vec2(-2, -2)).rgb;
  vec3 h = texture(tSrc, vUv + t * vec2(0, -2)).rgb;
  vec3 i = texture(tSrc, vUv + t * vec2(2, -2)).rgb;
  vec3 j = texture(tSrc, vUv + t * vec2(-1, 1)).rgb;
  vec3 k = texture(tSrc, vUv + t * vec2(1, 1)).rgb;
  vec3 l = texture(tSrc, vUv + t * vec2(-1, -1)).rgb;
  vec3 m = texture(tSrc, vUv + t * vec2(1, -1)).rgb;
  vec3 col = karis(j, k, l, m) * 0.5
    + karis(a, b, d, e) * 0.125 + karis(b, c, e, f) * 0.125
    + karis(d, e, g, h) * 0.125 + karis(e, f, h, i) * 0.125;
  outColor = vec4(pre(max(col, 0.0)), 1.0);
}`;

const DOWN = /* glsl */ `
precision highp float;
uniform sampler2D tSrc;
uniform vec2 texel;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec2 t = texel;
  vec3 a = texture(tSrc, vUv + t * vec2(-2, 2)).rgb;
  vec3 b = texture(tSrc, vUv + t * vec2(0, 2)).rgb;
  vec3 c = texture(tSrc, vUv + t * vec2(2, 2)).rgb;
  vec3 d = texture(tSrc, vUv + t * vec2(-2, 0)).rgb;
  vec3 e = texture(tSrc, vUv).rgb;
  vec3 f = texture(tSrc, vUv + t * vec2(2, 0)).rgb;
  vec3 g = texture(tSrc, vUv + t * vec2(-2, -2)).rgb;
  vec3 h = texture(tSrc, vUv + t * vec2(0, -2)).rgb;
  vec3 i = texture(tSrc, vUv + t * vec2(2, -2)).rgb;
  vec3 j = texture(tSrc, vUv + t * vec2(-1, 1)).rgb;
  vec3 k = texture(tSrc, vUv + t * vec2(1, 1)).rgb;
  vec3 l = texture(tSrc, vUv + t * vec2(-1, -1)).rgb;
  vec3 m = texture(tSrc, vUv + t * vec2(1, -1)).rgb;
  vec3 col = e * 0.125 + (a + c + g + i) * 0.03125
    + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  outColor = vec4(col, 1.0);
}`;

const UP = /* glsl */ `
precision highp float;
uniform sampler2D tSrc;
uniform vec2 texel;
uniform float spread;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec2 t = texel;
  vec3 c = texture(tSrc, vUv).rgb * 4.0;
  c += (texture(tSrc, vUv + t * vec2(-1, 0)).rgb + texture(tSrc, vUv + t * vec2(1, 0)).rgb
      + texture(tSrc, vUv + t * vec2(0, -1)).rgb + texture(tSrc, vUv + t * vec2(0, 1)).rgb) * 2.0;
  c += texture(tSrc, vUv + t * vec2(-1, -1)).rgb + texture(tSrc, vUv + t * vec2(1, -1)).rgb
     + texture(tSrc, vUv + t * vec2(-1, 1)).rgb + texture(tSrc, vUv + t * vec2(1, 1)).rgb;
  outColor = vec4(c / 16.0 * spread, 1.0);
}`;

// ---- Depth of field (CoC in scene alpha, 0..1 of maxCoc) -------------------

const DOF_DOWN = /* glsl */ `
precision highp float;
uniform sampler2D tSrc;
uniform vec2 texel; // full-res texel
in vec2 vUv;
out vec4 outColor;
void main() {
  vec4 a = texture(tSrc, vUv + texel * vec2(-1.0, -1.0));
  vec4 b = texture(tSrc, vUv + texel * vec2(1.0, -1.0));
  vec4 c = texture(tSrc, vUv + texel * vec2(-1.0, 1.0));
  vec4 d = texture(tSrc, vUv + texel * vec2(1.0, 1.0));
  outColor = (a + b + c + d) * 0.25;
}`;

const DOF_BLUR = /* glsl */ `
precision highp float;
uniform sampler2D tSrc;
uniform vec2 texel; // quarter-res texel
uniform float maxR; // px at quarter res
in vec2 vUv;
out vec4 outColor;
const int N = 64;
void main() {
  vec4 center = texture(tSrc, vUv);
  float cR = center.a * maxR;
  vec3 acc = center.rgb / max(cR * cR, 1.0);
  float wsum = 1.0 / max(cR * cR, 1.0);
  for (int i = 1; i < N; i++) {
    float fi = float(i);
    float r = sqrt(fi / float(N)) * maxR;
    float ang = fi * 2.39996323;
    vec2 off = vec2(cos(ang), sin(ang)) * r;
    vec4 s = texture(tSrc, vUv + off * texel);
    float sR = s.a * maxR;
    float w = clamp(sR - r + 1.5, 0.0, 1.0) / max(sR * sR, 1.0);
    acc += s.rgb * w;
    wsum += w;
  }
  outColor = vec4(acc / wsum, center.a);
}`;

const DOF_COMBINE = /* glsl */ `
precision highp float;
uniform sampler2D tSharp;
uniform sampler2D tBlur;
uniform vec2 blurTexel;
uniform float maxRFull;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec4 sharp = texture(tSharp, vUv);
  vec2 t = blurTexel * 0.5;
  vec3 bl = (texture(tBlur, vUv + t * vec2(-1, -1)).rgb + texture(tBlur, vUv + t * vec2(1, -1)).rgb
           + texture(tBlur, vUv + t * vec2(-1, 1)).rgb + texture(tBlur, vUv + t * vec2(1, 1)).rgb) * 0.25;
  float rpx = sharp.a * maxRFull;
  float k = smoothstep(0.75, 4.0, rpx);
  outColor = vec4(mix(sharp.rgb, bl, k), 1.0);
}`;

// ---- Composite --------------------------------------------------------------

const COMPOSITE = /* glsl */ `
precision highp float;
precision highp int;
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform float bloomStrength;
uniform float exposure;
uniform float vignette;
uniform float grain;
uniform float frameMod;
uniform vec2 resolution;
uniform vec3 lift;
in vec2 vUv;
out vec4 outColor;
${HASH_GLSL}
vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  vec3 hdr = texture(tScene, vUv).rgb + texture(tBloom, vUv).rgb * bloomStrength;
  hdr = max(hdr, 0.0) * exposure + lift;
  vec2 q = vUv - 0.5;
  q.x *= resolution.x / resolution.y;
  hdr *= mix(1.0, smoothstep(1.25, 0.2, length(q)), vignette);
  vec3 c = toSRGB(aces(hdr));
  uvec2 px = uvec2(gl_FragCoord.xy);
  uint f = uint(frameMod);
  float g1 = hash3(uvec3(px, f));
  float g2 = hash3(uvec3(px, f + 911u));
  float g3 = hash3(uvec3(px + 7919u, f + 3571u));
  // Film grain: fixed function of pixel and frame % 600 (luma, mostly in mids).
  float lumc = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float gr = (g1 + g2 - 1.0) * grain * (0.35 + 0.65 * sqrt(clamp(lumc, 0.0, 1.0)));
  c += gr;
  // Triangular dither, +/- 1/255, after tonemapping.
  c += (g2 + g3 - 1.0) / 255.0;
  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

export type PostOptions = {
  dof: boolean;
  maxCoc: number; // max blur radius as a fraction of frame height
  bloomStrength: number;
  bloomSpread: number;
  threshold: number;
  knee: number;
  exposure: number;
  vignette: number;
  grain: number;
  lift?: [number, number, number];
};

const mkRT = (w: number, h: number, samples = 0, depth = false) =>
  new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: depth,
    stencilBuffer: false,
    samples,
    generateMipmaps: false,
    colorSpace: THREE.NoColorSpace,
  });

const mkMat = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VERT,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });

export class Post {
  opts: PostOptions;
  w = 0;
  h = 0;
  sceneRT!: THREE.WebGLRenderTarget;
  dofDown!: THREE.WebGLRenderTarget;
  dofBlur!: THREE.WebGLRenderTarget;
  dofOut!: THREE.WebGLRenderTarget;
  mips: THREE.WebGLRenderTarget[] = [];
  skip = 0;
  quad: THREE.Mesh;
  qScene = new THREE.Scene();
  qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  mDownFirst = mkMat(DOWN_FIRST, {
    tSrc: { value: null },
    texel: { value: new THREE.Vector2() },
    threshold: { value: 0 },
    knee: { value: 0.5 },
  });
  mDown = mkMat(DOWN, { tSrc: { value: null }, texel: { value: new THREE.Vector2() } });
  mUp = mkMat(UP, {
    tSrc: { value: null },
    texel: { value: new THREE.Vector2() },
    spread: { value: 1 },
  });
  mDofDown = mkMat(DOF_DOWN, { tSrc: { value: null }, texel: { value: new THREE.Vector2() } });
  mDofBlur = mkMat(DOF_BLUR, {
    tSrc: { value: null },
    texel: { value: new THREE.Vector2() },
    maxR: { value: 1 },
  });
  mDofCombine = mkMat(DOF_COMBINE, {
    tSharp: { value: null },
    tBlur: { value: null },
    blurTexel: { value: new THREE.Vector2() },
    maxRFull: { value: 1 },
  });
  mComposite = mkMat(COMPOSITE, {
    tScene: { value: null },
    tBloom: { value: null },
    bloomStrength: { value: 1 },
    exposure: { value: 1 },
    vignette: { value: 0 },
    grain: { value: 0.02 },
    frameMod: { value: 0 },
    resolution: { value: new THREE.Vector2() },
    lift: { value: new THREE.Vector3() },
  });

  constructor(opts: PostOptions) {
    this.opts = opts;
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
    );
    this.quad = new THREE.Mesh(g, this.mDown);
    this.quad.frustumCulled = false;
    this.qScene.add(this.quad);
    this.mUp.blending = THREE.AdditiveBlending;
    this.mUp.transparent = true;
  }

  resize(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    this.dispose();
    this.w = w;
    this.h = h;
    this.sceneRT = mkRT(w, h, 4, true);
    if (this.opts.dof) {
      const qw = Math.ceil(w / 4);
      const qh = Math.ceil(h / 4);
      this.dofDown = mkRT(qw, qh);
      this.dofBlur = mkRT(qw, qh);
      this.dofOut = mkRT(w, h);
    }
    // Bloom chain: same angular extent at every output size. Levels finer
    // than the 720p chain's first level are skipped in the upsample.
    const levels = Math.max(4, Math.round(Math.log2(h)) - 3);
    this.skip = Math.max(0, Math.round(Math.log2(h / 720)));
    this.mips = [];
    let mw = w;
    let mh = h;
    for (let i = 0; i < levels; i++) {
      mw = Math.max(1, Math.floor(mw / 2));
      mh = Math.max(1, Math.floor(mh / 2));
      this.mips.push(mkRT(mw, mh));
    }
  }

  dispose() {
    this.sceneRT?.dispose();
    this.dofDown?.dispose();
    this.dofBlur?.dispose();
    this.dofOut?.dispose();
    this.mips.forEach((m) => m.dispose());
  }

  pass(gl: THREE.WebGLRenderer, mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null, clear = true) {
    this.quad.material = mat;
    gl.setRenderTarget(target);
    if (clear) {
      gl.setClearColor(0x000000, 0);
      gl.clear(true, false, false);
    }
    gl.render(this.qScene, this.qCam);
  }

  render(
    gl: THREE.WebGLRenderer,
    drawScene: (target: THREE.WebGLRenderTarget) => void,
    frameMod: number,
  ) {
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    this.resize(size.x, size.y);
    const o = this.opts;
    gl.autoClear = false;

    drawScene(this.sceneRT);

    let src: THREE.WebGLRenderTarget = this.sceneRT;
    if (o.dof) {
      this.mDofDown.uniforms.tSrc.value = this.sceneRT.texture;
      this.mDofDown.uniforms.texel.value.set(1 / this.w, 1 / this.h);
      this.pass(gl, this.mDofDown, this.dofDown);
      // a second 2x2 box on top of the first gives a 4x4 average
      const qh = this.dofDown.height;
      this.mDofBlur.uniforms.tSrc.value = this.dofDown.texture;
      this.mDofBlur.uniforms.texel.value.set(1 / this.dofDown.width, 1 / qh);
      this.mDofBlur.uniforms.maxR.value = o.maxCoc * qh;
      this.pass(gl, this.mDofBlur, this.dofBlur);
      this.mDofCombine.uniforms.tSharp.value = this.sceneRT.texture;
      this.mDofCombine.uniforms.tBlur.value = this.dofBlur.texture;
      this.mDofCombine.uniforms.blurTexel.value.set(1 / this.dofBlur.width, 1 / qh);
      this.mDofCombine.uniforms.maxRFull.value = o.maxCoc * this.h;
      this.pass(gl, this.mDofCombine, this.dofOut);
      src = this.dofOut;
    }

    // Bloom down
    this.mDownFirst.uniforms.tSrc.value = src.texture;
    this.mDownFirst.uniforms.texel.value.set(1 / src.width, 1 / src.height);
    this.mDownFirst.uniforms.threshold.value = o.threshold;
    this.mDownFirst.uniforms.knee.value = o.knee;
    this.pass(gl, this.mDownFirst, this.mips[0]);
    for (let i = 1; i < this.mips.length; i++) {
      const prev = this.mips[i - 1];
      this.mDown.uniforms.tSrc.value = prev.texture;
      this.mDown.uniforms.texel.value.set(1 / prev.width, 1 / prev.height);
      this.pass(gl, this.mDown, this.mips[i]);
    }
    // Bloom up (additive)
    for (let i = this.mips.length - 1; i > this.skip; i--) {
      const s = this.mips[i];
      this.mUp.uniforms.tSrc.value = s.texture;
      this.mUp.uniforms.texel.value.set(1 / s.width, 1 / s.height);
      this.mUp.uniforms.spread.value = o.bloomSpread;
      this.pass(gl, this.mUp, this.mips[i - 1], false);
    }
    const bloomTex = this.mips[this.skip];

    const c = this.mComposite.uniforms;
    c.tScene.value = src.texture;
    c.tBloom.value = bloomTex.texture;
    c.bloomStrength.value = o.bloomStrength / (this.mips.length - this.skip);
    c.exposure.value = o.exposure;
    c.vignette.value = o.vignette;
    c.grain.value = o.grain;
    c.frameMod.value = frameMod;
    c.resolution.value.set(this.w, this.h);
    c.lift.value.set(...(o.lift ?? [0, 0, 0]));
    this.pass(gl, this.mComposite, null);
  }
}
