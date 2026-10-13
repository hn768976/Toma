import { Pass } from "postprocessing";
import * as THREE from "three";

// Classic mip-chain bloom: soft-knee bright pass, 13-tap downsamples, tent
// upsamples accumulating back up the chain. Stateless per frame. The result
// (`texture`) is composited by the final effect.
const VERT = `varying vec2 vUv; void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const BRIGHT = `
uniform sampler2D tSrc; uniform float uThreshold; uniform float uKnee; varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv).rgb;
  float br = max(max(c.r, c.g), c.b);
  float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-5);
  float w = max(soft, br - uThreshold) / max(br, 1e-5);
  gl_FragColor = vec4(c * w, 1.0);
}`;

const DOWN = `
uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
void main() {
  vec2 t = uTexel;
  vec3 a = texture2D(tSrc, vUv + t * vec2(-2.0, 2.0)).rgb;
  vec3 b = texture2D(tSrc, vUv + t * vec2(0.0, 2.0)).rgb;
  vec3 c = texture2D(tSrc, vUv + t * vec2(2.0, 2.0)).rgb;
  vec3 d = texture2D(tSrc, vUv + t * vec2(-2.0, 0.0)).rgb;
  vec3 e = texture2D(tSrc, vUv).rgb;
  vec3 f = texture2D(tSrc, vUv + t * vec2(2.0, 0.0)).rgb;
  vec3 g = texture2D(tSrc, vUv + t * vec2(-2.0, -2.0)).rgb;
  vec3 h = texture2D(tSrc, vUv + t * vec2(0.0, -2.0)).rgb;
  vec3 i = texture2D(tSrc, vUv + t * vec2(2.0, -2.0)).rgb;
  vec3 j = texture2D(tSrc, vUv + t * vec2(-1.0, 1.0)).rgb;
  vec3 k = texture2D(tSrc, vUv + t * vec2(1.0, 1.0)).rgb;
  vec3 l = texture2D(tSrc, vUv + t * vec2(-1.0, -1.0)).rgb;
  vec3 m = texture2D(tSrc, vUv + t * vec2(1.0, -1.0)).rgb;
  vec3 o = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  gl_FragColor = vec4(o, 1.0);
}`;

const UP = `
uniform sampler2D tSrc; uniform sampler2D tBase; uniform vec2 uTexel; uniform float uRadius; varying vec2 vUv;
void main() {
  vec2 t = uTexel * uRadius;
  vec3 s = texture2D(tSrc, vUv + t * vec2(-1.0, 1.0)).rgb + texture2D(tSrc, vUv + t * vec2(1.0, 1.0)).rgb
         + texture2D(tSrc, vUv + t * vec2(-1.0, -1.0)).rgb + texture2D(tSrc, vUv + t * vec2(1.0, -1.0)).rgb;
  s += 2.0 * (texture2D(tSrc, vUv + t * vec2(0.0, 1.0)).rgb + texture2D(tSrc, vUv + t * vec2(0.0, -1.0)).rgb
         + texture2D(tSrc, vUv + t * vec2(1.0, 0.0)).rgb + texture2D(tSrc, vUv + t * vec2(-1.0, 0.0)).rgb);
  s += 4.0 * texture2D(tSrc, vUv).rgb;
  gl_FragColor = vec4(texture2D(tBase, vUv).rgb + s / 16.0, 1.0);
}`;

export class MipBloomPass extends Pass {
  levels: number;
  threshold: number;
  knee: number;
  radius = 1;
  private downs: THREE.WebGLRenderTarget[] = [];
  private ups: THREE.WebGLRenderTarget[] = [];
  private mesh: THREE.Mesh;
  private quadScene = new THREE.Scene();
  private cam = new THREE.Camera();
  private mBright: THREE.ShaderMaterial;
  private mDown: THREE.ShaderMaterial;
  private mUp: THREE.ShaderMaterial;
  texture: THREE.Texture | null = null;

  constructor(levels: number, threshold: number, knee: number) {
    super("MipBloomPass");
    this.needsSwap = false;
    this.levels = levels;
    this.threshold = threshold;
    this.knee = knee;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const mk = (frag: string, u: Record<string, THREE.IUniform>) =>
      new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms: u, depthTest: false, depthWrite: false });
    this.mBright = mk(BRIGHT, { tSrc: { value: null }, uThreshold: { value: threshold }, uKnee: { value: knee } });
    this.mDown = mk(DOWN, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.mUp = mk(UP, { tSrc: { value: null }, tBase: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 1 } });
    this.mesh = new THREE.Mesh(geo, this.mBright);
    this.mesh.frustumCulled = false;
    this.quadScene.add(this.mesh);
  }

  setSize(width: number, height: number) {
    this.downs.forEach((t) => t.dispose());
    this.ups.forEach((t) => t.dispose());
    this.downs = [];
    this.ups = [];
    let w = Math.max(1, Math.round(width / 2));
    let h = Math.max(1, Math.round(height / 2));
    const opts = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    for (let i = 0; i < this.levels; i++) {
      this.downs.push(new THREE.WebGLRenderTarget(w, h, opts));
      this.ups.push(new THREE.WebGLRenderTarget(w, h, opts));
      w = Math.max(1, Math.round(w / 2));
      h = Math.max(1, Math.round(h / 2));
    }
    this.texture = this.ups[0].texture;
  }

  private draw(renderer: THREE.WebGLRenderer, mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget) {
    this.mesh.material = mat;
    renderer.setRenderTarget(target);
    renderer.render(this.quadScene, this.cam);
  }

  render(renderer: THREE.WebGLRenderer, inputBuffer: THREE.WebGLRenderTarget) {
    if (!this.downs.length) return;
    this.mBright.uniforms.tSrc.value = inputBuffer.texture;
    this.mBright.uniforms.uThreshold.value = this.threshold;
    this.mBright.uniforms.uKnee.value = this.knee;
    this.draw(renderer, this.mBright, this.ups[0]); // bright pass at half res (scratch)
    let src = this.ups[0].texture;
    for (let i = 0; i < this.levels; i++) {
      const t = this.downs[i];
      this.mDown.uniforms.tSrc.value = src;
      this.mDown.uniforms.uTexel.value.set(1 / (i === 0 ? t.width : this.downs[i - 1].width), 1 / (i === 0 ? t.height : this.downs[i - 1].height));
      this.draw(renderer, this.mDown, t);
      src = t.texture;
    }
    // Upsample: ups[i] = downs[i] + blur(up of level i+1)
    let up = this.downs[this.levels - 1].texture;
    for (let i = this.levels - 2; i >= 0; i--) {
      const t = this.ups[i];
      const s = this.downs[i + 1];
      this.mUp.uniforms.tSrc.value = up;
      this.mUp.uniforms.tBase.value = this.downs[i].texture;
      this.mUp.uniforms.uTexel.value.set(1 / s.width, 1 / s.height);
      this.mUp.uniforms.uRadius.value = this.radius;
      this.draw(renderer, this.mUp, t);
      up = t.texture;
    }
    this.texture = this.ups[0].texture;
  }
}
