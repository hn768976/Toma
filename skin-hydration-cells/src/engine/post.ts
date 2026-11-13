import * as THREE from "three";

/**
 * Small cinematic post-processing chain (WebGL 2):
 *   scene (MSAA, HDR) -> half-res CoC -> bokeh gather -> tent filter
 *   -> bloom (bright pass + separable blur) -> composite (DoF mix, bloom,
 *   grade, vignette, film grain, dithering).
 * Every pass is a pure function of the inputs, so frames are deterministic.
 */

export type PostOptions = {
  /** Distance (world units, along view axis) that is perfectly sharp. */
  focus: number;
  /** Blur strength: CoC (fraction of frame height) = aperture * |z-focus| / z. */
  aperture: number;
  /** Maximum CoC radius as a fraction of frame height. */
  maxCoc?: number;
  bloomStrength?: number;
  bloomThreshold?: number;
  vignette?: number;
  grain?: number;
  /** Changes per frame so the grain is animated but deterministic. */
  seed?: number;
  exposure?: number;
  contrast?: number;
  saturation?: number;
  /** Multiplied with the final colour (white = no tint). */
  tint?: THREE.ColorRepresentation;
  /** ACES filmic tone mapping (default true). Disable for bright pastel scenes. */
  toneMap?: boolean;
  /** Colour added to shadows (lift). */
  lift?: THREE.ColorRepresentation;
};

const VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const COMMON = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform float uNear;
uniform float uFar;
uniform float uFocus;
uniform float uAperture;
uniform float uMaxCoc;
float viewZ(float d) {
  return (uNear * uFar) / ((uFar - uNear) * d - uFar); // negative
}
// signed CoC in fraction of frame height (negative = in front of focus)
float cocAt(float d) {
  float z = -viewZ(d);
  float c = uAperture * (z - uFocus) / max(z, 1e-4);
  return clamp(c, -uMaxCoc, uMaxCoc);
}`;

const FRAG_COC = /* glsl */ `
${COMMON}
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uTexel; // full-res texel
void main() {
  vec3 c = vec3(0.0);
  float coc = 0.0;
  float nearest = 1.0;
  for (int i = 0; i < 4; i++) {
    vec2 o = vec2(float(i & 1) - 0.5, float(i >> 1) - 0.5) * uTexel;
    c += min(texture(tColor, vUv + o).rgb, vec3(24.0));
    float d = texture(tDepth, vUv + o).r;
    if (d < nearest) { nearest = d; }
    coc += cocAt(d);
  }
  // Bias towards the nearest sample so foreground blur keeps its silhouette.
  float cn = cocAt(nearest);
  coc = cn < 0.0 ? cn : coc * 0.25;
  outColor = vec4(c * 0.25, coc);
}`;

const FRAG_BOKEH = /* glsl */ `
${COMMON}
uniform sampler2D tHalf; // rgb + signed coc
uniform vec2 uAspect;    // (height/width, 1)
#define TAPS 96
#define GOLDEN 2.39996323
void main() {
  vec4 c0 = texture(tHalf, vUv);
  float centerCoc = c0.a;
  float centerSize = abs(centerCoc);
  vec3 acc = c0.rgb;
  float tot = 1.0;
  float nearAcc = centerCoc < 0.0 ? centerSize : 0.0;
  float nearTot = 1.0;
  for (int i = 1; i <= TAPS; i++) {
    float fi = float(i);
    float r = sqrt(fi / float(TAPS)) * uMaxCoc;
    float a = fi * GOLDEN;
    vec2 uv = vUv + vec2(cos(a), sin(a)) * r * uAspect;
    vec4 s = texture(tHalf, uv);
    float sSize = abs(s.a);
    // Background samples must not leak over a sharper foreground pixel.
    if (s.a > centerCoc) { sSize = clamp(sSize, 0.0, centerSize * 2.0); }
    float m = smoothstep(r - uMaxCoc * 0.06, r + uMaxCoc * 0.06, sSize);
    acc += mix(acc / tot, s.rgb, m);
    tot += 1.0;
    if (s.a < 0.0) { nearAcc += m * abs(s.a); }
    nearTot += 1.0;
  }
  // alpha: how much blurred foreground covers this pixel (in CoC units)
  outColor = vec4(acc / tot, nearAcc / nearTot * 6.0);
}`;

const FRAG_TENT = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tSrc;
uniform vec2 uTexel;
void main() {
  vec4 a = vec4(0.0);
  a += texture(tSrc, vUv + uTexel * vec2(-1.0, -1.0));
  a += texture(tSrc, vUv + uTexel * vec2( 1.0, -1.0));
  a += texture(tSrc, vUv + uTexel * vec2(-1.0,  1.0));
  a += texture(tSrc, vUv + uTexel * vec2( 1.0,  1.0));
  a += texture(tSrc, vUv) * 2.0;
  a += texture(tSrc, vUv + uTexel * vec2( 2.0,  0.0)) * 0.5;
  a += texture(tSrc, vUv + uTexel * vec2(-2.0,  0.0)) * 0.5;
  a += texture(tSrc, vUv + uTexel * vec2( 0.0,  2.0)) * 0.5;
  a += texture(tSrc, vUv + uTexel * vec2( 0.0, -2.0)) * 0.5;
  outColor = a / 8.0;
}`;

