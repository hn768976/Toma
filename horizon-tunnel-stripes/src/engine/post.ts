import * as THREE from "three";
import { ACES_GLSL, HASH_GLSL } from "./glsl";

// HDR post pipeline, written out by hand so every pass is a pure function of
// the scene and the frame number (no TAA, no temporal anything):
//
//   scene (HalfFloat, MSAA) -> [DOF] -> bloom mip chain -> composite
//   composite = exposure -> vignette -> ACES -> sRGB -> grain -> dither
//
// Bloom and DOF run at fixed working heights, so a 720p preview and a 4K
// master get the same glow spread and blur size relative to the frame.

export type DofSettings = {
  // View-space distance that is in focus.
  focus: number;
  // Distance over which blur ramps from 0 to max.
  range: number;
  // Max blur radius as a fraction of frame height.
  maxBlur: number;
  // Blur only things nearer than the focus distance.
  nearOnly?: boolean;
  // Extra blur multiplier for far side (default 1).
  farScale?: number;
};

export type PostSettings = {
  clearColor: string;
  exposure: number;
  bloomStrength: number;
  // 0..1, how much the wide mips contribute.
  bloomRadius: number;
  bloomThreshold: number;
  bloomKnee: number;
  // Additive grain amplitude in display space (0.02 = 2%).
  grain: number;
  // Shader dither +-1/255 after tonemapping.
  dither: boolean;
  // Keep pure black exactly 0,0,0 (no dither/grain on black).
  blackPreserve: boolean;
  // Grain is computed from frame % loopFrames so the loop closes.
  loopFrames: number;
  vignette: number;
  samples: number;
  dof?: DofSettings;
  // Radial zoom blur toward the frame centre (fraction of the distance to
  // the centre that one pixel is smeared over). 0 = off.
  radialBlur?: number;
};

const FULLSCREEN_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const BLOOM_BASE_HEIGHT = 360;
const BLOOM_LEVELS = 6;
const DOF_HEIGHT = 720;

const makeRT = (w: number, h: number, opts: THREE.RenderTargetOptions = {}) =>
  new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    generateMipmaps: false,
    ...opts,
  });

const pass = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });

// Box-filtered resample from a larger texture: kxk bilinear taps spread over
// the footprint of one destination texel, so thin bright lines don't alias.
const RESAMPLE_GLSL = /* glsl */ `
vec4 boxResample(sampler2D src, vec2 uv, vec2 srcTexel, vec2 ratio, int taps) {
  vec4 acc = vec4(0.0);
  float n = 0.0;
  for (int j = 0; j < 8; j++) {
    if (j >= taps) break;
    for (int i = 0; i < 8; i++) {
      if (i >= taps) break;
      vec2 o = (vec2(float(i), float(j)) + 0.5) / float(taps) - 0.5;
      acc += texture(src, uv + o * ratio * srcTexel);
      n += 1.0;
    }
  }
  return acc / n;
}
`;

const PREFILTER_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uSrcTexel;
uniform vec2 uRatio;
uniform int uTaps;
uniform float uThreshold;
uniform float uKnee;
in vec2 vUv;
${RESAMPLE_GLSL}
void main() {
  vec3 c = boxResample(tSrc, vUv, uSrcTexel, uRatio, uTaps).rgb;
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-5);
  float contrib = max(soft, br - uThreshold) / max(br, 1e-5);
  gl_FragColor = vec4(c * contrib, 1.0);
}
`;

// 13-tap downsample (Jimenez, "Next Generation Post Processing in CoD:AW").
const DOWN_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
in vec2 vUv;
void main() {
  vec2 t = uTexel;
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
  vec3 o = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  gl_FragColor = vec4(o, 1.0);
}
`;

