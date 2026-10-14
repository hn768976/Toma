import {
  BufferAttribute,
  BufferGeometry,
  Camera,
  GLSL3,
  HalfFloatType,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  RawShaderMaterial,
  RGBAFormat,
  Scene,
  Texture,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { BLUE_NOISE_SIZE, getBlueNoiseTexture } from "./blueNoise";

/**
 * Deterministic post pipeline shared by the three.js looks.
 *
 *   scene → half-float MSAA target → bloom mip chain (half-float)
 *         → composite: exposure, vignette, tone map, sRGB encode,
 *           grain (pixel+frame hash), ±1/255 TPDF dither,
 *           optional blue-noise dither → 8-bit canvas.
 *
 * Nothing here reads a clock: the only time input is the frame number the
 * caller passes in. No temporal accumulation of any kind.
 */
export type ToneMap = "aces" | "none" | "soft";

export interface PostSettings {
  exposure: number;
  tonemap: ToneMap;
  bloomStrength: number;
  /** Linear-light threshold for bloom; 0 = everything blooms. */
  bloomThreshold: number;
  bloomKnee: number;
  /** 0..1.5: how much wider levels contribute (spread of the glow). */
  bloomRadius: number;
  vignette: number;
  /** 0..1 = how far in the vignette starts (fraction of half-diagonal). */
  vignetteStart: number;
  /** Grain amplitude in display units (0.015 = 1.5%). */
  grain: number;
  /** grain / dither pattern repeats every N frames (loop length). */
  grainPeriod: number;
  blueNoise: boolean;
  msaa: number;
  saturation: number;
}

export const defaultPost: PostSettings = {
  exposure: 1,
  tonemap: "aces",
  bloomStrength: 0.6,
  bloomThreshold: 0.8,
  bloomKnee: 0.5,
  bloomRadius: 0.85,
  vignette: 0.25,
  vignetteStart: 0.35,
  grain: 0.015,
  grainPeriod: 600,
  blueNoise: false,
  msaa: 4,
  saturation: 1,
};

const VERT = /* glsl */ `
precision highp float;
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const PREFILTER = /* glsl */ `
precision highp float;
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uThreshold;
uniform float uKnee;
in vec2 vUv;
out vec4 outColor;
vec3 s(vec2 o) { return texture(tSrc, vUv + o * uTexel).rgb; }
void main() {
  vec3 a = s(vec2(-2., 2.)), b = s(vec2(0., 2.)), c = s(vec2(2., 2.));
  vec3 d = s(vec2(-2., 0.)), e = s(vec2(0., 0.)), f = s(vec2(2., 0.));
  vec3 g = s(vec2(-2., -2.)), h = s(vec2(0., -2.)), i = s(vec2(2., -2.));
  vec3 j = s(vec2(-1., 1.)), k = s(vec2(1., 1.)), l = s(vec2(-1., -1.)), m = s(vec2(1., -1.));
  vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  col = min(col, vec3(64.0));
  float br = max(col.r, max(col.g, col.b));
  float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-5);
  float contrib = max(soft, br - uThreshold) / max(br, 1e-5);
  outColor = vec4(col * contrib, 1.0);
}`;

const DOWN = /* glsl */ `
precision highp float;
uniform sampler2D tSrc;
uniform vec2 uTexel;
in vec2 vUv;
out vec4 outColor;
vec3 s(vec2 o) { return texture(tSrc, vUv + o * uTexel).rgb; }
void main() {
  vec3 a = s(vec2(-2., 2.)), b = s(vec2(0., 2.)), c = s(vec2(2., 2.));
  vec3 d = s(vec2(-2., 0.)), e = s(vec2(0., 0.)), f = s(vec2(2., 0.));
  vec3 g = s(vec2(-2., -2.)), h = s(vec2(0., -2.)), i = s(vec2(2., -2.));
  vec3 j = s(vec2(-1., 1.)), k = s(vec2(1., 1.)), l = s(vec2(-1., -1.)), m = s(vec2(1., -1.));
  outColor = vec4(e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125, 1.0);
}`;

const UP = /* glsl */ `
precision highp float;
uniform sampler2D tLow;
uniform sampler2D tHigh;
uniform vec2 uTexel;
uniform float uRadius;
in vec2 vUv;
out vec4 outColor;
vec3 s(vec2 o) { return texture(tLow, vUv + o * uTexel).rgb; }
void main() {
  vec3 t = s(vec2(-1., 1.)) + 2.0 * s(vec2(0., 1.)) + s(vec2(1., 1.))
         + 2.0 * s(vec2(-1., 0.)) + 4.0 * s(vec2(0., 0.)) + 2.0 * s(vec2(1., 0.))
         + s(vec2(-1., -1.)) + 2.0 * s(vec2(0., -1.)) + s(vec2(1., -1.));
  outColor = vec4(texture(tHigh, vUv).rgb + uRadius * t / 16.0, 1.0);
}`;

export const HASH_GLSL = /* glsl */ `
uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float hash3(uvec3 p) {
  return float(pcg(p.x + pcg(p.y + pcg(p.z)))) * (1.0 / 4294967296.0);
}`;

/** sRGB encode, grain, TPDF dither, blue-noise dither. Expects uniforms. */
export const FINISH_GLSL = /* glsl */ `
uniform sampler2D tBlue;
uniform ivec2 uBlueOffset;
uniform float uBlueAmt;
uniform float uGrain;
uniform uint uFrameMod;
vec3 linearToSrgb(vec3 c) {
  c = max(c, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}
vec3 finish(vec3 display) {
  uvec2 px = uvec2(gl_FragCoord.xy);
  // Film grain: monochrome, triangular PDF, fixed formula of pixel + frame.
  float g = hash3(uvec3(px, uFrameMod * 4u + 0u)) + hash3(uvec3(px, uFrameMod * 4u + 1u)) - 1.0;
  display += g * uGrain;
  // ±1/255 TPDF dither per channel.
  vec3 d = vec3(
    hash3(uvec3(px, uFrameMod * 4u + 2u)) - hash3(uvec3(px.yx, uFrameMod * 4u + 3u)),
    hash3(uvec3(px + 7u, uFrameMod * 4u + 2u)) - hash3(uvec3(px.yx + 13u, uFrameMod * 4u + 3u)),
    hash3(uvec3(px + 29u, uFrameMod * 4u + 2u)) - hash3(uvec3(px.yx + 31u, uFrameMod * 4u + 3u))
  );
  display += d / 255.0;
  // Fixed blue-noise tile, offset per frame.
  float bn = texelFetch(tBlue, (ivec2(px) + uBlueOffset) & ${BLUE_NOISE_SIZE - 1}, 0).r;
  display += uBlueAmt * (bn - 0.5) / 255.0;
  return clamp(display, 0.0, 1.0);
}`;

const COMPOSITE = /* glsl */ `
precision highp float;
precision highp int;
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform float uBloom;
uniform float uExposure;
uniform float uVignette;
uniform float uVignetteStart;
uniform float uAspect;
uniform int uTone;
uniform float uSat;
in vec2 vUv;
out vec4 outColor;
${HASH_GLSL}
${FINISH_GLSL}
vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
vec3 softClip(vec3 x) {
  // Linear to 0.6, smooth shoulder to 1.
  vec3 over = max(x - 0.6, 0.0);
  return min(x, 0.6) + 0.4 * (1.0 - exp(-over / 0.4));
}
void main() {
  vec3 c = texture(tScene, vUv).rgb + texture(tBloom, vUv).rgb * uBloom;
  c *= uExposure;
  vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
  float r = length(q) / length(vec2(uAspect, 1.0) * 0.5);
  float v = smoothstep(uVignetteStart, 1.0, r);
  c *= 1.0 - uVignette * v * v;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = max(mix(vec3(l), c, uSat), 0.0);
  if (uTone == 0) c = aces(c);
  else if (uTone == 2) c = softClip(c);
  c = clamp(c, 0.0, 1.0);
  outColor = vec4(finish(linearToSrgb(c)), 1.0);
}`;

const makeRT = (w: number, h: number, samples = 0) =>
  new WebGLRenderTarget(w, h, {
    type: HalfFloatType,
    format: RGBAFormat,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: samples > 0,
    samples,
    generateMipmaps: false,
  });

/** One big triangle covering the viewport. */
export class FullscreenPass {
  readonly scene = new Scene();
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  readonly mesh: Mesh;
  constructor() {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.mesh = new Mesh(g);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }
  render(renderer: WebGLRenderer, material: RawShaderMaterial, target: WebGLRenderTarget | null) {
    this.mesh.material = material;
    renderer.setRenderTarget(target);
    renderer.render(this.scene, this.camera);
  }
}

export const rawMaterial = (fragmentShader: string, uniforms: Record<string, { value: unknown }>) =>
  new RawShaderMaterial({
    glslVersion: GLSL3,
    vertexShader: VERT,
    fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });

/** R2 low-discrepancy offset for the blue-noise tile at a given frame. */
export const blueNoiseOffset = (frameMod: number) =>
  [
    Math.floor(((0.5 + frameMod * 0.7548776662466927) % 1) * BLUE_NOISE_SIZE),
    Math.floor(((0.5 + frameMod * 0.5698402909980532) % 1) * BLUE_NOISE_SIZE),
  ] as [number, number];

export const finishUniforms = () => ({
  tBlue: { value: getBlueNoiseTexture() as Texture },
  uBlueOffset: { value: [0, 0] as [number, number] },
  uBlueAmt: { value: 0 },
  uGrain: { value: 0.015 },
  uFrameMod: { value: 0 },
});

export const setFinishUniforms = (
  u: ReturnType<typeof finishUniforms>,
  frame: number,
  period: number,
  grain: number,
  blueNoise: boolean,
) => {
  const fm = ((frame % period) + period) % period;
  u.uFrameMod.value = fm;
  u.uBlueOffset.value = blueNoiseOffset(fm);
  u.uBlueAmt.value = blueNoise ? 1 : 0;
  u.uGrain.value = grain;
};

const LEVELS = 6;

export class PostPipeline {
  settings: PostSettings;
  private w = 0;
  private h = 0;
  sceneRT!: WebGLRenderTarget;
  private down: WebGLRenderTarget[] = [];
  private up: WebGLRenderTarget[] = [];
  private pass = new FullscreenPass();
  private prefilter = rawMaterial(PREFILTER, {
    tSrc: { value: null },
    uTexel: { value: new Vector2() },
    uThreshold: { value: 1 },
    uKnee: { value: 0.5 },
  });
  private downMat = rawMaterial(DOWN, { tSrc: { value: null }, uTexel: { value: new Vector2() } });
  private upMat = rawMaterial(UP, {
    tLow: { value: null },
    tHigh: { value: null },
    uTexel: { value: new Vector2() },
    uRadius: { value: 1 },
  });
  private composite = rawMaterial(COMPOSITE, {
    tScene: { value: null },
    tBloom: { value: null },
    uBloom: { value: 1 },
    uExposure: { value: 1 },
    uVignette: { value: 0 },
    uVignetteStart: { value: 0.4 },
    uAspect: { value: 16 / 9 },
    uTone: { value: 0 },
    uSat: { value: 1 },
    ...finishUniforms(),
  });

  constructor(settings: Partial<PostSettings>) {
    this.settings = { ...defaultPost, ...settings };
  }

  private ensureSize(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    this.dispose();
    this.w = w;
    this.h = h;
    this.sceneRT = makeRT(w, h, this.settings.msaa);
    this.down = [];
    this.up = [];
    let lw = w;
    let lh = h;
    for (let i = 0; i < LEVELS; i++) {
      lw = Math.max(1, Math.floor(lw / 2));
      lh = Math.max(1, Math.floor(lh / 2));
      this.down.push(makeRT(lw, lh));
      this.up.push(makeRT(lw, lh));
    }
  }

  /** Render scene into the HDR target (callers may render extra layers into sceneRT after). */
  renderScene(renderer: WebGLRenderer, scene: Scene, camera: Camera, w: number, h: number) {
    this.ensureSize(w, h);
    renderer.setRenderTarget(this.sceneRT);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
  }

  /** Bloom + composite to the canvas. */
  finish(renderer: WebGLRenderer, frame: number) {
    const s = this.settings;
    const srcTex = this.sceneRT.texture;
    let bloomTex: Texture | null = null;
    if (s.bloomStrength > 0) {
      const pf = this.prefilter.uniforms;
      pf.tSrc.value = srcTex;
      (pf.uTexel.value as Vector2).set(1 / this.w, 1 / this.h);
      pf.uThreshold.value = s.bloomThreshold;
      pf.uKnee.value = Math.max(1e-4, s.bloomKnee);
      this.pass.render(renderer, this.prefilter, this.down[0]);
      for (let i = 1; i < LEVELS; i++) {
        const d = this.downMat.uniforms;
        d.tSrc.value = this.down[i - 1].texture;
        (d.uTexel.value as Vector2).set(1 / this.down[i - 1].width, 1 / this.down[i - 1].height);
        this.pass.render(renderer, this.downMat, this.down[i]);
      }
      let low = this.down[LEVELS - 1].texture;
      for (let i = LEVELS - 2; i >= 0; i--) {
        const u = this.upMat.uniforms;
        u.tLow.value = low;
        u.tHigh.value = this.down[i].texture;
        (u.uTexel.value as Vector2).set(1 / this.down[i + 1].width, 1 / this.down[i + 1].height);
        u.uRadius.value = s.bloomRadius;
        this.pass.render(renderer, this.upMat, this.up[i]);
        low = this.up[i].texture;
      }
      bloomTex = this.up[0].texture;
    }
    const c = this.composite.uniforms;
    c.tScene.value = srcTex;
    c.tBloom.value = bloomTex ?? srcTex;
    c.uBloom.value = bloomTex ? s.bloomStrength / LEVELS : 0;
    c.uExposure.value = s.exposure;
    c.uVignette.value = s.vignette;
    c.uVignetteStart.value = s.vignetteStart;
    c.uAspect.value = this.w / this.h;
    c.uTone.value = s.tonemap === "aces" ? 0 : s.tonemap === "none" ? 1 : 2;
    c.uSat.value = s.saturation;
    setFinishUniforms(c as never, frame, s.grainPeriod, s.grain, s.blueNoise);
    this.pass.render(renderer, this.composite, null);
  }

  dispose() {
    this.sceneRT?.dispose();
    this.down.forEach((r) => r.dispose());
    this.up.forEach((r) => r.dispose());
  }
}
