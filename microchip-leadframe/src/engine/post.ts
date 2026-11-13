import * as THREE from "three";

/**
 * HDR post-processing chain shared by every scene:
 *
 *   scene (RGBA16F, 4x MSAA, depth texture)
 *     -> half-res circle-of-confusion pack (rgb = colour, a = signed CoC)
 *     -> half-res bokeh depth of field (golden-angle scatter-as-gather)
 *     -> tent filter on the blur buffer
 *     -> combine with the full-resolution sharp image
 *     -> bloom (bright pass + two separable gaussian levels)
 *     -> grade (exposure, filmic tone map, tint, vignette, grain, sRGB)
 *
 * Every quantity that is a length on screen is expressed as a fraction of the
 * frame height, so a 1080p (`--scale=0.5`) render and a native 4K render of
 * the same composition look identical apart from resolution.
 */

export type PostParams = {
  /** View-space distance that is in perfect focus. */
  focus: number;
  /** Blur-disc radius (fraction of frame height) of a point at infinity. */
  aperture: number;
  /** Upper bound of the blur-disc radius (fraction of frame height). */
  maxCoc: number;
  /** Scales the blur of everything in front of the focus plane (1 = physical). */
  nearBlur: number;
  /** Extra blur-disc radius added to every pixel (fraction of frame height):
   *  takes the whole image out of focus, e.g. for a defocus transition. */
  defocus: number;
  bloomStrength: number;
  bloomThreshold: number;
  exposure: number;
  /** Multiplies the linear colour before tone mapping. */
  tint: THREE.Color;
  /** Linear colour added in the shadows. */
  lift: THREE.Color;
  contrast: number;
  saturation: number;
  vignette: number;
  vignetteColor: THREE.Color;
  grain: number;
  frame: number;
};

export const defaultPostParams = (): PostParams => ({
  focus: 5,
  aperture: 0.02,
  maxCoc: 0.03,
  nearBlur: 1,
  defocus: 0,
  bloomStrength: 0.2,
  bloomThreshold: 1,
  exposure: 1,
  tint: new THREE.Color(1, 1, 1),
  lift: new THREE.Color(0, 0, 0),
  contrast: 1,
  saturation: 1,
  vignette: 0.3,
  vignetteColor: new THREE.Color(0, 0, 0),
  grain: 0.015,
  frame: 0,
});

const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const COC_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uTexel; // one texel of the full-resolution scene
uniform float uNear;
uniform float uFar;
uniform float uFocus;
uniform float uAperture;
uniform float uMaxCoc;
uniform float uNearBlur;
uniform float uDefocus;

float cocAt(vec2 uv) {
  float d = texture2D(tDepth, uv).r;
  float ndc = d * 2.0 - 1.0;
  float z = (2.0 * uNear * uFar) / (uFar + uNear - ndc * (uFar - uNear));
  float c = uAperture * (z - uFocus) / max(z, 1e-4);
  if (c < 0.0) c *= uNearBlur;
  // global defocus keeps the sign (in front of / behind the focus plane)
  float s = c < 0.0 ? -1.0 : 1.0;
  c = s * sqrt(c * c + uDefocus * uDefocus);
  return clamp(c, -uMaxCoc, uMaxCoc);
}