// 9-tap tent upsample + add the current level.
const UP_FRAG = /* glsl */ `
uniform sampler2D tLow;
uniform sampler2D tCur;
uniform vec2 uTexel;
uniform float uRadius;
in vec2 vUv;
void main() {
  vec2 t = uTexel;
  vec3 s = texture(tLow, vUv).rgb * 4.0;
  s += (texture(tLow, vUv + t * vec2(-1.0, 0.0)).rgb + texture(tLow, vUv + t * vec2(1.0, 0.0)).rgb
      + texture(tLow, vUv + t * vec2(0.0, -1.0)).rgb + texture(tLow, vUv + t * vec2(0.0, 1.0)).rgb) * 2.0;
  s += texture(tLow, vUv + t * vec2(-1.0, -1.0)).rgb + texture(tLow, vUv + t * vec2(1.0, -1.0)).rgb
     + texture(tLow, vUv + t * vec2(-1.0, 1.0)).rgb + texture(tLow, vUv + t * vec2(1.0, 1.0)).rgb;
  s /= 16.0;
  gl_FragColor = vec4(texture(tCur, vUv).rgb + s * uRadius, 1.0);
}
`;

const COC_GLSL = /* glsl */ `
uniform float uNear;
uniform float uFar;
uniform float uFocus;
uniform float uRange;
uniform float uMaxBlurPx;
uniform float uNearOnly;
uniform float uFarScale;
float viewZ(float d) {
  float z = d * 2.0 - 1.0;
  return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
}
float cocPx(float d) {
  float z = viewZ(d);
  float s = (z - uFocus) / uRange;
  if (s > 0.0) s *= (1.0 - uNearOnly) * uFarScale;
  return clamp(abs(s), 0.0, 1.0) * uMaxBlurPx;
}
`;

// Downsample colour to the DOF working height, store circle of confusion
// (in working-height pixels, max over the footprint) in alpha.
const DOF_DOWN_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform sampler2D tDepth;
uniform vec2 uSrcTexel;
uniform vec2 uRatio;
uniform int uTaps;
in vec2 vUv;
${COC_GLSL}
${RESAMPLE_GLSL}
void main() {
  vec3 c = boxResample(tSrc, vUv, uSrcTexel, uRatio, uTaps).rgb;
  float coc = 0.0;
  for (int j = 0; j < 3; j++) for (int i = 0; i < 3; i++) {
    vec2 o = (vec2(float(i), float(j)) - 1.0) * 0.5 * uRatio * uSrcTexel;
    coc = max(coc, cocPx(texture(tDepth, vUv + o).r));
  }
  gl_FragColor = vec4(c, coc);
}
`;

// Scatter-as-gather bokeh: a sample contributes if its own blur radius
// reaches this pixel, so blurred foreground spreads over sharp background.
const DOF_GATHER_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uMaxBlurPx;
in vec2 vUv;
const int TAPS = 72;
void main() {
  vec4 center = texture(tSrc, vUv);
  vec3 acc = center.rgb;
  float wsum = 1.0;
  float cacc = center.a;
  float ga = 2.39996323;
  for (int i = 1; i < TAPS; i++) {
    float r = sqrt(float(i) / float(TAPS)) * uMaxBlurPx;
    float a = float(i) * ga;
    vec2 off = vec2(cos(a), sin(a)) * r;
    vec4 s = texture(tSrc, vUv + off * uTexel);
    float w = smoothstep(r - 1.0, r + 0.5, s.a) / max(s.a * s.a, 1.0);
    acc += s.rgb * w;
    cacc += s.a * w;
    wsum += w;
  }
  // Pixels that are themselves sharp keep the centre weight high.
  gl_FragColor = vec4(acc / wsum, cacc / wsum);
}
`;

const DOF_COMBINE_FRAG = /* glsl */ `
uniform sampler2D tSharp;
uniform sampler2D tBlur;
uniform sampler2D tDepth;
uniform float uScale;
in vec2 vUv;
${COC_GLSL}
void main() {
  vec4 b = texture(tBlur, vUv);
  float coc = max(cocPx(texture(tDepth, vUv).r), b.a);
  float f = smoothstep(0.35, 1.25, coc);
  vec3 s = texture(tSharp, vUv).rgb;
  gl_FragColor = vec4(mix(s, b.rgb, f), 1.0);
}
`;

const COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform sampler2D tBloom;
uniform vec2 uBloomTexel;
uniform float uBloomStrength;
uniform float uExposure;
uniform float uVignette;
uniform float uGrain;
uniform float uDither;
uniform float uBlackPreserve;
uniform uint uFrame;
uniform vec2 uRes;
uniform float uRadial;
in vec2 vUv;
${HASH_GLSL}
${ACES_GLSL}
void main() {
  vec3 c = texture(tSrc, vUv).rgb;
  if (uRadial > 0.0) {
    vec2 toC = vUv - 0.5;
    // strongest in the middle distance, fading at the centre and edges
    float w = smoothstep(0.02, 0.15, length(toC)) * smoothstep(0.7, 0.3, length(toC));
    vec3 acc = c;
    for (int i = 1; i < 10; i++) {
      acc += texture(tSrc, vUv - toC * uRadial * w * float(i) / 9.0).rgb;
    }
    c = acc / 10.0;
  }
  vec2 t = uBloomTexel;
  vec3 bl = texture(tBloom, vUv).rgb * 4.0;
  bl += (texture(tBloom, vUv + t * vec2(-0.5, 0.0)).rgb + texture(tBloom, vUv + t * vec2(0.5, 0.0)).rgb
       + texture(tBloom, vUv + t * vec2(0.0, -0.5)).rgb + texture(tBloom, vUv + t * vec2(0.0, 0.5)).rgb) * 2.0;
  bl += texture(tBloom, vUv + t * vec2(-0.5, -0.5)).rgb + texture(tBloom, vUv + t * vec2(0.5, -0.5)).rgb
      + texture(tBloom, vUv + t * vec2(-0.5, 0.5)).rgb + texture(tBloom, vUv + t * vec2(0.5, 0.5)).rgb;
  bl /= 16.0;
  c += bl * uBloomStrength;
  c *= uExposure;
  vec2 p = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  c *= 1.0 - uVignette * smoothstep(0.2, 1.2, dot(p, p));
  float lin = max(c.r, max(c.g, c.b));
  vec3 o = linearToSRGB(acesFilmic(c));
  float keep = mix(1.0, smoothstep(0.0, 0.004, lin), uBlackPreserve);
  uvec2 px = uvec2(gl_FragCoord.xy);
  vec3 n1 = hash3(uvec3(px, uFrame));
  vec3 n2 = hash3(uvec3(px, uFrame + 7919u));
  float lum = dot(o, vec3(0.2126, 0.7152, 0.0722));
  // Grain: monochrome, triangular, fixed function of pixel and frame.
  o += (n1.x + n1.y - 1.0) * uGrain * mix(0.6, 1.0, lum) * keep;
  // Dither: +-1/255 triangular, per channel.
  vec3 n3 = hash3(uvec3(px, uFrame + 15485u));
  o += (n2 - n3) / 255.0 * uDither * keep;
  gl_FragColor = vec4(clamp(o, 0.0, 1.0), 1.0);
}
`;

export class PostPipeline {
  settings: PostSettings;
  private fsScene = new THREE.Scene();
  private fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: THREE.Mesh;
  private rtScene: THREE.WebGLRenderTarget | null = null;
  private rtCombined: THREE.WebGLRenderTarget | null = null;
  private rtDofA: THREE.WebGLRenderTarget | null = null;
  private rtDofB: THREE.WebGLRenderTarget | null = null;
  private bloomDown: THREE.WebGLRenderTarget[] = [];
  private bloomUp: THREE.WebGLRenderTarget[] = [];
  private w = 0;
  private h = 0;
  private mPrefilter = pass(PREFILTER_FRAG, {
    tSrc: { value: null },
    uSrcTexel: { value: new THREE.Vector2() },
    uRatio: { value: new THREE.Vector2() },
    uTaps: { value: 2 },
    uThreshold: { value: 1 },
    uKnee: { value: 0.5 },
  });
  private mDown = pass(DOWN_FRAG, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
  private mUp = pass(UP_FRAG, {
    tLow: { value: null },
    tCur: { value: null },
    uTexel: { value: new THREE.Vector2() },
    uRadius: { value: 1 },
  });
  private cocUniforms = () => ({
    uNear: { value: 0.1 },
    uFar: { value: 100 },
    uFocus: { value: 10 },
    uRange: { value: 5 },
    uMaxBlurPx: { value: 10 },
    uNearOnly: { value: 0 },
    uFarScale: { value: 1 },
  });
  private mDofDown = pass(DOF_DOWN_FRAG, {
    tSrc: { value: null },
    tDepth: { value: null },
    uSrcTexel: { value: new THREE.Vector2() },
    uRatio: { value: new THREE.Vector2() },
    uTaps: { value: 1 },
    ...this.cocUniforms(),
  });
  private mDofGather = pass(DOF_GATHER_FRAG, {
    tSrc: { value: null },
    uTexel: { value: new THREE.Vector2() },
    uMaxBlurPx: { value: 10 },
  });
  private mDofCombine = pass(DOF_COMBINE_FRAG, {
    tSharp: { value: null },
    tBlur: { value: null },
    tDepth: { value: null },
    uScale: { value: 1 },
    ...this.cocUniforms(),
  });
  private mComposite = pass(COMPOSITE_FRAG, {
    tSrc: { value: null },
    tBloom: { value: null },
    uBloomTexel: { value: new THREE.Vector2() },
    uBloomStrength: { value: 1 },
    uExposure: { value: 1 },
    uVignette: { value: 0 },
    uGrain: { value: 0 },
    uDither: { value: 1 },
    uBlackPreserve: { value: 0 },
    uFrame: { value: 0 },
    uRes: { value: new THREE.Vector2() },
    uRadial: { value: 0 },
  });

  constructor(settings: PostSettings) {
    this.settings = settings;
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mComposite);
    this.quad.frustumCulled = false;
    this.fsScene.add(this.quad);
  }

  private resize(w: number, h: number, renderer: THREE.WebGLRenderer) {
    if (w === this.w && h === this.h && this.rtScene) return;
    this.dispose();
    this.w = w;
    this.h = h;
    const s = this.settings;
    const samples = Math.min(s.samples, renderer.capabilities.maxSamples);
    this.rtScene = makeRT(w, h, {
      depthBuffer: true,
      samples,
      depthTexture: s.dof ? new THREE.DepthTexture(w, h, THREE.UnsignedIntType) : null,
    });
    if (s.dof) {
      const dh = Math.min(h, DOF_HEIGHT);
      const dw = Math.round((w * dh) / h);
      this.rtDofA = makeRT(dw, dh);
      this.rtDofB = makeRT(dw, dh);
      this.rtCombined = makeRT(w, h);
    }
    let bh = Math.min(BLOOM_BASE_HEIGHT, Math.round(h / 2));
    let bw = Math.round((w * bh) / h);
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      this.bloomDown.push(makeRT(bw, bh));
      this.bloomUp.push(makeRT(bw, bh));
      bw = Math.max(1, Math.round(bw / 2));
      bh = Math.max(1, Math.round(bh / 2));
    }
  }

  private draw(renderer: THREE.WebGLRenderer, mat: THREE.Material, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    renderer.setRenderTarget(target);
    renderer.render(this.fsScene, this.fsCam);
  }

  private setCoc(m: THREE.ShaderMaterial, cam: THREE.PerspectiveCamera, maxBlurPx: number) {
    const d = this.settings.dof!;
    m.uniforms.uNear.value = cam.near;
    m.uniforms.uFar.value = cam.far;
    m.uniforms.uFocus.value = d.focus;
    m.uniforms.uRange.value = d.range;
    m.uniforms.uMaxBlurPx.value = maxBlurPx;
    m.uniforms.uNearOnly.value = d.nearOnly ? 1 : 0;
    m.uniforms.uFarScale.value = d.farScale ?? 1;
  }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, frame: number) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const w = size.x;
    const h = size.y;
    this.resize(w, h, renderer);
    const s = this.settings;

    renderer.setClearColor(new THREE.Color(s.clearColor), 1);
    renderer.setRenderTarget(this.rtScene);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);

    let src: THREE.Texture = this.rtScene!.texture;

    if (s.dof && this.rtDofA && this.rtDofB && this.rtCombined) {
      const dw = this.rtDofA.width;
      const dh = this.rtDofA.height;
      const maxBlurPx = s.dof.maxBlur * dh;
      const ratio = h / dh;
      const md = this.mDofDown;
      md.uniforms.tSrc.value = src;
      md.uniforms.tDepth.value = this.rtScene!.depthTexture;
      md.uniforms.uSrcTexel.value.set(1 / w, 1 / h);
      md.uniforms.uRatio.value.set(ratio, ratio);
      md.uniforms.uTaps.value = Math.max(1, Math.ceil(ratio));
      this.setCoc(md, camera, maxBlurPx);
      this.draw(renderer, md, this.rtDofA);

      const mg = this.mDofGather;
      mg.uniforms.tSrc.value = this.rtDofA.texture;
      mg.uniforms.uTexel.value.set(1 / dw, 1 / dh);
      mg.uniforms.uMaxBlurPx.value = maxBlurPx;
      this.draw(renderer, mg, this.rtDofB);

      const mc = this.mDofCombine;
      mc.uniforms.tSharp.value = src;
      mc.uniforms.tBlur.value = this.rtDofB.texture;
      mc.uniforms.tDepth.value = this.rtScene!.depthTexture;
      // CoC in DOF-working-height pixels, consistent with the gather alpha.
      this.setCoc(mc, camera, maxBlurPx);
      this.draw(renderer, mc, this.rtCombined);
      src = this.rtCombined.texture;
    }

    // Bloom.
    const b0 = this.bloomDown[0];
    const mp = this.mPrefilter;
    const ratio = h / b0.height;
    mp.uniforms.tSrc.value = src;
    mp.uniforms.uSrcTexel.value.set(1 / w, 1 / h);
    mp.uniforms.uRatio.value.set(w / b0.width, ratio);
    mp.uniforms.uTaps.value = Math.min(8, Math.max(2, Math.ceil(ratio)));
    mp.uniforms.uThreshold.value = s.bloomThreshold;
    mp.uniforms.uKnee.value = s.bloomKnee;
    this.draw(renderer, mp, b0);
    for (let i = 1; i < this.bloomDown.length; i++) {
      const prev = this.bloomDown[i - 1];
      this.mDown.uniforms.tSrc.value = prev.texture;
      this.mDown.uniforms.uTexel.value.set(1 / prev.width, 1 / prev.height);
      this.draw(renderer, this.mDown, this.bloomDown[i]);
    }
    const n = this.bloomDown.length;
    let low = this.bloomDown[n - 1];
    for (let i = n - 2; i >= 0; i--) {
      this.mUp.uniforms.tLow.value = low.texture;
      this.mUp.uniforms.tCur.value = this.bloomDown[i].texture;
      this.mUp.uniforms.uTexel.value.set(1 / low.width, 1 / low.height);
      this.mUp.uniforms.uRadius.value = s.bloomRadius;
      this.draw(renderer, this.mUp, this.bloomUp[i]);
      low = this.bloomUp[i];
    }

    const mcmp = this.mComposite;
    mcmp.uniforms.tSrc.value = src;
    mcmp.uniforms.tBloom.value = low.texture;
    mcmp.uniforms.uBloomTexel.value.set(1 / low.width, 1 / low.height);
    // Normalise so bloomStrength means roughly the same with any radius.
    mcmp.uniforms.uBloomStrength.value = s.bloomStrength / (1 + s.bloomRadius * (n - 1));
    mcmp.uniforms.uExposure.value = s.exposure;
    mcmp.uniforms.uVignette.value = s.vignette;
    mcmp.uniforms.uGrain.value = s.grain;
    mcmp.uniforms.uDither.value = s.dither ? 1 : 0;
    mcmp.uniforms.uBlackPreserve.value = s.blackPreserve ? 1 : 0;
    const loop = Math.max(1, s.loopFrames);
    mcmp.uniforms.uFrame.value = ((frame % loop) + loop) % loop;
    mcmp.uniforms.uRes.value.set(w, h);
    mcmp.uniforms.uRadial.value = s.radialBlur ?? 0;
    this.draw(renderer, mcmp, null);
  }

  dispose() {
    this.rtScene?.depthTexture?.dispose();
    this.rtScene?.dispose();
    this.rtCombined?.dispose();
    this.rtDofA?.dispose();
    this.rtDofB?.dispose();
    this.bloomDown.forEach((r) => r.dispose());
    this.bloomUp.forEach((r) => r.dispose());
    this.bloomDown = [];
    this.bloomUp = [];
    this.rtScene = null;
    this.rtCombined = null;
    this.rtDofA = null;
    this.rtDofB = null;
    this.w = 0;
    this.h = 0;
  }
}
