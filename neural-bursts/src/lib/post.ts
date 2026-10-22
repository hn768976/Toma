import * as THREE from "three";

// HDR post pipeline: scene -> half-float target -> dual-filter bloom pyramid
// -> filmic composite (exposure, vignette, gamma, dither) -> canvas.

const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const DOWN_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uThreshold;
varying vec2 vUv;
void main() {
  vec2 h = uTexel * 0.5;
  vec3 s = texture2D(tSrc, vUv).rgb * 4.0;
  s += texture2D(tSrc, vUv - h).rgb;
  s += texture2D(tSrc, vUv + h).rgb;
  s += texture2D(tSrc, vUv + vec2(h.x, -h.y)).rgb;
  s += texture2D(tSrc, vUv - vec2(h.x, -h.y)).rgb;
  s /= 8.0;
  // Soft knee: only the brighter light feeds the bloom pyramid.
  float l = max(max(s.r, s.g), s.b);
  s *= max(l - uThreshold, 0.0) / max(l, 1e-4);
  gl_FragColor = vec4(s, 1.0);
}`;

const UP_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform sampler2D tAdd;
uniform vec2 uTexel;
uniform float uAddWeight;
varying vec2 vUv;
void main() {
  vec2 h = uTexel * 0.5;
  vec3 s = texture2D(tSrc, vUv + vec2(-h.x * 2.0, 0.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(-h.x, h.y)).rgb * 2.0;
  s += texture2D(tSrc, vUv + vec2(0.0, h.y * 2.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(h.x, h.y)).rgb * 2.0;
  s += texture2D(tSrc, vUv + vec2(h.x * 2.0, 0.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(h.x, -h.y)).rgb * 2.0;
  s += texture2D(tSrc, vUv + vec2(0.0, -h.y * 2.0)).rgb;
  s += texture2D(tSrc, vUv + vec2(-h.x, -h.y)).rgb * 2.0;
  gl_FragColor = vec4(s / 12.0 + texture2D(tAdd, vUv).rgb * uAddWeight, 1.0);
}`;

const COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform float uBloom;
uniform float uExposure;
uniform float uVignette;
uniform vec3 uBackground;
uniform vec3 uBgGlowColor;
uniform vec2 uBgGlowPos;
uniform float uBgGlow;
uniform float uStreak;
uniform float uStreakY;
uniform float uFade;
uniform float uAspect;
varying vec2 vUv;

float hash(vec2 p) {
  p = fract(p * vec2(443.897, 441.423));
  p += dot(p, p.yx + 19.19);
  return fract((p.x + p.y) * p.x);
}

