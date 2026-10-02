import * as THREE from "three";

/**
 * Post chain shared by looks 2-5.
 *   scene (additive, half-float)  ->  bloom mip chain  ->  final:
 *   background(uv) + scene + bloom  ->  soft clip  ->  grain (2%)  ->  dither (+-1/255)
 * Pure function of its inputs: no temporal accumulation, no TAA, no feedback.
 */

export type PostSettings = {
  /** GLSL body defining `vec3 background(vec2 uv)` (uv 0..1, y up). May use uniforms declared in `backgroundUniformsGLSL`. */
  backgroundGLSL: string;
  backgroundUniformsGLSL?: string;
  backgroundUniforms?: Record<string, THREE.IUniform>;
  bloomStrength: number;
  /** 0..1: how much the wide mip levels contribute. */
  bloomRadius: number;
  exposure?: number;
  /** Grain amplitude (fraction of full scale). Spec: ~2%. */
  grain?: number;
};

const FULLSCREEN_VS = /* glsl */ `
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const DOWN_FS = /* glsl */ `
precision highp float;
uniform sampler2D tSrc;
uniform vec2 uTexel;
in vec2 vUv;
out vec4 outColor;
vec3 s(vec2 o) { return texture(tSrc, vUv + o * uTexel).rgb; }
void main() {
  // 13-tap downsample (Jimenez 2014): stable, no fireflies flicker.
  vec3 a = s(vec2(-2.0, 2.0)), b = s(vec2(0.0, 2.0)), c = s(vec2(2.0, 2.0));
  vec3 d = s(vec2(-2.0, 0.0)), e = s(vec2(0.0, 0.0)), f = s(vec2(2.0, 0.0));
  vec3 g = s(vec2(-2.0, -2.0)), h = s(vec2(0.0, -2.0)), i = s(vec2(2.0, -2.0));
  vec3 j = s(vec2(-1.0, 1.0)), k = s(vec2(1.0, 1.0)), l = s(vec2(-1.0, -1.0)), m = s(vec2(1.0, -1.0));
  vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  outColor = vec4(col, 1.0);
}`;

const UP_FS = /* glsl */ `
precision highp float;
uniform sampler2D tSmall;
uniform sampler2D tCurrent;
uniform vec2 uTexel;
uniform float uWeight;
in vec2 vUv;
out vec4 outColor;
vec3 s(vec2 o) { return texture(tSmall, vUv + o * uTexel).rgb; }
void main() {
  vec3 t = s(vec2(-1.0, 1.0)) + 2.0 * s(vec2(0.0, 1.0)) + s(vec2(1.0, 1.0))
         + 2.0 * s(vec2(-1.0, 0.0)) + 4.0 * s(vec2(0.0, 0.0)) + 2.0 * s(vec2(1.0, 0.0))
         + s(vec2(-1.0, -1.0)) + 2.0 * s(vec2(0.0, -1.0)) + s(vec2(1.0, -1.0));
  t /= 16.0;
  outColor = vec4(texture(tCurrent, vUv).rgb + t * uWeight, 1.0);
}`;

const finalFS = (s: PostSettings) => /* glsl */ `
precision highp float;
precision highp int;
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform float uBloom;
uniform float uExposure;
uniform float uGrain;
uniform uint uFrame;   // frame % 600
uniform vec2 uRes;
${s.backgroundUniformsGLSL ?? ""}
in vec2 vUv;
out vec4 outColor;

${s.backgroundGLSL}

// PCG3D integer hash: fixed formula of pixel position and frame.
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}

vec3 softClip(vec3 c) {
  // Linear up to 0.8, then smooth roll-off towards 1.0 (no hard clipping edges).
  vec3 k = vec3(0.8);
  vec3 over = max(c - k, 0.0);
  return min(c, k) + (1.0 - k) * (1.0 - exp(-over / (1.0 - k)));
}

void main() {
  vec3 scene = texture(tScene, vUv).rgb;
  vec3 bloom = texture(tBloom, vUv).rgb;
  vec3 col = background(vUv) + uExposure * (scene + uBloom * bloom);
  col = softClip(max(col, 0.0));

  uvec3 h = pcg3d(uvec3(uvec2(gl_FragCoord.xy), uFrame));
  vec3 r = vec3(h) * (1.0 / 4294967295.0);
  // Grain: triangular-distributed, amplitude uGrain (monochrome).
  float grain = (r.x + r.y - 1.0) * uGrain;
  // Dither: +-1/255 after bloom (kills 8-bit banding in gradients and glows).
  float dither = (r.z * 2.0 - 1.0) / 255.0;
  col += grain + dither;
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

const makeRT = (w: number, h: number) =>
  new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
    generateMipmaps: false,
  });