void main() {
  // Half-resolution downsample: bilinear tap = 2x2 colour average; the
  // circle of confusion takes the nearest (most "foreground") of the four.
  vec3 color = texture2D(tColor, vUv).rgb;
  vec2 o = uTexel * 0.5;
  float c0 = cocAt(vUv + vec2(-o.x, -o.y));
  float c1 = cocAt(vUv + vec2( o.x, -o.y));
  float c2 = cocAt(vUv + vec2(-o.x,  o.y));
  float c3 = cocAt(vUv + vec2( o.x,  o.y));
  float coc = min(min(c0, c1), min(c2, c3));
  gl_FragColor = vec4(min(color, vec3(48.0)), coc);
}
`;

const DOF_TAPS = 96;

/**
 * Scatter-as-gather bokeh blur, evaluated at half resolution.
 * Output is premultiplied: rgb = blurred colour * coverage, a = coverage,
 * where coverage is the fraction of the pixel that is covered by blur discs
 * (its own, or those of out-of-focus neighbours in front of it).
 */
const DOF_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tColorCoc;
uniform vec2 uResolution; // of the half-resolution buffer
uniform float uMaxCoc;    // fraction of height
const float GOLDEN_ANGLE = 2.39996323;
const int TAPS = ${DOF_TAPS};
void main() {
  float H = uResolution.y;
  float maxR = max(uMaxCoc * H, 1.0);
  float fN = float(TAPS);
  float spacing = maxR * sqrt(3.14159265 / fN);
  float lodMax = clamp(log2(spacing) - 0.4, 0.0, 3.0);
  vec2 texel = 1.0 / uResolution;

  vec4 center = textureLod(tColorCoc, vUv, 0.0);
  float centerCoc = center.a * H;
  float centerSize = abs(centerCoc);

  // The pixel's own disc.
  float cw = smoothstep(0.2, 0.9, centerSize);
  float cLod = clamp(log2(max(centerSize, 1.0)) + 0.4, 0.0, lodMax);
  vec3 acc = textureLod(tColorCoc, vUv, cLod).rgb * cw;
  float wsum = cw;
  cw *= clamp(maxR * maxR / (fN * max(centerSize * centerSize, 0.25)), 0.0, 1.0);
  acc *= cw / max(wsum, 1e-5);
  wsum = cw;

  for (int i = 1; i <= TAPS; i++) {
    float fi = float(i);
    float radius = maxR * sqrt(fi / fN);
    float ang = fi * GOLDEN_ANGLE;
    vec2 tc = vUv + vec2(cos(ang), sin(ang)) * radius * texel;
    float sCoc = textureLod(tColorCoc, tc, 0.0).a * H;
    float sSize = abs(sCoc);
    // A tap that lies behind the centre pixel must not smear over it more
    // than the centre's own blur allows (keeps sharp foregrounds crisp).
    if (sCoc > centerCoc) {
      sSize = min(sSize, centerSize * 2.0);
    }
    float m = smoothstep(radius - 0.5 * spacing, radius + 0.5 * spacing, sSize);
    // Energy of one tap spread over its blur disc.
    float w = m * clamp(maxR * maxR / (fN * max(sSize * sSize, 0.25)), 0.0, 1.0);
    float lod = clamp(log2(max(sSize, 1.0)) - 1.0, 0.0, lodMax);
    acc += textureLod(tColorCoc, tc, lod).rgb * w;
    wsum += w;
  }
  float alpha = clamp(wsum, 0.0, 1.0);
  gl_FragColor = vec4(acc / max(wsum, 1e-5) * alpha, alpha);
}
`;

/**
 * Small tent filter over the premultiplied blur buffer. It removes the
 * residual sampling pattern of the gather without touching sharp areas
 * (their coverage is zero, so there is nothing to spread).
 */
const SMOOTH_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tBlur;
uniform vec2 uStep; // texel-space step
void main() {
  vec4 c = texture2D(tBlur, vUv) * 4.0;
  c += texture2D(tBlur, vUv + vec2( uStep.x, 0.0)) * 2.0;
  c += texture2D(tBlur, vUv + vec2(-uStep.x, 0.0)) * 2.0;
  c += texture2D(tBlur, vUv + vec2(0.0,  uStep.y)) * 2.0;
  c += texture2D(tBlur, vUv + vec2(0.0, -uStep.y)) * 2.0;
  c += texture2D(tBlur, vUv + vec2( uStep.x,  uStep.y));
  c += texture2D(tBlur, vUv + vec2(-uStep.x,  uStep.y));
  c += texture2D(tBlur, vUv + vec2( uStep.x, -uStep.y));
  c += texture2D(tBlur, vUv + vec2(-uStep.x, -uStep.y));
  gl_FragColor = c / 16.0;
}
`;

const COMBINE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tSharp;
uniform sampler2D tBlur;
void main() {
  vec3 sharp = min(texture2D(tSharp, vUv).rgb, vec3(48.0));
  vec4 blur = texture2D(tBlur, vUv);
  gl_FragColor = vec4(sharp * (1.0 - blur.a) + blur.rgb, 1.0);
}
`;

