import * as THREE from "three";
import { Pass, makeRT } from "./pass";

// Dual-filter bloom pyramid: a soft-threshold, Karis-averaged 13-tap
// downsample chain and a tent-filter upsample chain. Fixed taps, no
// temporal accumulation, so every frame is reproducible.

const DOWN = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 texel;       // 1 / source size
uniform float threshold;  // soft knee start (linear)
uniform float knee;
uniform float firstPass;  // 1.0 on the first level (applies threshold + Karis)
varying vec2 vUv;
vec3 prefilter(vec3 c) {
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - threshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 1e-5);
  float contrib = max(soft, br - threshold) / max(br, 1e-5);
  return c * contrib;
}
vec3 fetch(vec2 uv) {
  vec3 c = texture2D(tSrc, uv).rgb;
  return c;
}
void main() {
  vec2 t = texel;
  vec3 a = fetch(vUv + t * vec2(-2.0,  2.0));
  vec3 b = fetch(vUv + t * vec2( 0.0,  2.0));
  vec3 c = fetch(vUv + t * vec2( 2.0,  2.0));
  vec3 d = fetch(vUv + t * vec2(-2.0,  0.0));
  vec3 e = fetch(vUv);
  vec3 f = fetch(vUv + t * vec2( 2.0,  0.0));
  vec3 g = fetch(vUv + t * vec2(-2.0, -2.0));
  vec3 h = fetch(vUv + t * vec2( 0.0, -2.0));
  vec3 i = fetch(vUv + t * vec2( 2.0, -2.0));
  vec3 j = fetch(vUv + t * vec2(-1.0,  1.0));
  vec3 k = fetch(vUv + t * vec2( 1.0,  1.0));
  vec3 l = fetch(vUv + t * vec2(-1.0, -1.0));
  vec3 m = fetch(vUv + t * vec2( 1.0, -1.0));
  vec3 outc;
  if (firstPass > 0.5) {
    // Karis average over the 4 corner groups to suppress fireflies.
    vec3 g0 = (a + b + d + e) * 0.25;
    vec3 g1 = (b + c + e + f) * 0.25;
    vec3 g2 = (d + e + g + h) * 0.25;
    vec3 g3 = (e + f + h + i) * 0.25;
    vec3 g4 = (j + k + l + m) * 0.25;
    float w0 = 1.0 / (1.0 + dot(g0, vec3(0.2126, 0.7152, 0.0722)));
    float w1 = 1.0 / (1.0 + dot(g1, vec3(0.2126, 0.7152, 0.0722)));
    float w2 = 1.0 / (1.0 + dot(g2, vec3(0.2126, 0.7152, 0.0722)));
    float w3 = 1.0 / (1.0 + dot(g3, vec3(0.2126, 0.7152, 0.0722)));
    float w4 = 1.0 / (1.0 + dot(g4, vec3(0.2126, 0.7152, 0.0722)));
    outc = (g0 * w0 * 0.125 + g1 * w1 * 0.125 + g2 * w2 * 0.125 + g3 * w3 * 0.125 + g4 * w4 * 0.5)
         / (w0 * 0.125 + w1 * 0.125 + w2 * 0.125 + w3 * 0.125 + w4 * 0.5);
    outc = prefilter(outc);
  } else {
    outc = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  }
  gl_FragColor = vec4(outc, 1.0);
}`;

const UP = /* glsl */ `
uniform sampler2D tLow;   // smaller level
uniform sampler2D tHigh;  // same-size level to add to
uniform vec2 texel;       // 1 / low size
uniform float mixHigh;
varying vec2 vUv;
void main() {
  vec2 t = texel;
  vec3 s = texture2D(tLow, vUv + t * vec2(-1.0,  1.0)).rgb * 1.0
         + texture2D(tLow, vUv + t * vec2( 0.0,  1.0)).rgb * 2.0
         + texture2D(tLow, vUv + t * vec2( 1.0,  1.0)).rgb * 1.0
         + texture2D(tLow, vUv + t * vec2(-1.0,  0.0)).rgb * 2.0
         + texture2D(tLow, vUv).rgb * 4.0
         + texture2D(tLow, vUv + t * vec2( 1.0,  0.0)).rgb * 2.0
         + texture2D(tLow, vUv + t * vec2(-1.0, -1.0)).rgb * 1.0
         + texture2D(tLow, vUv + t * vec2( 0.0, -1.0)).rgb * 2.0
         + texture2D(tLow, vUv + t * vec2( 1.0, -1.0)).rgb * 1.0;
  s /= 16.0;
  vec3 hi = texture2D(tHigh, vUv).rgb;
  gl_FragColor = vec4(hi * mixHigh + s, 1.0);
}`;

export class Bloom {
  private readonly down: THREE.WebGLRenderTarget[] = [];
  private readonly up: THREE.WebGLRenderTarget[] = [];
  private readonly downPass: Pass;
  private readonly upPass: Pass;
  readonly levels: number;

  constructor(w: number, h: number, levels = 6) {
    this.levels = levels;
    let lw = Math.max(1, w >> 1);
    let lh = Math.max(1, h >> 1);
    for (let i = 0; i < levels; i++) {
      this.down.push(makeRT(lw, lh));
      this.up.push(makeRT(lw, lh));
      lw = Math.max(1, lw >> 1);
      lh = Math.max(1, lh >> 1);
    }
    this.downPass = new Pass(DOWN, {
      tSrc: { value: null },
      texel: { value: new THREE.Vector2() },
      threshold: { value: 0.8 },
      knee: { value: 0.5 },
      firstPass: { value: 1 },
    });
    this.upPass = new Pass(UP, {
      tLow: { value: null },
      tHigh: { value: null },
      texel: { value: new THREE.Vector2() },
      mixHigh: { value: 1 },
    });
  }

  /** Returns the bloom texture (all levels summed at half resolution). */
  render(gl: THREE.WebGLRenderer, src: THREE.Texture, srcW: number, srcH: number, threshold: number, knee = 0.6): THREE.Texture {
    const dp = this.downPass.material.uniforms;
    dp.threshold.value = threshold;
    dp.knee.value = knee;
    let tex: THREE.Texture = src;
    let tw = srcW;
    let th = srcH;
    for (let i = 0; i < this.levels; i++) {
      dp.tSrc.value = tex;
      dp.texel.value.set(1 / tw, 1 / th);
      dp.firstPass.value = i === 0 ? 1 : 0;
      this.downPass.render(gl, this.down[i]);
      tex = this.down[i].texture;
      tw = this.down[i].width;
      th = this.down[i].height;
    }
    // upsample: up[n-1] = down[n-1]; up[i] = tent(up[i+1]) + down[i]
    const last = this.levels - 1;
    let low: THREE.Texture = this.down[last].texture;
    let lowW = this.down[last].width;
    let lowH = this.down[last].height;
    const up = this.upPass.material.uniforms;
    for (let i = last - 1; i >= 0; i--) {
      up.tLow.value = low;
      up.tHigh.value = this.down[i].texture;
      up.texel.value.set(1 / lowW, 1 / lowH);
      this.upPass.render(gl, this.up[i]);
      low = this.up[i].texture;
      lowW = this.up[i].width;
      lowH = this.up[i].height;
    }
    return low;
  }

  /** A mid-size blurred level (for the very soft blur on the far convergence). */
  get soft(): THREE.Texture {
    return this.up[Math.min(2, this.levels - 2)].texture;
  }

  dispose(): void {
    [...this.down, ...this.up].forEach((r) => r.dispose());
    this.downPass.dispose();
    this.upPass.dispose();
  }
}
