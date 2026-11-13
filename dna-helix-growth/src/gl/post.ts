import * as THREE from "three";

/**
 * Small HDR post-processing chain shared by the scenes:
 *
 *   scene (MSAA, RGB = linear colour, A = view depth / far)
 *     -> half-res downsample
 *     -> gather depth of field (golden-spiral disc) + fill pass
 *     -> bloom pyramid
 *     -> composite: sharp/blur mix, bloom, background, vignette, grain, tone curve
 *
 * Everything is resolution independent: radii are expressed as fractions of the
 * frame height, so the 4K master and any smaller preview look the same.
 */

export type PostSettings = {
  /** Distance of the focal plane from the camera, world units. */
  focus: number;
  /** Blur strength. Circle of confusion (fraction of height) = aperture * |d - focus| / d */
  aperture: number;
  /** Largest circle-of-confusion radius, fraction of frame height. */
  maxCoc: number;
  bloomThreshold: number;
  bloomStrength: number;
  /** Background gradient added underneath the scene (linear colour). */
  bgInner: THREE.Color;
  bgOuter: THREE.Color;
  bgCenter: THREE.Vector2;
  vignette: number;
  grain: number;
  exposure: number;
  /** 0 = linear -> sRGB only, 1 = filmic shoulder. */
  filmic: number;
  /** Final colour multiplier (linear). */
  tint: THREE.Color;
  saturation: number;
};

const FS_VERT = /* glsl */ `
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const DOWN_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tSrc;
uniform vec2 uSrcTexel;
in vec2 vUv;
out vec4 o;
void main() {
  vec4 a = texture(tSrc, vUv + uSrcTexel * vec2(-0.5, -0.5));
  vec4 b = texture(tSrc, vUv + uSrcTexel * vec2( 0.5, -0.5));
  vec4 c = texture(tSrc, vUv + uSrcTexel * vec2(-0.5,  0.5));
  vec4 d = texture(tSrc, vUv + uSrcTexel * vec2( 0.5,  0.5));
  o = (a + b + c + d) * 0.25;
}`;

const DOF_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uFocus;
uniform float uAperture; // in pixels of this target
uniform float uMaxCoc;   // in pixels of this target
uniform float uFar;
in vec2 vUv;
out vec4 o;
#define RINGS 5
float cocAt(float depth01) {
  float d = max(depth01 * uFar, 1e-3);
  return clamp(uAperture * abs(d - uFocus) / d, 0.0, uMaxCoc);
}
void main() {
  vec4 c0 = texture(tSrc, vUv);
  float coc0 = cocAt(c0.a);
  vec3 acc = c0.rgb;
  float wsum = 1.0;
  float cocAcc = coc0;
  float spacing = uMaxCoc / float(RINGS);
  // concentric rings: 6, 12, 18 ... taps -> uniform density over the disc
  for (int ring = 1; ring <= RINGS; ring++) {
    float r = float(ring) * spacing;
    int n = ring * 6;
    float a0 = float(ring) * 0.61;
    for (int i = 0; i < n; i++) {
      float a = a0 + 6.28318530718 * float(i) / float(n);
      vec4 s = texture(tSrc, vUv + vec2(cos(a), sin(a)) * r * uTexel);
      float cs = cocAt(s.a);
      // A sample behind the centre pixel must not smear over it more than the
      // centre itself is blurred (keeps in-focus edges crisp).
      if (s.a > c0.a) cs = min(cs, coc0);
      float w = smoothstep(r - spacing, r, cs);
      acc += s.rgb * w;
      wsum += w;
      cocAcc += cs * w;
    }
  }
  o = vec4(acc / wsum, cocAcc / wsum);
}`;

// Second pass: a small dense disc that fills the gaps between the taps of the
// first pass, so thin bright lines blur into smooth bokeh instead of copies.
const FILL_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uMaxCoc;
in vec2 vUv;
out vec4 o;
#define RINGS 3
void main() {
  vec4 c0 = texture(tSrc, vUv);
  // radius of the gaps left by pass one, faded out for nearly sharp pixels
  float radius = (uMaxCoc / 5.0) * 0.62 * smoothstep(0.5, uMaxCoc * 0.25, c0.a);
  vec4 acc = c0;
  float wsum = 1.0;
  float spacing = radius / float(RINGS);
  for (int ring = 1; ring <= RINGS; ring++) {
    float r = float(ring) * spacing;
    int n = ring * 6;
    float a0 = float(ring) * 0.37 + 0.2;
    for (int i = 0; i < n; i++) {
      float a = a0 + 6.28318530718 * float(i) / float(n);
      vec4 s = texture(tSrc, vUv + vec2(cos(a), sin(a)) * r * uTexel);
      // do not pull in-focus neighbours into a blurred pixel
      float w = smoothstep(0.25, 0.6, s.a / max(c0.a, 1e-3));
      acc += s * w;
      wsum += w;
    }
  }
  o = acc / wsum;
}`;