const BRIGHT_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor;
uniform vec2 uTexel;
uniform float uThreshold;
void main() {
  vec3 c = vec3(0.0);
  c += texture2D(tColor, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  c += texture2D(tColor, vUv + uTexel * vec2( 1.0, -1.0)).rgb;
  c += texture2D(tColor, vUv + uTexel * vec2(-1.0,  1.0)).rgb;
  c += texture2D(tColor, vUv + uTexel * vec2( 1.0,  1.0)).rgb;
  c *= 0.25;
  float l = max(c.r, max(c.g, c.b));
  float k = max(l - uThreshold, 0.0) / max(l, 1e-4);
  gl_FragColor = vec4(min(c * k, vec3(24.0)), 1.0);
}
`;

const BLUR_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor;
uniform vec2 uDir; // texel-space step
void main() {
  vec3 c = texture2D(tColor, vUv).rgb * 0.1016;
  float wsum = 0.1016;
  for (int i = 1; i <= 10; i++) {
    float x = float(i);
    float w = 0.1016 * exp(-x * x / 30.0);
    c += texture2D(tColor, vUv + uDir * x).rgb * w;
    c += texture2D(tColor, vUv - uDir * x).rgb * w;
    wsum += 2.0 * w;
  }
  gl_FragColor = vec4(c / wsum, 1.0);
}
`;

const FINAL_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor;
uniform sampler2D tBloomA;
uniform sampler2D tBloomB;
uniform float uBloom;
uniform float uExposure;
uniform vec3 uTint;
uniform vec3 uLift;
uniform float uContrast;
uniform float uSaturation;
uniform float uVignette;
uniform vec3 uVignetteColor;
uniform float uGrain;
uniform float uFrame;
uniform float uAspect;

float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

// Filmic curve (Narkowicz ACES fit).
vec3 filmic(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  vec3 c = texture2D(tColor, vUv).rgb;
  vec3 bloom = texture2D(tBloomA, vUv).rgb * 0.6 + texture2D(tBloomB, vUv).rgb * 0.4;
  c += bloom * uBloom;
  c *= uExposure * uTint;

  vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
  float v = smoothstep(0.25, 1.05, length(q));
  c = mix(c, c * uVignetteColor, v * uVignette);

  c = filmic(c);
  c += uLift * (1.0 - c);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSaturation);
  c = clamp((c - 0.5) * uContrast + 0.5, 0.0, 1.0);

  // linear -> sRGB
  c = mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));

  // Film grain on a virtual 1080p grid so 1080p and 4K renders match.
  vec2 g = floor(vUv * vec2(1920.0, 1080.0));
  float n = hash13(vec3(g, uFrame)) - 0.5;
  c += n * uGrain;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

const makeTarget = (
  w: number,
  h: number,
  opts: Partial<THREE.RenderTargetOptions> = {},
) =>
  new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
    colorSpace: THREE.LinearSRGBColorSpace,
    ...opts,
  });

export class PostPipeline {
  private renderer: THREE.WebGLRenderer;
  private w: number;
  private h: number;
  private sceneRT: THREE.WebGLRenderTarget;
  private cocRT: THREE.WebGLRenderTarget;
  private blurRT: THREE.WebGLRenderTarget;
  private blur2RT: THREE.WebGLRenderTarget;
  private dofRT: THREE.WebGLRenderTarget;
  private bloomA1: THREE.WebGLRenderTarget;
  private bloomA2: THREE.WebGLRenderTarget;
  private bloomB1: THREE.WebGLRenderTarget;
  private bloomB2: THREE.WebGLRenderTarget;
  private quad: THREE.Mesh;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private cocMat: THREE.ShaderMaterial;
  private dofMat: THREE.ShaderMaterial;
  private smoothMat: THREE.ShaderMaterial;
  private combineMat: THREE.ShaderMaterial;
  private brightMat: THREE.ShaderMaterial;
  private blurMat: THREE.ShaderMaterial;
  private finalMat: THREE.ShaderMaterial;