export class Composer {
  private gl: THREE.WebGLRenderer;
  private settings: PostSettings;
  private sceneRT: THREE.WebGLRenderTarget | null = null;
  private down: THREE.WebGLRenderTarget[] = [];
  private up: THREE.WebGLRenderTarget[] = [];
  private w = 0;
  private h = 0;
  private quad: THREE.Mesh;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private downMat: THREE.RawShaderMaterial;
  private upMat: THREE.RawShaderMaterial;
  private finalMat: THREE.RawShaderMaterial;

  constructor(gl: THREE.WebGLRenderer, settings: PostSettings) {
    this.gl = gl;
    this.settings = settings;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const common = { glslVersion: THREE.GLSL3, depthTest: false, depthWrite: false, vertexShader: FULLSCREEN_VS };
    this.downMat = new THREE.RawShaderMaterial({
      ...common,
      fragmentShader: DOWN_FS,
      uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } },
    });
    this.upMat = new THREE.RawShaderMaterial({
      ...common,
      fragmentShader: UP_FS,
      uniforms: {
        tSmall: { value: null },
        tCurrent: { value: null },
        uTexel: { value: new THREE.Vector2() },
        uWeight: { value: 1 },
      },
    });
    this.finalMat = new THREE.RawShaderMaterial({
      ...common,
      fragmentShader: finalFS(settings),
      uniforms: {
        tScene: { value: null },
        tBloom: { value: null },
        uBloom: { value: settings.bloomStrength },
        uExposure: { value: settings.exposure ?? 1 },
        uGrain: { value: settings.grain ?? 0.02 },
        uFrame: { value: 0 },
        uRes: { value: new THREE.Vector2() },
        ...(settings.backgroundUniforms ?? {}),
      },
    });
    this.quad = new THREE.Mesh(geo, this.downMat);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  private resize(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.sceneRT?.dispose();
    this.down.forEach((r) => r.dispose());
    this.up.forEach((r) => r.dispose());
    this.sceneRT = makeRT(w, h);
    this.down = [];
    this.up = [];
    // Mip chain down to ~1/64 of height, independent of output resolution (same look at 720p and 4K).
    let cw = w;
    let ch = h;
    for (let i = 0; i < 6; i++) {
      cw = Math.max(1, Math.round(cw / 2));
      ch = Math.max(1, Math.round(ch / 2));
      this.down.push(makeRT(cw, ch));
      this.up.push(makeRT(cw, ch));
    }
  }

  private pass(mat: THREE.Material, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    this.gl.setRenderTarget(target);
    this.gl.render(this.quadScene, this.quadCam);
  }

  render(scene: THREE.Scene, camera: THREE.Camera, frame: number, w: number, h: number) {
    this.resize(w, h);
    const gl = this.gl;
    const sceneRT = this.sceneRT!;
    gl.autoClear = false;
    gl.setClearColor(0x000000, 0);
    gl.setRenderTarget(sceneRT);
    gl.clear(true, true, true);
    gl.render(scene, camera);

    // Downsample chain.
    let src: THREE.WebGLRenderTarget = sceneRT;
    for (const d of this.down) {
      this.downMat.uniforms.tSrc.value = src.texture;
      this.downMat.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      this.pass(this.downMat, d);
      src = d;
    }
    // Upsample chain (tent filter), accumulating.
    const n = this.down.length;
    let small = this.down[n - 1];
    for (let i = n - 2; i >= 0; i--) {
      this.upMat.uniforms.tSmall.value = small.texture;
      this.upMat.uniforms.tCurrent.value = this.down[i].texture;
      this.upMat.uniforms.uTexel.value.set(1 / small.width, 1 / small.height);
      this.upMat.uniforms.uWeight.value = this.settings.bloomRadius;
      this.pass(this.upMat, this.up[i]);
      small = this.up[i];
    }

    const fu = this.finalMat.uniforms;
    fu.tScene.value = sceneRT.texture;
    fu.tBloom.value = small.texture;
    fu.uFrame.value = ((frame % 600) + 600) % 600;
    fu.uRes.value.set(w, h);
    this.pass(this.finalMat, null);
  }

  dispose() {
    this.sceneRT?.dispose();
    this.down.forEach((r) => r.dispose());
    this.up.forEach((r) => r.dispose());
  }
}
