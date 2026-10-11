import * as THREE from "three";
import { FullscreenPass, fullscreenMaterial, hdrTarget, HASH_GLSL } from "./gl";

// ---------------------------------------------------------------------------------------
// Deterministic mip-chain bloom + final grade (tone shoulder, vignette, grain, dither).
// Resolution independent: the chain starts from a fixed 540-line base, so the halo has the
// same shape relative to the frame at 720p, 4K and 6K.
// ---------------------------------------------------------------------------------------

const BLOOM_BASE_H = 540;
const BLOOM_LEVELS = 6;

const PREFILTER = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uSrcTexel;   // 1/src size
uniform float uRatio;     // src pixels per dst pixel
uniform float uThreshold;
uniform float uKnee;
in vec2 vUv;
out vec4 outColor;
void main() {
  // 4x4 bilinear taps spread over the destination footprint: a box filter that is
  // correct for any downscale ratio between 1 and ~8.
  vec3 acc = vec3(0.0);
  for (int j = 0; j < 4; j++) {
    for (int i = 0; i < 4; i++) {
      vec2 o = (vec2(float(i), float(j)) - 1.5) * 0.25 * uRatio * uSrcTexel;
      acc += texture(tSrc, vUv + o).rgb;
    }
  }
  vec3 c = acc / 16.0;
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-5);
  float w = max(soft, br - uThreshold) / max(br, 1e-5);
  outColor = vec4(c * w, 1.0);
}`;

const DOWN13 = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uSrcTexel;
in vec2 vUv;
out vec4 outColor;
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
  vec3 o = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  outColor = vec4(o, 1.0);
}`;

const UPTENT = /* glsl */ `
uniform sampler2D tSrc;   // smaller level
uniform sampler2D tBase;  // current level (same size as target)
uniform vec2 uSrcTexel;
uniform float uSpread;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec2 t = uSrcTexel * uSpread;
  vec3 s = texture(tSrc, vUv + vec2(-t.x, -t.y)).rgb
         + texture(tSrc, vUv + vec2( 0.0, -t.y)).rgb * 2.0
         + texture(tSrc, vUv + vec2( t.x, -t.y)).rgb
         + texture(tSrc, vUv + vec2(-t.x,  0.0)).rgb * 2.0
         + texture(tSrc, vUv).rgb * 4.0
         + texture(tSrc, vUv + vec2( t.x,  0.0)).rgb * 2.0
         + texture(tSrc, vUv + vec2(-t.x,  t.y)).rgb
         + texture(tSrc, vUv + vec2( 0.0,  t.y)).rgb * 2.0
         + texture(tSrc, vUv + vec2( t.x,  t.y)).rgb;
  outColor = vec4(texture(tBase, vUv).rgb + s / 16.0, 1.0);
}`;

const FINAL = /* glsl */ `
${HASH_GLSL}
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform float uBloom;
uniform float uBlurMix;     // mix toward the wide blur (a soft, defocused panel)
uniform vec3 uBg;           // linear background added under everything (gears)
uniform vec3 uHaze;         // linear haze colour (gears)
uniform vec2 uHazeOffset;   // haze drift (loops with the camera)
uniform float uHazeAmt;
uniform float uExposure;
uniform float uShoulder;    // linear value where the soft shoulder starts
uniform float uHuePreserve; // 1: compress by the max channel (keeps neon saturated)
uniform float uVignette;
uniform float uGrain;       // amplitude in sRGB units (0.015 = 1.5%)
uniform float uGrainFade;   // 1 = fade grain out below ~3% luminance
uniform int uFrame;         // frame % 600
uniform vec2 uRes;
in vec2 vUv;
out vec4 outColor;

float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  uvec2 ii = uvec2(ivec2(i) + 4096);
  float a = hash1(ii), b = hash1(ii + uvec2(1u, 0u));
  float c = hash1(ii + uvec2(0u, 1u)), d = hash1(ii + uvec2(1u, 1u));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

vec3 shoulder(vec3 c) {
  float k = uShoulder;
  vec3 over = max(c - k, 0.0);
  return min(c, vec3(k)) + (1.0 - k) * (1.0 - exp(-over / (1.0 - k)));
}
vec3 tonemap(vec3 c) {
  float mx = max(c.r, max(c.g, c.b));
  vec3 hp = c * (shoulder(vec3(mx)).r / max(mx, 1e-6));
  return mix(shoulder(c), hp, uHuePreserve);
}

float srgb(float x) {
  x = clamp(x, 0.0, 1.0);
  return x <= 0.0031308 ? 12.92 * x : 1.055 * pow(x, 1.0 / 2.4) - 0.055;
}

void main() {
  vec3 bl = texture(tBloom, vUv).rgb;
  vec3 c = mix(texture(tScene, vUv).rgb, bl / 6.0, uBlurMix) + bl * uBloom;
  // Haze: low-frequency field, part of the background (not bloomed).
  vec2 hp = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0) * 1.6 + uHazeOffset;
  float h = vnoise(hp) * 0.6 + vnoise(hp * 2.1 + 7.3) * 0.4;
  h = smoothstep(0.25, 0.85, h);
  c += uBg + uHaze * uHazeAmt * (0.15 + 0.85 * h);
  c *= uExposure;
  vec2 v = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  c *= 1.0 - uVignette * smoothstep(0.35, 1.15, length(v));
  c = tonemap(c);
  vec3 s = vec3(srgb(c.r), srgb(c.g), srgb(c.b));

  uvec2 px = uvec2(gl_FragCoord.xy);
  uint fr = uint(uFrame);
  float luma = dot(s, vec3(0.2126, 0.7152, 0.0722));
  float g = (hash1(uvec3(px, fr)) - 0.5) * 2.0 * uGrain;
  float fade = mix(1.0, smoothstep(0.012, 0.035, luma), uGrainFade);
  s += g * fade;
  // Triangular-PDF dither, +-1/255.
  float d = hash1(uvec3(px, fr + 7919u)) + hash1(uvec3(px + 31u, fr + 104729u)) - 1.0;
  s += d / 255.0;
  outColor = vec4(clamp(s, 0.0, 1.0), 1.0);
}`;

