import * as THREE from "three";

/**
 * Single-frame post pipeline shared by every look:
 *
 *   scene (HDR, 4x MSAA, depth texture)
 *     -> DoF prefilter (half res: colour + signed CoC)
 *     -> DoF gather    (half res, fixed golden-angle spiral, scatter-as-gather)
 *     -> DoF composite (full res: sharp/blurred mix by CoC)
 *     -> bloom         (deterministic mip chain: 13-tap down, tent up)
 *     -> final         (exposure, tonemap, vignette, sRGB, grain, dither)
 *
 * Nothing here keeps state between frames (no TAA, no history buffers):
 * the output depends only on the scene as it is set up for the current frame
 * and on the frame number fed into the grain.
 *
 * All sizes (CoC, bloom radius) are fractions of the frame height, so a
 * 720p preview looks like a downscaled 4K frame.
 */

export interface PostSettings {
  /** Focus distance along the view axis, world units. */
  focusDist: number;
  /** CoC (fraction of frame height) per unit of |1 - focus/z|. */
  aperture: number;
  /** Clamp for the CoC, fraction of frame height. */
  maxCoc: number;
  /** Extra constant CoC added everywhere (fraction of height) — 0 normally. */
  bloomStrength: number;
  bloomThreshold: number;
  bloomKnee: number;
  /** 0..1, how much the wide mips weigh against the tight ones. */
  bloomSpread: number;
  exposure: number;
  vignette: number;
  /** Grain amplitude in display units (0.015 = 1.5%). */
  grain: number;
  /** Mild saturation tweak after tonemapping. */
  saturation: number;
  /** Optional lift of the black point (display units). */
  lift: number;
}

export const defaultPost = (): PostSettings => ({
  focusDist: 5,
  aperture: 0.02,
  maxCoc: 0.02,
  bloomStrength: 0.6,
  bloomThreshold: 1.0,
  bloomKnee: 0.5,
  bloomSpread: 0.6,
  exposure: 1,
  vignette: 0.3,
  grain: 0.015,
  saturation: 1,
  lift: 0,
});

