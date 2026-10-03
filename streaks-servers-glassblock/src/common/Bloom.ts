import * as THREE from "three";
import { FullscreenPass, TargetCache } from "./FullscreenPass";

const DOWN = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tSrc;
uniform vec2 uTexel;     // 1 / source size
uniform float uThreshold;
void main() {
  // 13-tap downsample (Jimenez 2014), bilinear taps.
  vec2 t = uTexel;
  vec3 a = texture(tSrc, vUv + t * vec2(-2.0, 2.0)).rgb;
  vec3 b = texture(tSrc, vUv + t * vec2(0.0, 2.0)).rgb;
  vec3 c = texture(tSrc, vUv + t * vec2(2.0, 2.0)).rgb;
  vec3 d = texture(tSrc, vUv + t * vec2(-2.0, 0.0)).rgb;
  vec3 e = texture(tSrc, vUv).rgb;
  vec3 f = texture(tSrc, vUv + t * vec2(2.0, 0.0)).rgb;
  vec3 g = texture(tSrc, vUv + t * vec2(-2.0, -2.0)).rgb;
  vec3 h = texture(tSrc, vUv + t * vec2(0.0, -2.0)).rgb;
  vec3 i = texture(tSrc, vUv + t * vec2(2.0, -2.0)).rgb;
  vec3 j = texture(tSrc, vUv + t * vec2(-1.0, 1.0)).rgb;
  vec3 k = texture(tSrc, vUv + t * vec2(1.0, 1.0)).rgb;
  vec3 l = texture(tSrc, vUv + t * vec2(-1.0, -1.0)).rgb;
  vec3 m = texture(tSrc, vUv + t * vec2(1.0, -1.0)).rgb;
  vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  if (uThreshold > 0.0) {
    float br = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col *= smoothstep(uThreshold, uThreshold * 2.0, br);
  }
  outColor = vec4(col, 1.0);
}
`;

const UP = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tLow;   // lower-res bloom level
uniform sampler2D tCur;   // this level's downsample
uniform vec2 uTexel;      // 1 / low size
uniform float uRadius;
uniform float uScale;
void main() {
  vec2 t = uTexel * uRadius;
  vec3 s = texture(tLow, vUv + vec2(-t.x, t.y)).rgb
         + texture(tLow, vUv + vec2(0.0, t.y)).rgb * 2.0
         + texture(tLow, vUv + vec2(t.x, t.y)).rgb
         + texture(tLow, vUv + vec2(-t.x, 0.0)).rgb * 2.0
         + texture(tLow, vUv).rgb * 4.0
         + texture(tLow, vUv + vec2(t.x, 0.0)).rgb * 2.0
         + texture(tLow, vUv + vec2(-t.x, -t.y)).rgb
         + texture(tLow, vUv + vec2(0.0, -t.y)).rgb * 2.0
         + texture(tLow, vUv + vec2(t.x, -t.y)).rgb;
  outColor = vec4((s / 16.0 + texture(tCur, vUv).rgb) * uScale, 1.0);
}
`;

/**
 * Mip-chain bloom (downsample 13-tap, upsample tent). Purely spatial — no
 * history between frames. Output texture is at 1/2 resolution and holds the
 * sum of all levels.
 */
export class Bloom {
  private down: FullscreenPass;
  private up: FullscreenPass;
  private targets = new TargetCache();

  constructor(private levels = 6) {
    this.down = new FullscreenPass(DOWN, {
      tSrc: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uThreshold: { value: 0 },
    });
    this.up = new FullscreenPass(UP, {
      tLow: { value: null },
      tCur: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uRadius: { value: 1 },
      uScale: { value: 1 },
    });
  }

  /** Returns the bloom texture: mean of all mip levels, thresholded on luminance. */
  render(gl: THREE.WebGLRenderer, src: THREE.WebGLRenderTarget, threshold = 0): THREE.Texture {
    const downs: THREE.WebGLRenderTarget[] = [];
    let prev = src;
    for (let i = 0; i < this.levels; i++) {
      const w = Math.max(1, Math.floor(prev.width / 2));
      const h = Math.max(1, Math.floor(prev.height / 2));
      const t = this.targets.get(`d${i}`, w, h);
      this.down.uniforms.tSrc.value = prev.texture;
      this.down.uniforms.uTexel.value.set(1 / prev.width, 1 / prev.height);
      this.down.uniforms.uThreshold.value = i === 0 ? threshold : 0;
      this.down.render(gl, t);
      downs.push(t);
      prev = t;
    }
    let low = downs[this.levels - 1];
    for (let i = this.levels - 2; i >= 0; i--) {
      const cur = downs[i];
      const t = this.targets.get(`u${i}`, cur.width, cur.height);
      this.up.uniforms.tLow.value = low.texture;
      this.up.uniforms.tCur.value = cur.texture;
      this.up.uniforms.uTexel.value.set(1 / low.width, 1 / low.height);
      // Running average so the result is ~ the mean of all levels.
      this.up.uniforms.uScale.value = i === 0 ? 1 / this.levels : 1;
      this.up.render(gl, t);
      low = t;
    }
    return low.texture;
  }

  get levelCount() {
    return this.levels;
  }

  dispose() {
    this.down.dispose();
    this.up.dispose();
    this.targets.dispose();
  }
}