const BRIGHT_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tSrc;
uniform vec2 uSrcTexel;
uniform float uThreshold;
in vec2 vUv;
out vec4 o;
vec3 bright(vec2 uv) {
  vec3 c = texture(tSrc, uv).rgb;
  float l = max(c.r, max(c.g, c.b));
  return c * max(l - uThreshold, 0.0) / max(l, 1e-4);
}
void main() {
  vec3 c = bright(vUv + uSrcTexel * vec2(-0.5, -0.5)) + bright(vUv + uSrcTexel * vec2(0.5, -0.5))
         + bright(vUv + uSrcTexel * vec2(-0.5, 0.5)) + bright(vUv + uSrcTexel * vec2(0.5, 0.5));
  o = vec4(c * 0.25, 1.0);
}`;

const BLUR_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tSrc;
uniform vec2 uDir; // texel * direction
in vec2 vUv;
out vec4 o;
void main() {
  vec3 c = texture(tSrc, vUv).rgb * 0.2270270270;
  c += (texture(tSrc, vUv + uDir * 1.3846153846).rgb + texture(tSrc, vUv - uDir * 1.3846153846).rgb) * 0.3162162162;
  c += (texture(tSrc, vUv + uDir * 3.2307692308).rgb + texture(tSrc, vUv - uDir * 3.2307692308).rgb) * 0.0702702703;
  o = vec4(c, 1.0);
}`;