const VERT = /* glsl */ `
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const COMMON = /* glsl */ `
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 outColor;
uniform float uNear;
uniform float uFar;
uniform float uFocus;
uniform float uAperture;
uniform float uMaxCoc;
float linZ(float d) {
  return uNear * uFar / (uFar - d * (uFar - uNear));
}
// signed CoC as a fraction of frame height: + behind focus, - in front
float cocOf(float z) {
  float c = uAperture * (1.0 - uFocus / z);
  return clamp(c, -uMaxCoc, uMaxCoc);
}
`;

const PREFILTER = /* glsl */ `
${COMMON}
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uSrcTexel;
uniform float uHeightPx; // half-res height in px
void main() {
  vec2 o = uSrcTexel * 0.5;
  vec2 uv0 = vUv + vec2(-o.x, -o.y);
  vec2 uv1 = vUv + vec2( o.x, -o.y);
  vec2 uv2 = vUv + vec2(-o.x,  o.y);
  vec2 uv3 = vUv + vec2( o.x,  o.y);
  vec3 c0 = texture(tColor, uv0).rgb;
  vec3 c1 = texture(tColor, uv1).rgb;
  vec3 c2 = texture(tColor, uv2).rgb;
  vec3 c3 = texture(tColor, uv3).rgb;
  // Karis weighting: keeps single bright pins from flickering in the bokeh
  float w0 = 1.0 / (1.0 + max(max(c0.r, c0.g), c0.b));
  float w1 = 1.0 / (1.0 + max(max(c1.r, c1.g), c1.b));
  float w2 = 1.0 / (1.0 + max(max(c2.r, c2.g), c2.b));
  float w3 = 1.0 / (1.0 + max(max(c3.r, c3.g), c3.b));
  vec3 c = (c0 * w0 + c1 * w1 + c2 * w2 + c3 * w3) / (w0 + w1 + w2 + w3);
  float z = min(min(linZ(texture(tDepth, uv0).r), linZ(texture(tDepth, uv1).r)),
                min(linZ(texture(tDepth, uv2).r), linZ(texture(tDepth, uv3).r)));
  outColor = vec4(c, cocOf(z) * uHeightPx);
}`;

const GATHER_SAMPLES = 72;
const GATHER = /* glsl */ `
${COMMON}
uniform sampler2D tPre;
uniform vec2 uTexel;
uniform float uMaxPx;
const int N = ${GATHER_SAMPLES};
const float GOLDEN = 2.39996323;
void main() {
  vec4 c0 = texture(tPre, vUv);
  float s0 = abs(c0.a);
  vec3 acc = c0.rgb;
  float tot = 1.0;
  float fg = 0.0;
  float ring = uMaxPx / sqrt(float(N)) + 0.5;
  for (int i = 0; i < N; i++) {
    float fi = float(i) + 0.5;
    float r = uMaxPx * sqrt(fi / float(N));
    float a = fi * GOLDEN;
    vec2 uv = vUv + vec2(cos(a), sin(a)) * r * uTexel;
    vec4 s = texture(tPre, uv);
    float ss = abs(s.a);
    // a sample behind the centre cannot blur over a sharper centre
    if (s.a > c0.a) ss = min(ss, s0 * 2.0);
    float m = smoothstep(r - ring, r + ring, ss);
    acc += mix(acc / tot, s.rgb, m);
    tot += 1.0;
    if (s.a < c0.a - 0.5) fg += m;
  }
  float blend = max(smoothstep(0.25, 1.25, s0), clamp(fg * 4.0 / float(N), 0.0, 1.0));
  outColor = vec4(acc / tot, blend);
}`;

const COMPOSITE = /* glsl */ `
${COMMON}
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tDof;
uniform float uHeightPx;
void main() {
  vec3 sharp = texture(tColor, vUv).rgb;
  vec4 blur = texture(tDof, vUv);
  float cpx = abs(cocOf(linZ(texture(tDepth, vUv).r))) * uHeightPx;
  float b = max(blur.a, smoothstep(0.5, 2.0, cpx));
  outColor = vec4(mix(sharp, blur.rgb, b), 1.0);
}`;

const BLOOM_DOWN = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uPrefilter;
uniform float uThreshold;
uniform float uKnee;
vec3 tap(vec2 o) { return texture(tSrc, vUv + o * uTexel).rgb; }
vec3 thresh(vec3 c) {
  float br = max(max(c.r, c.g), c.b);
  float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-4);
  float contrib = max(soft, br - uThreshold) / max(br, 1e-4);
  return c * contrib;
}
float kw(vec3 c) { return 1.0 / (1.0 + max(max(c.r, c.g), c.b)); }
void main() {
  // 13-tap (CoD: AW) downsample
  vec3 a = tap(vec2(-2.0, -2.0)), b = tap(vec2(0.0, -2.0)), c = tap(vec2(2.0, -2.0));
  vec3 d = tap(vec2(-1.0, -1.0)), e = tap(vec2(1.0, -1.0));
  vec3 f = tap(vec2(-2.0, 0.0)), g = tap(vec2(0.0, 0.0)), h = tap(vec2(2.0, 0.0));
  vec3 i = tap(vec2(-1.0, 1.0)), j = tap(vec2(1.0, 1.0));
  vec3 k = tap(vec2(-2.0, 2.0)), l = tap(vec2(0.0, 2.0)), m = tap(vec2(2.0, 2.0));
  vec3 res;
  if (uPrefilter > 0.5) {
    vec3 g0 = (d + e + i + j) * 0.25;
    vec3 g1 = (a + b + f + g) * 0.25;
    vec3 g2 = (b + c + g + h) * 0.25;
    vec3 g3 = (f + g + k + l) * 0.25;
    vec3 g4 = (g + h + l + m) * 0.25;
    float w0 = kw(g0) * 0.5, w1 = kw(g1) * 0.125, w2 = kw(g2) * 0.125, w3 = kw(g3) * 0.125, w4 = kw(g4) * 0.125;
    res = (g0 * w0 + g1 * w1 + g2 * w2 + g3 * w3 + g4 * w4) / (w0 + w1 + w2 + w3 + w4);
    res = thresh(res);
  } else {
    res = (d + e + i + j) * 0.125;
    res += (a + b + f + g) * 0.03125;
    res += (b + c + g + h) * 0.03125;
    res += (f + g + k + l) * 0.03125;
    res += (g + h + l + m) * 0.03125;
  }
  outColor = vec4(res, 1.0);
}`;