export type GradeOptions = {
  blurMix?: number;
  bloom: number;
  threshold: number;
  knee: number;
  exposure: number;
  shoulder: number;
  huePreserve?: number;
  vignette: number;
  grain: number;
  grainFade: boolean;
  bg?: THREE.Vector3;
  haze?: THREE.Vector3;
  hazeAmt?: number;
};

export class PostChain {
  private readonly pass = new FullscreenPass();
  private readonly levels: THREE.WebGLRenderTarget[] = [];
  private readonly ups: THREE.WebGLRenderTarget[] = [];
  private readonly prefilter: THREE.RawShaderMaterial;
  private readonly down: THREE.RawShaderMaterial;
  private readonly up: THREE.RawShaderMaterial;
  readonly final: THREE.RawShaderMaterial;

  constructor(
    w: number,
    h: number,
    private readonly opts: GradeOptions,
  ) {
    const aspect = w / h;
    let bh = Math.min(BLOOM_BASE_H, h);
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      const lh = Math.max(2, Math.round(bh));
      const lw = Math.max(2, Math.round(bh * aspect));
      this.levels.push(hdrTarget(lw, lh));
      this.ups.push(hdrTarget(lw, lh));
      bh /= 2;
    }
    this.prefilter = fullscreenMaterial(PREFILTER, {
      tSrc: { value: null },
      uSrcTexel: { value: new THREE.Vector2(1 / w, 1 / h) },
      uRatio: { value: h / this.levels[0].height },
      uThreshold: { value: opts.threshold },
      uKnee: { value: opts.knee },
    });
    this.down = fullscreenMaterial(DOWN13, {
      tSrc: { value: null },
      uSrcTexel: { value: new THREE.Vector2() },
    });
    this.up = fullscreenMaterial(UPTENT, {
      tSrc: { value: null },
      tBase: { value: null },
      uSrcTexel: { value: new THREE.Vector2() },
      uSpread: { value: 1.0 },
    });
    this.final = fullscreenMaterial(FINAL, {
      tScene: { value: null },
      tBloom: { value: null },
      uBloom: { value: opts.bloom },
      uBlurMix: { value: opts.blurMix ?? 0 },
      uBg: { value: opts.bg ?? new THREE.Vector3() },
      uHaze: { value: opts.haze ?? new THREE.Vector3() },
      uHazeOffset: { value: new THREE.Vector2() },
      uHazeAmt: { value: opts.hazeAmt ?? 0 },
      uExposure: { value: opts.exposure },
      uShoulder: { value: opts.shoulder },
      uHuePreserve: { value: opts.huePreserve ?? 0 },
      uVignette: { value: opts.vignette },
      uGrain: { value: opts.grain },
      uGrainFade: { value: opts.grainFade ? 1 : 0 },
      uFrame: { value: 0 },
      uRes: { value: new THREE.Vector2(w, h) },
    });
  }

  render(gl: THREE.WebGLRenderer, scene: THREE.Texture, frame: number, hazeOffset?: THREE.Vector2) {
    const L = this.levels;
    this.prefilter.uniforms.tSrc.value = scene;
    this.pass.render(gl, this.prefilter, L[0]);
    for (let i = 1; i < L.length; i++) {
      this.down.uniforms.tSrc.value = L[i - 1].texture;
      (this.down.uniforms.uSrcTexel.value as THREE.Vector2).set(1 / L[i - 1].width, 1 / L[i - 1].height);
      this.pass.render(gl, this.down, L[i]);
    }
    // Upsample: ups[n-1] = L[n-1]; ups[i] = L[i] + tent(ups[i+1])
    let src = L[L.length - 1];
    for (let i = L.length - 2; i >= 0; i--) {
      this.up.uniforms.tSrc.value = src.texture;
      this.up.uniforms.tBase.value = L[i].texture;
      (this.up.uniforms.uSrcTexel.value as THREE.Vector2).set(1 / src.width, 1 / src.height);
      this.pass.render(gl, this.up, this.ups[i]);
      src = this.ups[i];
    }
    const u = this.final.uniforms;
    u.tScene.value = scene;
    u.tBloom.value = this.ups[0].texture;
    u.uFrame.value = ((frame % 600) + 600) % 600;
    if (hazeOffset) (u.uHazeOffset.value as THREE.Vector2).copy(hazeOffset);
    this.pass.render(gl, this.final, null);
  }

  dispose() {
    [...this.levels, ...this.ups].forEach((t) => t.dispose());
    [this.prefilter, this.down, this.up, this.final].forEach((m) => m.dispose());
  }

  get options() {
    return this.opts;
  }
}
