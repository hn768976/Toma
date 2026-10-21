import * as THREE from "three";
import { fullscreenTriangle } from "./GLStage";

/** Separable Gaussian blur between half-float targets. */
export class Blur {
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private mat: THREE.RawShaderMaterial;
  private tmp: THREE.WebGLRenderTarget;
  constructor(w: number, h: number) {
    this.tmp = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false });
    this.mat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      depthTest: false,
      depthWrite: false,
      uniforms: { uSrc: { value: null }, uDir: { value: new THREE.Vector2() } },
      vertexShader: /* glsl */ `
in vec2 position;
out vec2 vUv;
void main() { vUv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
precision highp float;
uniform sampler2D uSrc;
uniform vec2 uDir; // texel step * sigma scale
in vec2 vUv;
out vec4 outColor;
void main() {
  // 9 taps, sigma = 2 steps.
  const float w0 = 0.2270270270, w1 = 0.1945945946, w2 = 0.1216216216, w3 = 0.0540540541, w4 = 0.0162162162;
  vec4 c = texture(uSrc, vUv) * w0;
  c += (texture(uSrc, vUv + uDir) + texture(uSrc, vUv - uDir)) * w1;
  c += (texture(uSrc, vUv + 2.0 * uDir) + texture(uSrc, vUv - 2.0 * uDir)) * w2;
  c += (texture(uSrc, vUv + 3.0 * uDir) + texture(uSrc, vUv - 3.0 * uDir)) * w3;
  c += (texture(uSrc, vUv + 4.0 * uDir) + texture(uSrc, vUv - 4.0 * uDir)) * w4;
  outColor = c;
}`,
    });
    const m = new THREE.Mesh(fullscreenTriangle(), this.mat);
    m.frustumCulled = false;
    this.scene.add(m);
  }
  /** Blur src into dst; `radiusPx` is the step in device pixels. */
  run(renderer: THREE.WebGLRenderer, src: THREE.Texture, dst: THREE.WebGLRenderTarget, radiusPx: number) {
    const w = dst.width;
    const h = dst.height;
    this.mat.uniforms.uSrc.value = src;
    this.mat.uniforms.uDir.value.set(radiusPx / w, 0);
    renderer.setRenderTarget(this.tmp);
    renderer.render(this.scene, this.cam);
    this.mat.uniforms.uSrc.value = this.tmp.texture;
    this.mat.uniforms.uDir.value.set(0, radiusPx / h);
    renderer.setRenderTarget(dst);
    renderer.render(this.scene, this.cam);
  }
}

/** Draws a texture over the current target (premultiplied / additive). */
export class TexturePass {
  private scene = new THREE.Scene();
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  readonly mat: THREE.RawShaderMaterial;
  constructor(blending: THREE.Blending = THREE.AdditiveBlending) {
    this.mat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      blending,
      uniforms: { uSrc: { value: null } },
      vertexShader: /* glsl */ `
in vec2 position;
out vec2 vUv;
void main() { vUv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
precision highp float;
uniform sampler2D uSrc;
in vec2 vUv;
out vec4 outColor;
void main() { outColor = texture(uSrc, vUv); }`,
    });
    const m = new THREE.Mesh(fullscreenTriangle(), this.mat);
    m.frustumCulled = false;
    this.scene.add(m);
  }
  run(renderer: THREE.WebGLRenderer, src: THREE.Texture) {
    this.mat.uniforms.uSrc.value = src;
    renderer.render(this.scene, this.cam);
  }
}