void main() {
  vec3 c = texture2D(tScene, vUv).rgb;
  c += texture2D(tBloom, vUv).rgb * uBloom;

  vec2 d = (vUv - uBgGlowPos) * vec2(uAspect, 1.0);
  c += uBgGlowColor * uBgGlow * (2.6 * exp(-dot(d, d) * 70.0) + 0.35 * exp(-dot(d, d) * 12.0) + 0.05 * exp(-dot(d, d) * 2.0));
  // Anamorphic lens streak: a thin horizontal band of light.
  float dy = vUv.y - uStreakY;
  c += uBgGlowColor * uStreak * exp(-dy * dy * 1400.0) * exp(-abs(d.x) * 1.1);
  c += uBgGlowColor * uStreak * 0.25 * exp(-dy * dy * 90.0) * exp(-abs(d.x) * 2.0);
  c += uBackground;

  // Filmic shoulder that mostly preserves hue (saturated blues stay blue
  // instead of washing out to grey-white), with a little per-channel
  // roll-off so the hottest cores still go white.
  vec3 x = c * uExposure;
  float lum = max(dot(x, vec3(0.2126, 0.7152, 0.0722)), 1e-5);
  vec3 huePreserve = x * ((1.0 - exp(-lum)) / lum);
  c = mix(1.0 - exp(-x), huePreserve, 0.55);

  vec2 v = (vUv - 0.5) * vec2(uAspect, 1.0);
  c *= mix(1.0, smoothstep(1.25, 0.25, length(v)), uVignette);
  c *= uFade;

  c = pow(max(c, 0.0), vec3(1.0 / 2.2));
  // +-0.5 LSB blue-noise-ish dither keeps the dark gradients from banding
  // once the video is compressed to 8-bit H.264.
  c += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  gl_FragColor = vec4(c, 1.0);
}`;

export type PostSettings = {
  bloom: number;
  exposure: number;
  vignette: number;
  background: [number, number, number];
  bgGlowColor: [number, number, number];
  bgGlowPos: [number, number];
  bgGlow: number;
  fade: number;
  streak?: number;
  threshold?: number;
  streakY?: number;
};

const LEVELS = 7;

export class PostPipeline {
  private sceneRT: THREE.WebGLRenderTarget;
  private down: THREE.WebGLRenderTarget[] = [];
  private up: THREE.WebGLRenderTarget[] = [];
  private quad: THREE.Mesh;
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quadScene = new THREE.Scene();
  private downMat: THREE.ShaderMaterial;
  private upMat: THREE.ShaderMaterial;
  private compMat: THREE.ShaderMaterial;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private width: number,
    private height: number,
  ) {
    const opts = {
      type: THREE.HalfFloatType,
      depthBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    } as const;
    this.sceneRT = new THREE.WebGLRenderTarget(width, height, opts);
    for (let i = 0; i < LEVELS; i++) {
      const w = Math.max(1, Math.round(width / 2 ** (i + 1)));
      const h = Math.max(1, Math.round(height / 2 ** (i + 1)));
      this.down.push(new THREE.WebGLRenderTarget(w, h, opts));
      this.up.push(new THREE.WebGLRenderTarget(w, h, opts));
    }
    const mk = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
      new THREE.ShaderMaterial({
        vertexShader: FULLSCREEN_VERT,
        fragmentShader: frag,
        uniforms,
        depthTest: false,
        depthWrite: false,
      });
    this.downMat = mk(DOWN_FRAG, {
      tSrc: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uThreshold: { value: 0 },
    });
    this.upMat = mk(UP_FRAG, {
      tSrc: { value: null },
      tAdd: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uAddWeight: { value: 1 },
    });
    this.compMat = mk(COMPOSITE_FRAG, {
      tScene: { value: this.sceneRT.texture },
      tBloom: { value: null },
      uBloom: { value: 1 },
      uExposure: { value: 1 },
      uVignette: { value: 0.5 },
      uBackground: { value: new THREE.Vector3() },
      uBgGlowColor: { value: new THREE.Vector3() },
      uBgGlowPos: { value: new THREE.Vector2(0.5, 0.5) },
      uBgGlow: { value: 0 },
      uFade: { value: 1 },
      uStreak: { value: 0 },
      uStreakY: { value: 0.5 },
      uAspect: { value: width / height },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.downMat);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  private pass(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.camera);
  }

  render(scene: THREE.Scene, camera: THREE.Camera, s: PostSettings) {
    const r = this.renderer;
    r.setRenderTarget(this.sceneRT);
    r.setClearColor(0x000000, 1);
    r.clear();
    r.render(scene, camera);

    let src = this.sceneRT;
    for (let i = 0; i < LEVELS; i++) {
      this.downMat.uniforms.tSrc.value = src.texture;
      this.downMat.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      this.downMat.uniforms.uThreshold.value = i === 0 ? s.threshold ?? 0 : 0;
      this.pass(this.downMat, this.down[i]);
      src = this.down[i];
    }
    let upSrc = this.down[LEVELS - 1];
    for (let i = LEVELS - 2; i >= 0; i--) {
      this.upMat.uniforms.tSrc.value = upSrc.texture;
      this.upMat.uniforms.tAdd.value = this.down[i].texture;
      this.upMat.uniforms.uAddWeight.value = 0.7;
      this.upMat.uniforms.uTexel.value.set(1 / upSrc.width, 1 / upSrc.height);
      this.pass(this.upMat, this.up[i]);
      upSrc = this.up[i];
    }

    const u = this.compMat.uniforms;
    u.tBloom.value = this.up[0].texture;
    u.uBloom.value = s.bloom / LEVELS;
    u.uExposure.value = s.exposure;
    u.uVignette.value = s.vignette;
    u.uBackground.value.set(...s.background);
    u.uBgGlowColor.value.set(...s.bgGlowColor);
    u.uBgGlowPos.value.set(...s.bgGlowPos);
    u.uBgGlow.value = s.bgGlow;
    u.uFade.value = s.fade;
    u.uStreak.value = s.streak ?? 0;
    u.uStreakY.value = s.streakY ?? 0.5;
    this.pass(this.compMat, null);
  }

  dispose() {
    this.sceneRT.dispose();
    [...this.down, ...this.up].forEach((t) => t.dispose());
    this.downMat.dispose();
    this.upMat.dispose();
    this.compMat.dispose();
    this.quad.geometry.dispose();
  }

  get size() {
    return [this.width, this.height];
  }
}