const FRAG_BRIGHT = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tSrc;
uniform float uThreshold;
void main() {
  vec3 c = texture(tSrc, vUv).rgb;
  float l = max(c.r, max(c.g, c.b));
  float k = max(l - uThreshold, 0.0) / max(l, 1e-4);
  outColor = vec4(c * k, 1.0);
}`;

const FRAG_BLUR = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tSrc;
uniform vec2 uDir; // texel * direction * spread
void main() {
  vec3 c = texture(tSrc, vUv).rgb * 0.16;
  float w[6] = float[6](0.15, 0.12, 0.09, 0.06, 0.03, 0.01);
  float t = 0.16;
  for (int i = 0; i < 6; i++) {
    vec2 o = uDir * (float(i) * 1.5 + 1.25);
    c += (texture(tSrc, vUv + o).rgb + texture(tSrc, vUv - o).rgb) * w[i];
    t += 2.0 * w[i];
  }
  outColor = vec4(c / t, 1.0);
}`;

const FRAG_COMPOSITE = /* glsl */ `
${COMMON}
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tBlur;
uniform sampler2D tBloom;
uniform vec2 uResolution;
uniform float uBloom;
uniform float uVignette;
uniform float uGrain;
uniform float uSeed;
uniform float uExposure;
uniform float uContrast;
uniform float uSaturation;
uniform vec3 uTint;
uniform vec3 uLift;
uniform float uToneMap;
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
void main() {
  vec3 sharp = texture(tColor, vUv).rgb;
  float d = texture(tDepth, vUv).r;
  float coc = cocAt(d);
  vec4 blur = texture(tBlur, vUv);
  float px = abs(coc) * uResolution.y;          // CoC radius in output pixels
  float k = smoothstep(0.75, 3.0, px);
  float nearK = smoothstep(0.0, 1.0, blur.a * uResolution.y / 3.0);
  k = max(k, nearK);
  vec3 col = mix(sharp, blur.rgb, k);
  col += texture(tBloom, vUv).rgb * uBloom;
  col *= uExposure;
  if (uToneMap > 0.5) { col = aces(col); }
  // grade
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, uSaturation);
  col = (col - 0.5) * uContrast + 0.5;
  col = col * uTint + uLift * (1.0 - col);
  // vignette
  vec2 q = vUv - 0.5;
  q.x *= uResolution.x / uResolution.y * 0.72;
  float v = smoothstep(0.25, 0.95, length(q));
  col *= 1.0 - uVignette * v;
  // linear -> sRGB
  col = clamp(col, 0.0, 1.0);
  col = mix(col * 12.92, 1.055 * pow(col, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, col));
  // film grain (resolution independent: one grain cell = 1/1080 of the height)
  vec2 gp = floor(vUv * vec2(1920.0, 1080.0));
  float g = hash(gp + uSeed * 17.31) + hash(gp * 1.7 + uSeed * 5.13) - 1.0;
  col += g * uGrain;
  // dithering against banding in smooth gradients
  col += (hash(gl_FragCoord.xy + uSeed) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}`;