const BLOOM_UP = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tLow;   // coarser level (accumulated)
uniform sampler2D tHigh;  // this level (from the down chain)
uniform vec2 uTexel;      // texel of tLow
uniform float uMix;       // weight of the coarse level
uniform float uHighW;     // weight of this level
void main() {
  vec3 s = vec3(0.0);
  s += texture(tLow, vUv + vec2(-1.0, -1.0) * uTexel).rgb;
  s += texture(tLow, vUv + vec2( 0.0, -1.0) * uTexel).rgb * 2.0;
  s += texture(tLow, vUv + vec2( 1.0, -1.0) * uTexel).rgb;
  s += texture(tLow, vUv + vec2(-1.0,  0.0) * uTexel).rgb * 2.0;
  s += texture(tLow, vUv).rgb * 4.0;
  s += texture(tLow, vUv + vec2( 1.0,  0.0) * uTexel).rgb * 2.0;
  s += texture(tLow, vUv + vec2(-1.0,  1.0) * uTexel).rgb;
  s += texture(tLow, vUv + vec2( 0.0,  1.0) * uTexel).rgb * 2.0;
  s += texture(tLow, vUv + vec2( 1.0,  1.0) * uTexel).rgb;
  s /= 16.0;
  outColor = vec4(texture(tHigh, vUv).rgb * uHighW + s * uMix, 1.0);
}`;

const FINAL = /* glsl */ `
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tColor;
uniform sampler2D tBloom;
uniform float uBloom;
uniform float uExposure;
uniform float uVignette;
uniform float uGrain;
uniform float uSaturation;
uniform float uLift;
uniform float uAspect;
uniform uint uFrame;
uniform float uPxScale; // output height / 2160 — keeps grain size tied to the frame
vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
vec3 toSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float h01(uvec3 p) {
  uint h = pcg(p.x + pcg(p.y + pcg(p.z)));
  return float(h) / 4294967295.0;
}
void main() {
  vec3 c = texture(tColor, vUv).rgb + texture(tBloom, vUv).rgb * uBloom;
  c *= uExposure;
  c = aces(c);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = max(mix(vec3(l), c, uSaturation), 0.0);
  vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
  float v = 1.0 - uVignette * smoothstep(0.25, 1.05, length(q) * 1.15);
  c *= v;
  c = toSrgb(clamp(c, 0.0, 1.0));
  c = uLift + c * (1.0 - uLift);
  // grain: fixed function of (pixel, frame % 600), luma-weighted towards mid-tones
  uvec2 px = uvec2(gl_FragCoord.xy);
  float g = (h01(uvec3(px, uFrame)) + h01(uvec3(px + 7919u, uFrame + 613u)) - 1.0);
  float gl = dot(c, vec3(0.3333));
  c += g * uGrain * (0.55 + 0.9 * gl * (1.0 - gl) * 2.0);
  // triangular dither, +-1/255
  float d = h01(uvec3(px + 3301u, uFrame + 1777u)) - h01(uvec3(px + 9173u, uFrame + 4111u));
  c += d / 255.0;
  outColor = vec4(c, 1.0);
}`;

const makeMat = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VERT,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });

const rt = (w: number, h: number, opts: Partial<THREE.RenderTargetOptions> = {}) =>
  new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    generateMipmaps: false,
    ...opts,
  });

export class PostPipeline {
  private w = 0;
  private h = 0;
  private sceneRT!: THREE.WebGLRenderTarget;
  private preRT!: THREE.WebGLRenderTarget;
  private dofRT!: THREE.WebGLRenderTarget;
  private compRT!: THREE.WebGLRenderTarget;
  private down: THREE.WebGLRenderTarget[] = [];
  private up: THREE.WebGLRenderTarget[] = [];
  private bloomStart = 0;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: THREE.Mesh;
  private mPre = makeMat(PREFILTER, {
    tColor: { value: null }, tDepth: { value: null }, uSrcTexel: { value: new THREE.Vector2() },
    uHeightPx: { value: 1 }, uNear: { value: 0.1 }, uFar: { value: 100 }, uFocus: { value: 5 },
    uAperture: { value: 0 }, uMaxCoc: { value: 0 },
  });
  private mGather = makeMat(GATHER, {
    tPre: { value: null }, uTexel: { value: new THREE.Vector2() }, uMaxPx: { value: 1 },
    uNear: { value: 0.1 }, uFar: { value: 100 }, uFocus: { value: 5 }, uAperture: { value: 0 }, uMaxCoc: { value: 0 },
  });
  private mComp = makeMat(COMPOSITE, {
    tColor: { value: null }, tDepth: { value: null }, tDof: { value: null }, uHeightPx: { value: 1 },
    uNear: { value: 0.1 }, uFar: { value: 100 }, uFocus: { value: 5 }, uAperture: { value: 0 }, uMaxCoc: { value: 0 },
  });
  private mDown = makeMat(BLOOM_DOWN, {
    tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uPrefilter: { value: 0 },
    uThreshold: { value: 1 }, uKnee: { value: 0.5 },
  });
  private mUp = makeMat(BLOOM_UP, {
    tLow: { value: null }, tHigh: { value: null }, uTexel: { value: new THREE.Vector2() },
    uMix: { value: 1 }, uHighW: { value: 1 },
  });
  private mFinal = makeMat(FINAL, {
    tColor: { value: null }, tBloom: { value: null }, uBloom: { value: 0 }, uExposure: { value: 1 },
    uVignette: { value: 0 }, uGrain: { value: 0 }, uSaturation: { value: 1 }, uLift: { value: 0 },
    uAspect: { value: 16 / 9 }, uFrame: { value: 0 }, uPxScale: { value: 1 },
  });

  constructor() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.quad = new THREE.Mesh(g, this.mFinal);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  private setSize(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    this.dispose();
    this.w = w;
    this.h = h;
    const depthTexture = new THREE.DepthTexture(w, h, THREE.FloatType);
    depthTexture.format = THREE.DepthFormat;
    this.sceneRT = rt(w, h, { depthBuffer: true, depthTexture, samples: 4 });
    const hw = Math.ceil(w / 2);
    const hh = Math.ceil(h / 2);
    this.preRT = rt(hw, hh);
    this.dofRT = rt(hw, hh);
    this.compRT = rt(w, h);
    // Bloom: halve down to a few px. Accumulation starts at the level closest to
    // 360 px tall so the glow radius is the same fraction of the frame at any size.
    this.down = [];
    this.up = [];
    let lw = w;
    let lh = h;
    const levels: [number, number][] = [];
    while (lh > 6 && levels.length < 12) {
      lw = Math.ceil(lw / 2);
      lh = Math.ceil(lh / 2);
      levels.push([lw, lh]);
    }
    this.bloomStart = Math.max(0, Math.round(Math.log2(h / 360)) - 1);
    for (const [a, b] of levels) {
      this.down.push(rt(a, b));
      this.up.push(rt(a, b));
    }
  }

  dispose() {
    this.sceneRT?.depthTexture?.dispose();
    this.sceneRT?.dispose();
    this.preRT?.dispose();
    this.dofRT?.dispose();
    this.compRT?.dispose();
    this.down.forEach((r) => r.dispose());
    this.up.forEach((r) => r.dispose());
  }

  private pass(gl: THREE.WebGLRenderer, mat: THREE.Material, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    gl.setRenderTarget(target);
    gl.render(this.quadScene, this.quadCam);
  }

  render(
    gl: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    s: PostSettings,
    frame: number,
  ) {
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    const w = Math.round(size.x);
    const h = Math.round(size.y);
    this.setSize(w, h);
    gl.autoClear = true;
    gl.setRenderTarget(this.sceneRT);
    gl.clear(true, true, true);
    gl.render(scene, camera);

    const lens = { uNear: camera.near, uFar: camera.far, uFocus: s.focusDist, uAperture: s.aperture, uMaxCoc: s.maxCoc };
    const setLens = (m: THREE.RawShaderMaterial) => {
      for (const [k, v] of Object.entries(lens)) m.uniforms[k].value = v;
    };
    const hw = this.preRT.width;
    const hh = this.preRT.height;

    setLens(this.mPre);
    this.mPre.uniforms.tColor.value = this.sceneRT.texture;
    this.mPre.uniforms.tDepth.value = this.sceneRT.depthTexture;
    this.mPre.uniforms.uSrcTexel.value.set(1 / w, 1 / h);
    this.mPre.uniforms.uHeightPx.value = hh;
    this.pass(gl, this.mPre, this.preRT);

    setLens(this.mGather);
    this.mGather.uniforms.tPre.value = this.preRT.texture;
    this.mGather.uniforms.uTexel.value.set(1 / hw, 1 / hh);
    this.mGather.uniforms.uMaxPx.value = Math.max(1, s.maxCoc * hh);
    this.pass(gl, this.mGather, this.dofRT);

    setLens(this.mComp);
    this.mComp.uniforms.tColor.value = this.sceneRT.texture;
    this.mComp.uniforms.tDepth.value = this.sceneRT.depthTexture;
    this.mComp.uniforms.tDof.value = this.dofRT.texture;
    this.mComp.uniforms.uHeightPx.value = hh;
    this.pass(gl, this.mComp, this.compRT);

    // bloom down chain
    let src: THREE.WebGLRenderTarget = this.compRT;
    for (let i = 0; i < this.down.length; i++) {
      this.mDown.uniforms.tSrc.value = src.texture;
      this.mDown.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      this.mDown.uniforms.uPrefilter.value = i === 0 ? 1 : 0;
      this.mDown.uniforms.uThreshold.value = s.bloomThreshold;
      this.mDown.uniforms.uKnee.value = s.bloomKnee;
      this.pass(gl, this.mDown, this.down[i]);
      src = this.down[i];
    }
    // up chain, accumulating from the coarsest level to bloomStart
    const last = this.down.length - 1;
    let low = this.down[last];
    for (let i = last - 1; i >= this.bloomStart; i--) {
      this.mUp.uniforms.tLow.value = low.texture;
      this.mUp.uniforms.tHigh.value = this.down[i].texture;
      this.mUp.uniforms.uTexel.value.set(1 / low.width, 1 / low.height);
      this.mUp.uniforms.uMix.value = s.bloomSpread;
      this.mUp.uniforms.uHighW.value = 1;
      this.pass(gl, this.mUp, this.up[i]);
      low = this.up[i];
    }

    const f = this.mFinal.uniforms;
    f.tColor.value = this.compRT.texture;
    f.tBloom.value = low.texture;
    f.uBloom.value = s.bloomStrength;
    f.uExposure.value = s.exposure;
    f.uVignette.value = s.vignette;
    f.uGrain.value = s.grain;
    f.uSaturation.value = s.saturation;
    f.uLift.value = s.lift;
    f.uAspect.value = w / h;
    f.uFrame.value = ((frame % 600) + 600) % 600;
    f.uPxScale.value = h / 2160;
    this.pass(gl, this.mFinal, null);
  }
}
