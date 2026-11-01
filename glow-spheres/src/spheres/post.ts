import * as THREE from "three";
import { FullScreenQuad, Pass } from "three/examples/jsm/postprocessing/Pass.js";

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

/**
 * Anamorphic lens streaks: bright areas are thresholded into a low
 * resolution buffer, smeared horizontally with a growing-step blur and added
 * back with a tint – the long horizontal flares seen in the reference.
 */
export class StreakPass extends Pass {
  private rtA: THREE.WebGLRenderTarget;
  private rtB: THREE.WebGLRenderTarget;
  private brightMat: THREE.ShaderMaterial;
  private blurMat: THREE.ShaderMaterial;
  private compMat: THREE.ShaderMaterial;
  private quad: FullScreenQuad;
  strength: number;

  constructor(width: number, height: number, tint: THREE.Color, strength = 0.6, threshold = 1.2) {
    super();
    this.strength = strength;
    const opts = { type: THREE.HalfFloatType, depthBuffer: false } as const;
    this.rtA = new THREE.WebGLRenderTarget(1, 1, opts);
    this.rtB = new THREE.WebGLRenderTarget(1, 1, opts);
    this.setSize(width, height);
    this.brightMat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, threshold: { value: threshold } },
      vertexShader: VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse; uniform float threshold; varying vec2 vUv;
        void main() {
          vec3 c = texture2D(tDiffuse, vUv).rgb;
          float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
          gl_FragColor = vec4(vec3(max(l - threshold, 0.0)), 1.0);
        }`,
    });
    this.blurMat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, stepPx: { value: 1 }, texel: { value: new THREE.Vector2() } },
      vertexShader: VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse; uniform float stepPx; uniform vec2 texel; varying vec2 vUv;
        void main() {
          vec3 s = texture2D(tDiffuse, vUv).rgb * 0.2;
          for (int i = 1; i <= 4; i++) {
            float w = 0.2 * (1.0 - float(i) / 5.0) * 1.0;
            vec2 o = vec2(float(i) * stepPx * texel.x, 0.0);
            s += (texture2D(tDiffuse, vUv + o).rgb + texture2D(tDiffuse, vUv - o).rgb) * w;
          }
          gl_FragColor = vec4(s, 1.0);
        }`,
    });
    this.compMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        tStreak: { value: null },
        tint: { value: tint },
        strength: { value: strength },
      },
      vertexShader: VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tDiffuse; uniform sampler2D tStreak; uniform vec3 tint; uniform float strength;
        varying vec2 vUv;
        void main() {
          vec4 base = texture2D(tDiffuse, vUv);
          vec3 st = texture2D(tStreak, vUv).rgb;
          gl_FragColor = vec4(base.rgb + st * tint * strength, base.a);
        }`,
    });
    this.quad = new FullScreenQuad();
  }

  setSize(width: number, height: number) {
    const w = Math.max(1, Math.round(width / 4));
    const h = Math.max(1, Math.round(height / 3));
    this.rtA?.setSize(w, h);
    this.rtB?.setSize(w, h);
  }

  render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
  ) {
    this.quad.material = this.brightMat;
    this.brightMat.uniforms.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(this.rtA);
    this.quad.render(renderer);

    this.quad.material = this.blurMat;
    this.blurMat.uniforms.texel.value.set(1 / this.rtA.width, 1 / this.rtA.height);
    let src = this.rtA;
    let dst = this.rtB;
    for (const step of [1, 3, 9, 27]) {
      this.blurMat.uniforms.tDiffuse.value = src.texture;
      this.blurMat.uniforms.stepPx.value = step;
      renderer.setRenderTarget(dst);
      this.quad.render(renderer);
      [src, dst] = [dst, src];
    }

    this.quad.material = this.compMat;
    this.compMat.uniforms.tDiffuse.value = readBuffer.texture;
    this.compMat.uniforms.tStreak.value = src.texture;
    this.compMat.uniforms.strength.value = this.strength;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }

  dispose() {
    this.rtA.dispose();
    this.rtB.dispose();
    this.brightMat.dispose();
    this.blurMat.dispose();
    this.compMat.dispose();
    this.quad.dispose();
  }
}

/** Final grade: vignette + fine deterministic film grain (sRGB space). */
export const createGradeShader = () => ({
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    seed: { value: 0 },
    vignette: { value: 0.45 },
    grain: { value: 0.012 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float seed; uniform float vignette; uniform float grain;
    varying vec2 vUv;
    float hash(vec2 p) { p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5; d.x *= 1.3;
      float v = 1.0 - vignette * smoothstep(0.25, 0.85, length(d));
      float n = hash(vUv * 1000.0 + seed) - 0.5;
      gl_FragColor = vec4(c.rgb * v + n * grain, c.a);
    }`,
});