function makeMaterial(frag: string, uniforms: Record<string, THREE.IUniform>) {
  return new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: `in vec3 position;\nin vec2 uv;\n${VERT}`,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });
}

export class PostFX {
  private renderer: THREE.WebGLRenderer;
  private sceneRT: THREE.WebGLRenderTarget;
  private halfA: THREE.WebGLRenderTarget;
  private halfB: THREE.WebGLRenderTarget;
  private halfC: THREE.WebGLRenderTarget;
  private bloomA: THREE.WebGLRenderTarget;
  private bloomB: THREE.WebGLRenderTarget;
  private quad: THREE.Mesh;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private mCoc: THREE.RawShaderMaterial;
  private mBokeh: THREE.RawShaderMaterial;
  private mTent: THREE.RawShaderMaterial;
  private mBright: THREE.RawShaderMaterial;
  private mBlur: THREE.RawShaderMaterial;
  private mComp: THREE.RawShaderMaterial;

  constructor(renderer: THREE.WebGLRenderer, w: number, h: number) {
    this.renderer = renderer;
    const hw = Math.max(2, Math.round(w / 2));
    const hh = Math.max(2, Math.round(h / 2));
    const qw = Math.max(2, Math.round(w / 4));
    const qh = Math.max(2, Math.round(h / 4));

    const depthTexture = new THREE.DepthTexture(w, h);
    depthTexture.type = THREE.UnsignedIntType;
    depthTexture.minFilter = THREE.NearestFilter;
    depthTexture.magFilter = THREE.NearestFilter;
    this.sceneRT = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      depthTexture,
      samples: 4,
    });
    const mk = (tw: number, th: number) =>
      new THREE.WebGLRenderTarget(tw, th, {
        type: THREE.HalfFloatType,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
      });
    this.halfA = mk(hw, hh);
    this.halfB = mk(hw, hh);
    this.halfC = mk(hw, hh);
    this.bloomA = mk(qw, qh);
    this.bloomB = mk(qw, qh);

    const cam = () => ({
      uNear: { value: 0.1 },
      uFar: { value: 100 },
      uFocus: { value: 5 },
      uAperture: { value: 0 },
      uMaxCoc: { value: 0.03 },
    });
    this.mCoc = makeMaterial(FRAG_COC, {
      ...cam(),
      tColor: { value: this.sceneRT.texture },
      tDepth: { value: depthTexture },
      uTexel: { value: new THREE.Vector2(1 / w, 1 / h) },
    });
    this.mBokeh = makeMaterial(FRAG_BOKEH, {
      ...cam(),
      tHalf: { value: this.halfA.texture },
      uAspect: { value: new THREE.Vector2(h / w, 1) },
    });
    this.mTent = makeMaterial(FRAG_TENT, {
      tSrc: { value: this.halfB.texture },
      uTexel: { value: new THREE.Vector2(1 / hw, 1 / hh) },
    });
    this.mBright = makeMaterial(FRAG_BRIGHT, {
      tSrc: { value: this.halfC.texture },
      uThreshold: { value: 1 },
    });
    this.mBlur = makeMaterial(FRAG_BLUR, {
      tSrc: { value: null },
      uDir: { value: new THREE.Vector2() },
    });
    this.mComp = makeMaterial(FRAG_COMPOSITE, {
      ...cam(),
      tColor: { value: this.sceneRT.texture },
      tDepth: { value: depthTexture },
      tBlur: { value: this.halfC.texture },
      tBloom: { value: this.bloomA.texture },
      uResolution: { value: new THREE.Vector2(w, h) },
      uBloom: { value: 0 },
      uVignette: { value: 0 },
      uGrain: { value: 0 },
      uSeed: { value: 0 },
      uExposure: { value: 1 },
      uContrast: { value: 1 },
      uSaturation: { value: 1 },
      uTint: { value: new THREE.Color(1, 1, 1) },
      uLift: { value: new THREE.Color(0, 0, 0) },
      uToneMap: { value: 1 },
    });

    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mCoc);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  private pass(mat: THREE.Material, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCam);
  }

  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera, o: PostOptions) {
    const r = this.renderer;
    const prevTone = r.toneMapping;
    r.toneMapping = THREE.NoToneMapping;
    const maxCoc = o.maxCoc ?? 0.03;

    r.setRenderTarget(this.sceneRT);
    r.clear();
    r.render(scene, camera);

    for (const m of [this.mCoc, this.mBokeh, this.mComp]) {
      m.uniforms.uNear.value = camera.near;
      m.uniforms.uFar.value = camera.far;
      m.uniforms.uFocus.value = o.focus;
      m.uniforms.uAperture.value = o.aperture;
      m.uniforms.uMaxCoc.value = maxCoc;
    }
    this.pass(this.mCoc, this.halfA);
    this.pass(this.mBokeh, this.halfB);
    this.pass(this.mTent, this.halfC);

    // bloom
    const qw = this.bloomA.width;
    const qh = this.bloomA.height;
    this.mBright.uniforms.uThreshold.value = o.bloomThreshold ?? 0.9;
    this.pass(this.mBright, this.bloomA);
    const spread = qh / 270; // keep the glow size resolution independent
    for (let i = 0; i < 2; i++) {
      this.mBlur.uniforms.tSrc.value = this.bloomA.texture;
      this.mBlur.uniforms.uDir.value.set((spread * (1 + i * 1.5)) / qw, 0);
      this.pass(this.mBlur, this.bloomB);
      this.mBlur.uniforms.tSrc.value = this.bloomB.texture;
      this.mBlur.uniforms.uDir.value.set(0, (spread * (1 + i * 1.5)) / qh);
      this.pass(this.mBlur, this.bloomA);
    }

    const u = this.mComp.uniforms;
    u.uBloom.value = o.bloomStrength ?? 0;
    u.uVignette.value = o.vignette ?? 0;
    u.uGrain.value = o.grain ?? 0;
    u.uSeed.value = o.seed ?? 0;
    u.uExposure.value = o.exposure ?? 1;
    u.uContrast.value = o.contrast ?? 1;
    u.uSaturation.value = o.saturation ?? 1;
    u.uToneMap.value = (o.toneMap ?? true) ? 1 : 0;
    (u.uTint.value as THREE.Color).set(o.tint ?? 0xffffff);
    (u.uLift.value as THREE.Color).set(o.lift ?? 0x000000);
    // NOTE: tint/lift are applied in display-ish space after tone mapping.
    this.pass(this.mComp, null);
    r.toneMapping = prevTone;
  }

  dispose() {
    for (const t of [this.sceneRT, this.halfA, this.halfB, this.halfC, this.bloomA, this.bloomB]) t.dispose();
    for (const m of [this.mCoc, this.mBokeh, this.mTent, this.mBright, this.mBlur, this.mComp]) m.dispose();
    this.quad.geometry.dispose();
  }
}