  constructor(renderer: THREE.WebGLRenderer, w: number, h: number) {
    this.renderer = renderer;
    this.w = w;
    this.h = h;

    const depthTexture = new THREE.DepthTexture(w, h);
    depthTexture.type = THREE.UnsignedIntType;
    depthTexture.minFilter = THREE.NearestFilter;
    depthTexture.magFilter = THREE.NearestFilter;
    this.sceneRT = makeTarget(w, h, {
      depthBuffer: true,
      depthTexture,
      samples: 4,
    });
    const hw = Math.max(2, Math.round(w / 2));
    const hh = Math.max(2, Math.round(h / 2));
    this.cocRT = makeTarget(hw, hh, {
      minFilter: THREE.LinearMipmapLinearFilter,
      generateMipmaps: true,
    });
    this.blurRT = makeTarget(hw, hh);
    this.blur2RT = makeTarget(hw, hh);
    this.dofRT = makeTarget(w, h);
    const bw = Math.max(2, Math.round(w / 4));
    const bh = Math.max(2, Math.round(h / 4));
    this.bloomA1 = makeTarget(bw, bh);
    this.bloomA2 = makeTarget(bw, bh);
    const cw = Math.max(2, Math.round(w / 16));
    const ch = Math.max(2, Math.round(h / 16));
    this.bloomB1 = makeTarget(cw, ch);
    this.bloomB2 = makeTarget(cw, ch);

    const mk = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
      new THREE.ShaderMaterial({
        vertexShader: FULLSCREEN_VERT,
        fragmentShader: frag,
        uniforms,
        depthTest: false,
        depthWrite: false,
      });

    this.cocMat = mk(COC_FRAG, {
      tColor: { value: null },
      tDepth: { value: null },
      uTexel: { value: new THREE.Vector2(1 / w, 1 / h) },
      uNear: { value: 0.1 },
      uFar: { value: 100 },
      uFocus: { value: 5 },
      uAperture: { value: 0.02 },
      uMaxCoc: { value: 0.03 },
      uNearBlur: { value: 1 },
      uDefocus: { value: 0 },
    });
    this.dofMat = mk(DOF_FRAG, {
      tColorCoc: { value: null },
      uResolution: { value: new THREE.Vector2(hw, hh) },
      uMaxCoc: { value: 0.03 },
    });
    this.smoothMat = mk(SMOOTH_FRAG, {
      tBlur: { value: null },
      uStep: { value: new THREE.Vector2(1 / hw, 1 / hh) },
    });
    this.combineMat = mk(COMBINE_FRAG, {
      tSharp: { value: null },
      tBlur: { value: null },
    });
    this.brightMat = mk(BRIGHT_FRAG, {
      tColor: { value: null },
      uTexel: { value: new THREE.Vector2(1 / w, 1 / h) },
      uThreshold: { value: 1 },
    });
    this.blurMat = mk(BLUR_FRAG, {
      tColor: { value: null },
      uDir: { value: new THREE.Vector2() },
    });
    this.finalMat = mk(FINAL_FRAG, {
      tColor: { value: null },
      tBloomA: { value: null },
      tBloomB: { value: null },
      uBloom: { value: 0.2 },
      uExposure: { value: 1 },
      uTint: { value: new THREE.Color(1, 1, 1) },
      uLift: { value: new THREE.Color(0, 0, 0) },
      uContrast: { value: 1 },
      uSaturation: { value: 1 },
      uVignette: { value: 0.3 },
      uVignetteColor: { value: new THREE.Color(0, 0, 0) },
      uGrain: { value: 0.015 },
      uFrame: { value: 0 },
      uAspect: { value: w / h },
    });

    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.cocMat);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  private pass(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCam);
  }

  render(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    p: PostParams,
    overlay?: { scene: THREE.Scene; camera: THREE.Camera },
  ) {
    const r = this.renderer;

    // 1. Scene
    r.setRenderTarget(this.sceneRT);
    r.setClearColor(0x000000, 1);
    r.clear();
    r.render(scene, camera);

    // 2. Circle of confusion
    this.cocMat.uniforms.tColor.value = this.sceneRT.texture;
    this.cocMat.uniforms.tDepth.value = this.sceneRT.depthTexture;
    this.cocMat.uniforms.uNear.value = camera.near;
    this.cocMat.uniforms.uFar.value = camera.far;
    this.cocMat.uniforms.uFocus.value = p.focus;
    this.cocMat.uniforms.uAperture.value = p.aperture;
    this.cocMat.uniforms.uMaxCoc.value = p.maxCoc;
    this.cocMat.uniforms.uNearBlur.value = p.nearBlur;
    this.cocMat.uniforms.uDefocus.value = p.defocus;
    this.pass(this.cocMat, this.cocRT);

    // 3. Depth of field
    this.dofMat.uniforms.tColorCoc.value = this.cocRT.texture;
    this.dofMat.uniforms.uMaxCoc.value = p.maxCoc;
    this.pass(this.dofMat, this.blurRT);
    // step = about half the tap spacing of the gather
    const spacing =
      Math.max(p.maxCoc * this.blurRT.height, 1) * Math.sqrt(Math.PI / DOF_TAPS);
    const step = Math.max(0.75, 0.55 * spacing);
    this.smoothMat.uniforms.tBlur.value = this.blurRT.texture;
    this.smoothMat.uniforms.uStep.value.set(step / this.blurRT.width, step / this.blurRT.height);
    this.pass(this.smoothMat, this.blur2RT);
    this.combineMat.uniforms.tSharp.value = this.sceneRT.texture;
    this.combineMat.uniforms.tBlur.value = this.blur2RT.texture;
    this.pass(this.combineMat, this.dofRT);

    // Optional screen-space overlay drawn on top of the focused image
    // (used for very-near foreground elements that are far outside the
    // gather radius of the depth-of-field pass).
    if (overlay) {
      r.autoClear = false;
      r.setRenderTarget(this.dofRT);
      r.render(overlay.scene, overlay.camera);
      r.autoClear = true;
    }

    // 4. Bloom
    this.brightMat.uniforms.tColor.value = this.dofRT.texture;
    this.brightMat.uniforms.uTexel.value.set(1 / this.w, 1 / this.h);
    this.brightMat.uniforms.uThreshold.value = p.bloomThreshold;
    this.pass(this.brightMat, this.bloomA1);
    const blur = (
      src: THREE.WebGLRenderTarget,
      tmp: THREE.WebGLRenderTarget,
      dst: THREE.WebGLRenderTarget,
      step: number,
    ) => {
      this.blurMat.uniforms.tColor.value = src.texture;
      this.blurMat.uniforms.uDir.value.set(step / tmp.width, 0);
      this.pass(this.blurMat, tmp);
      this.blurMat.uniforms.tColor.value = tmp.texture;
      this.blurMat.uniforms.uDir.value.set(0, step / dst.height);
      this.pass(this.blurMat, dst);
    };
    blur(this.bloomA1, this.bloomA2, this.bloomA1, 1);
    // Second, much wider level.
    this.brightMat.uniforms.tColor.value = this.bloomA1.texture;
    this.brightMat.uniforms.uTexel.value.set(
      1 / this.bloomA1.width,
      1 / this.bloomA1.height,
    );
    this.brightMat.uniforms.uThreshold.value = 0;
    this.pass(this.brightMat, this.bloomB1);
    blur(this.bloomB1, this.bloomB2, this.bloomB1, 1);

    // 5. Grade to screen
    const u = this.finalMat.uniforms;
    u.tColor.value = this.dofRT.texture;
    u.tBloomA.value = this.bloomA1.texture;
    u.tBloomB.value = this.bloomB1.texture;
    u.uBloom.value = p.bloomStrength;
    u.uExposure.value = p.exposure;
    u.uTint.value.copy(p.tint);
    u.uLift.value.copy(p.lift);
    u.uContrast.value = p.contrast;
    u.uSaturation.value = p.saturation;
    u.uVignette.value = p.vignette;
    u.uVignetteColor.value.copy(p.vignetteColor);
    u.uGrain.value = p.grain;
    u.uFrame.value = p.frame;
    this.pass(this.finalMat, null);
  }

  dispose() {
    for (const rt of [
      this.sceneRT,
      this.cocRT,
      this.blurRT,
      this.blur2RT,
      this.dofRT,
      this.bloomA1,
      this.bloomA2,
      this.bloomB1,
      this.bloomB2,
    ]) {
      rt.depthTexture?.dispose();
      rt.dispose();
    }
    for (const m of [
      this.cocMat,
      this.dofMat,
      this.smoothMat,
      this.combineMat,
      this.brightMat,
      this.blurMat,
      this.finalMat,
    ]) {
      m.dispose();
    }
    this.quad.geometry.dispose();
  }
}