const COMPOSITE_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tSharp;
uniform sampler2D tBlur;
uniform sampler2D tBloom0;
uniform sampler2D tBloom1;
uniform sampler2D tBloom2;
uniform sampler2D tBloom3;
uniform float uFocus;
uniform float uAperture; // half-res pixels
uniform float uMaxCoc;
uniform float uFar;
uniform float uBloom;
uniform vec3 uBgInner;
uniform vec3 uBgOuter;
uniform vec2 uBgCenter;
uniform float uVignette;
uniform float uGrain;
uniform float uExposure;
uniform float uFilmic;
uniform vec3 uTint;
uniform float uSaturation;
uniform float uSeed;
uniform float uAspect;
uniform vec2 uResolution;
in vec2 vUv;
out vec4 o;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 toSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  vec4 sharp = texture(tSharp, vUv);
  vec4 blur = texture(tBlur, vUv);
  float d = max(sharp.a * uFar, 1e-3);
  float cocOwn = clamp(uAperture * abs(d - uFocus) / d, 0.0, uMaxCoc);
  float f = smoothstep(0.35, 1.6, max(cocOwn, blur.a));
  vec3 col = mix(sharp.rgb, blur.rgb, f);

  vec3 bloom = texture(tBloom0, vUv).rgb * 0.5 + texture(tBloom1, vUv).rgb * 0.7
             + texture(tBloom2, vUv).rgb * 0.9 + texture(tBloom3, vUv).rgb * 1.1;
  col += bloom * uBloom;

  vec2 q = (vUv - uBgCenter) * vec2(uAspect, 1.0);
  col += mix(uBgInner, uBgOuter, smoothstep(0.0, 1.1, length(q)));

  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
  col *= 1.0 - uVignette * smoothstep(0.35, 1.15, length(p));

  col *= uExposure * uTint;
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = max(mix(vec3(l), col, uSaturation), 0.0);
  vec3 film = col * (1.0 + col * 0.12) / (1.0 + col * 0.72);
  film = mix(col, film * 1.52, uFilmic);
  vec3 outc = toSrgb(film);

  // Fixed-size, frame-varying grain (resolution independent: 1 cell = 1/1080 of height)
  vec2 gp = floor(vUv * vec2(uAspect, 1.0) * 1080.0);
  float g = hash12(gp + uSeed * 17.31) + hash12(gp * 1.7 + uSeed * 5.13) - 1.0;
  outc += g * uGrain;
  o = vec4(clamp(outc, 0.0, 1.0), 1.0);
}`;

const makeTarget = (w: number, h: number, type: THREE.TextureDataType) => {
  const rt = new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });
  rt.texture.wrapS = THREE.ClampToEdgeWrapping;
  rt.texture.wrapT = THREE.ClampToEdgeWrapping;
  return rt;
};

const makeMaterial = (
  fragmentShader: string,
  uniforms: Record<string, THREE.IUniform>,
) =>
  new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: FS_VERT,
    fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });

export class PostPipeline {
  readonly sceneTarget: THREE.WebGLRenderTarget;
  readonly far: number;
  private renderer: THREE.WebGLRenderer;
  private w: number;
  private h: number;
  private hw: number;
  private hh: number;
  private half: THREE.WebGLRenderTarget;
  private dofA: THREE.WebGLRenderTarget;
  private dofB: THREE.WebGLRenderTarget;
  private bloomA: THREE.WebGLRenderTarget[] = [];
  private bloomB: THREE.WebGLRenderTarget[] = [];
  private quad: THREE.Mesh;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private mDown: THREE.RawShaderMaterial;
  private mDof: THREE.RawShaderMaterial;
  private mFill: THREE.RawShaderMaterial;
  private mBright: THREE.RawShaderMaterial;
  private mBlur: THREE.RawShaderMaterial;
  private mComp: THREE.RawShaderMaterial;

  constructor(
    renderer: THREE.WebGLRenderer,
    width: number,
    height: number,
    far: number,
  ) {
    this.renderer = renderer;
    this.w = width;
    this.h = height;
    this.far = far;
    this.hw = Math.round(width / 2);
    this.hh = Math.round(height / 2);
    const type = THREE.HalfFloatType;

    this.sceneTarget = new THREE.WebGLRenderTarget(width, height, {
      type,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
      samples: 4,
      generateMipmaps: false,
    });
    this.half = makeTarget(this.hw, this.hh, type);
    this.dofA = makeTarget(this.hw, this.hh, type);
    this.dofB = makeTarget(this.hw, this.hh, type);
    for (let i = 0; i < 4; i++) {
      const s = 4 * Math.pow(2, i);
      this.bloomA.push(makeTarget(Math.round(width / s), Math.round(height / s), type));
      this.bloomB.push(makeTarget(Math.round(width / s), Math.round(height / s), type));
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
    );
    this.mDown = makeMaterial(DOWN_FRAG, {
      tSrc: { value: null },
      uSrcTexel: { value: new THREE.Vector2() },
    });
    this.mDof = makeMaterial(DOF_FRAG, {
      tSrc: { value: null },
      uTexel: { value: new THREE.Vector2(1 / this.hw, 1 / this.hh) },
      uFocus: { value: 10 },
      uAperture: { value: 0 },
      uMaxCoc: { value: 1 },
      uFar: { value: far },
    });
    this.mFill = makeMaterial(FILL_FRAG, {
      tSrc: { value: null },
      uMaxCoc: { value: 1 },
      uTexel: { value: new THREE.Vector2(1 / this.hw, 1 / this.hh) },
    });
    this.mBright = makeMaterial(BRIGHT_FRAG, {
      tSrc: { value: null },
      uSrcTexel: { value: new THREE.Vector2(1 / this.hw, 1 / this.hh) },
      uThreshold: { value: 1 },
    });
    this.mBlur = makeMaterial(BLUR_FRAG, {
      tSrc: { value: null },
      uDir: { value: new THREE.Vector2() },
    });
    this.mComp = makeMaterial(COMPOSITE_FRAG, {
      tSharp: { value: null },
      tBlur: { value: null },
      tBloom0: { value: null },
      tBloom1: { value: null },
      tBloom2: { value: null },
      tBloom3: { value: null },
      uFocus: { value: 10 },
      uAperture: { value: 0 },
      uMaxCoc: { value: 1 },
      uFar: { value: far },
      uBloom: { value: 0 },
      uBgInner: { value: new THREE.Color(0, 0, 0) },
      uBgOuter: { value: new THREE.Color(0, 0, 0) },
      uBgCenter: { value: new THREE.Vector2(0.5, 0.5) },
      uVignette: { value: 0 },
      uGrain: { value: 0 },
      uExposure: { value: 1 },
      uFilmic: { value: 1 },
      uTint: { value: new THREE.Color(1, 1, 1) },
      uSaturation: { value: 1 },
      uSeed: { value: 0 },
      uAspect: { value: width / height },
      uResolution: { value: new THREE.Vector2(width, height) },
    });
    this.quad = new THREE.Mesh(geo, this.mDown);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  private pass(material: THREE.Material, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCam);
  }

  /** Call after the scene has been rendered into `sceneTarget`. */
  render(settings: PostSettings, frame: number) {
    const { hh } = this;
    const aperturePx = settings.aperture * hh;
    const maxCocPx = settings.maxCoc * hh;

    this.mDown.uniforms.tSrc.value = this.sceneTarget.texture;
    this.mDown.uniforms.uSrcTexel.value.set(1 / this.w, 1 / this.h);
    this.pass(this.mDown, this.half);

    const d = this.mDof.uniforms;
    d.tSrc.value = this.half.texture;
    d.uFocus.value = settings.focus;
    d.uAperture.value = aperturePx;
    d.uMaxCoc.value = maxCocPx;
    this.pass(this.mDof, this.dofA);

    this.mFill.uniforms.tSrc.value = this.dofA.texture;
    this.mFill.uniforms.uMaxCoc.value = maxCocPx;
    this.pass(this.mFill, this.dofB);

    // bloom pyramid
    this.mBright.uniforms.tSrc.value = this.dofB.texture;
    this.mBright.uniforms.uThreshold.value = settings.bloomThreshold;
    this.pass(this.mBright, this.bloomB[0]);
    for (let i = 0; i < 4; i++) {
      const a = this.bloomA[i];
      const b = this.bloomB[i];
      if (i > 0) {
        this.mDown.uniforms.tSrc.value = this.bloomB[i - 1].texture;
        this.mDown.uniforms.uSrcTexel.value.set(
          1 / this.bloomB[i - 1].width,
          1 / this.bloomB[i - 1].height,
        );
        this.pass(this.mDown, b);
      }
      this.mBlur.uniforms.tSrc.value = b.texture;
      this.mBlur.uniforms.uDir.value.set(1 / a.width, 0);
      this.pass(this.mBlur, a);
      this.mBlur.uniforms.tSrc.value = a.texture;
      this.mBlur.uniforms.uDir.value.set(0, 1 / a.height);
      this.pass(this.mBlur, b);
    }

    const c = this.mComp.uniforms;
    c.tSharp.value = this.sceneTarget.texture;
    c.tBlur.value = this.dofB.texture;
    c.tBloom0.value = this.bloomB[0].texture;
    c.tBloom1.value = this.bloomB[1].texture;
    c.tBloom2.value = this.bloomB[2].texture;
    c.tBloom3.value = this.bloomB[3].texture;
    c.uFocus.value = settings.focus;
    c.uAperture.value = aperturePx;
    c.uMaxCoc.value = maxCocPx;
    c.uBloom.value = settings.bloomStrength;
    c.uBgInner.value.copy(settings.bgInner);
    c.uBgOuter.value.copy(settings.bgOuter);
    c.uBgCenter.value.copy(settings.bgCenter);
    c.uVignette.value = settings.vignette;
    c.uGrain.value = settings.grain;
    c.uExposure.value = settings.exposure;
    c.uFilmic.value = settings.filmic;
    c.uTint.value.copy(settings.tint);
    c.uSaturation.value = settings.saturation;
    c.uSeed.value = frame % 997;
    this.pass(this.mComp, null);
  }

  dispose() {
    [this.sceneTarget, this.half, this.dofA, this.dofB, ...this.bloomA, ...this.bloomB].forEach(
      (t) => t.dispose(),
    );
    [this.mDown, this.mDof, this.mFill, this.mBright, this.mBlur, this.mComp].forEach((m) =>
      m.dispose(),
    );
    this.quad.geometry.dispose();
  }
}