/** Deterministic PRNG (mulberry32). Never use Math.random() in a render. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Smooth (Catmull-Rom) interpolation through keyframes [time, value...]. */
export function keys(t: number, k: number[][]): number[] {
  if (t <= k[0][0]) return k[0].slice(1);
  const last = k[k.length - 1];
  if (t >= last[0]) return last.slice(1);
  let i = 0;
  while (k[i + 1][0] < t) i++;
  const p0 = k[Math.max(0, i - 1)];
  const p1 = k[i];
  const p2 = k[i + 1];
  const p3 = k[Math.min(k.length - 1, i + 2)];
  const u = (t - p1[0]) / (p2[0] - p1[0]);
  const out: number[] = [];
  for (let c = 1; c < p1.length; c++) {
    // finite-difference tangents that respect uneven key spacing
    const m1 = i > 0 ? ((p2[c] - p0[c]) / (p2[0] - p0[0])) * (p2[0] - p1[0]) : p2[c] - p1[c];
    const m2 = i + 2 < k.length ? ((p3[c] - p1[c]) / (p3[0] - p1[0])) * (p2[0] - p1[0]) : p2[c] - p1[c];
    const u2 = u * u;
    const u3 = u2 * u;
    out.push(
      (2 * u3 - 3 * u2 + 1) * p1[c] + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * p2[c] + (u3 - u2) * m2,
    );
  }
  return out;
}
