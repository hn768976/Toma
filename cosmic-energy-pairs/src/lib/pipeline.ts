import * as THREE from "three";
import { HASH } from "./glsl";

/**
 * Deterministic post pipeline shared by every look:
 *
 *   scene → HDR half-float target → 7-level bloom (13-tap down / tent up)
 *         → composite: + bloom, exposure, ACES (Hill fit), sRGB encode,
 *           film grain (fixed hash of pixel & frame), ±1/255 TPDF dither.
 *
 * No temporal state: every render target is fully overwritten each frame, so a
 * frame rendered cold matches the same frame rendered mid-sequence.
 */

export type PostSettings = {
  /** Bloom amount added on top of the HDR image. */
  bloomStrength: number;
  /** 0..1 — how much the wide (low-res) mips contribute. */
  bloomRadius: number;
  /** Linear-light threshold before bloom (soft knee). */
  bloomThreshold: number;
  exposure: number;
  /** Grain amplitude in display units (0.02 ≈ 2%). 0 disables. */
  grain: number;
  /**
   * "pure-black" looks (2, 4): no grain, dither only where there is signal,
   * and a tiny linear black floor so faint bloom tails don't lift black.
   */
  pureBlack: boolean;
};

const BLOOM_LEVELS = 7;

const VERT = /* glsl */ `
in vec3 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const DOWN_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tSrc;
uniform vec2 uTexel; // 1 / source size
uniform float uThreshold;
uniform float uPrefilter;
in vec2 vUv;
out vec4 outColor;
vec3 s(vec2 o) { return texture(tSrc, vUv + o * uTexel).rgb; }
void main() {
  // Jimenez 13-tap downsample (CoD:AW), weighted 0.5 inner / 0.125 x4 outer.
  vec3 a = s(vec2(-2.0, 2.0)), b = s(vec2(0.0, 2.0)), c = s(vec2(2.0, 2.0));
  vec3 d = s(vec2(-2.0, 0.0)), e = s(vec2(0.0, 0.0)), f = s(vec2(2.0, 0.0));
  vec3 g = s(vec2(-2.0, -2.0)), h = s(vec2(0.0, -2.0)), i = s(vec2(2.0, -2.0));
  vec3 j = s(vec2(-1.0, 1.0)), k = s(vec2(1.0, 1.0));
  vec3 l = s(vec2(-1.0, -1.0)), m = s(vec2(1.0, -1.0));
  vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  if (uPrefilter > 0.5) {
    float br = max(col.r, max(col.g, col.b));
    float knee = uThreshold * 0.5 + 1e-5;
    float soft = clamp(br - uThreshold + knee, 0.0, 2.0 * knee);
    soft = soft * soft / (4.0 * knee);
    float contrib = max(soft, br - uThreshold) / max(br, 1e-5);
    col *= contrib;
  }
  outColor = vec4(max(col, 0.0), 1.0);
}
`;

const UP_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tLow;   // coarser, already accumulated level
uniform sampler2D tHigh;  // this level's downsample
uniform vec2 uTexel;      // 1 / coarse size
uniform float uRadius;
in vec2 vUv;
out vec4 outColor;
vec3 s(vec2 o) { return texture(tLow, vUv + o * uTexel).rgb; }
void main() {
  // 9-tap tent upsample.
  vec3 up = s(vec2(0.0)) * 4.0
    + (s(vec2(-1.0, 0.0)) + s(vec2(1.0, 0.0)) + s(vec2(0.0, -1.0)) + s(vec2(0.0, 1.0))) * 2.0
    + s(vec2(-1.0, -1.0)) + s(vec2(1.0, -1.0)) + s(vec2(-1.0, 1.0)) + s(vec2(1.0, 1.0));
  up *= 1.0 / 16.0;
  outColor = vec4(texture(tHigh, vUv).rgb + up * uRadius, 1.0);
}
`;

const COMPOSITE_FRAG = /* glsl */ `
precision highp float;
precision highp int;
uniform sampler2D tHDR;
uniform sampler2D tBloom;
uniform float uBloomStrength;
uniform float uExposure;
uniform float uGrain;
uniform float uPureBlack;
uniform float uFrame;
in vec2 vUv;
out vec4 outColor;
${HASH}

// ACES fitted (Stephen Hill): sRGB→AP1-ish input matrix, RRT+ODT fit, output matrix.
const mat3 ACESIn = mat3(
  0.59719, 0.07600, 0.02840,
  0.35458, 0.90834, 0.13383,
  0.04823, 0.01566, 0.83777);
const mat3 ACESOut = mat3(
  1.60475, -0.10208, -0.00327,
  -0.53108, 1.10813, -0.07276,
  -0.07367, -0.00605, 1.07602);
vec3 RRTAndODTFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 aces(vec3 c) {
  c = ACESIn * c;
  c = RRTAndODTFit(c);
  c = ACESOut * c;
  return clamp(c, 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec3 hdr = texture(tHDR, vUv).rgb + texture(tBloom, vUv).rgb * uBloomStrength;
  hdr = max(hdr, 0.0) * uExposure;
  if (uPureBlack > 0.5) {
    // Linear black floor: bloom tails below this never reach a visible code value.
    hdr = max(hdr - 0.00012, 0.0);
  }
  vec3 c = toSRGB(aces(hdr));

  uvec3 seed = uvec3(uvec2(gl_FragCoord.xy), uint(uFrame) + 7u);
  vec3 r1 = hash33u(seed);
  vec3 r2 = hash33u(seed + uvec3(0u, 0u, 104729u));

  float signal = max(c.r, max(c.g, c.b));
  if (uGrain > 0.0 && uPureBlack < 0.5) {
    // Monochrome film grain, ~uGrain amplitude, slightly weaker in deep shadow.
    float g = (r1.x + r1.y - 1.0);
    c += g * uGrain * (0.55 + 0.45 * smoothstep(0.0, 0.25, signal));
  }
  // TPDF dither, ±1/255.
  vec3 dither = (r1 - r2) / 255.0;
  if (uPureBlack > 0.5) {
    dither *= smoothstep(0.6 / 255.0, 3.0 / 255.0, signal);
  }
  c += dither;
  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

const makeTarget = (w: number, h: number, depth: boolean, samples = 0) =>
  new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: depth,
    stencilBuffer: false,
    samples,
    generateMipmaps: false,
    colorSpace: THREE.LinearSRGBColorSpace,
  });

export class FullScreenQuad {
  mesh: THREE.Mesh;
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  constructor(material?: THREE.Material) {
    const geo = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.frustumCulled = false;
  }
  render(gl: THREE.WebGLRenderer, material: THREE.Material) {
    this.mesh.material = material;
    gl.render(this.mesh, this.camera);
  }
  dispose() {
    this.mesh.geometry.dispose();
  }
}

export const rawMat = (
  fragmentShader: string,
  uniforms: Record<string, THREE.IUniform>,
  extra: Partial<THREE.ShaderMaterialParameters> = {},
  vertexShader = VERT,
) =>
  new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader,
    fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
    ...extra,
  });

export class PostPipeline {
  hdr: THREE.WebGLRenderTarget;
  down: THREE.WebGLRenderTarget[] = [];
  up: THREE.WebGLRenderTarget[] = [];
  quad = new FullScreenQuad();
  downMat = rawMat(DOWN_FRAG, {
    tSrc: { value: null },
    uTexel: { value: new THREE.Vector2() },
    uThreshold: { value: 0 },
    uPrefilter: { value: 0 },
  });
  upMat = rawMat(UP_FRAG, {
    tLow: { value: null },
    tHigh: { value: null },
    uTexel: { value: new THREE.Vector2() },
    uRadius: { value: 1 },
  });
  compMat = rawMat(COMPOSITE_FRAG, {
    tHDR: { value: null },
    tBloom: { value: null },
    uBloomStrength: { value: 1 },
    uExposure: { value: 1 },
    uGrain: { value: 0 },
    uPureBlack: { value: 0 },
    uFrame: { value: 0 },
  });
  width = 0;
  height = 0;

  constructor(
    w: number,
    h: number,
    private samples = 0,
  ) {
    this.hdr = makeTarget(1, 1, true, samples);
    this.setSize(w, h);
  }

  setSize(w: number, h: number) {
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.hdr.dispose();
    this.down.forEach((t) => t.dispose());
    this.up.forEach((t) => t.dispose());
    this.hdr = makeTarget(w, h, true, this.samples);
    this.down = [];
    this.up = [];
    // Fixed level count: every level covers the same fraction of the screen at
    // any output resolution, so bloom looks identical at 1080p, 4K and 6K.
    let lw = w;
    let lh = h;
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      lw = Math.max(1, Math.round(lw / 2));
      lh = Math.max(1, Math.round(lh / 2));
      this.down.push(makeTarget(lw, lh, false));
      this.up.push(makeTarget(lw, lh, false));
    }
  }

  /** Bind & clear the HDR target. The look draws into it after this. */
  beginHDR(gl: THREE.WebGLRenderer, clear = new THREE.Color(0, 0, 0)) {
    gl.setRenderTarget(this.hdr);
    gl.setClearColor(clear, 1);
    gl.clear(true, true, true);
  }

  finish(gl: THREE.WebGLRenderer, frame: number, s: PostSettings) {
    // Downsample chain.
    let src: THREE.WebGLRenderTarget = this.hdr;
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      const dst = this.down[i];
      this.downMat.uniforms.tSrc.value = src.texture;
      this.downMat.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      this.downMat.uniforms.uPrefilter.value = i === 0 ? 1 : 0;
      this.downMat.uniforms.uThreshold.value = s.bloomThreshold;
      gl.setRenderTarget(dst);
      this.quad.render(gl, this.downMat);
      src = dst;
    }
    // Upsample + accumulate.
    let low: THREE.WebGLRenderTarget = this.down[BLOOM_LEVELS - 1];
    for (let i = BLOOM_LEVELS - 2; i >= 0; i--) {
      const dst = this.up[i];
      this.upMat.uniforms.tLow.value = low.texture;
      this.upMat.uniforms.tHigh.value = this.down[i].texture;
      this.upMat.uniforms.uTexel.value.set(1 / low.width, 1 / low.height);
      this.upMat.uniforms.uRadius.value = s.bloomRadius;
      gl.setRenderTarget(dst);
      this.quad.render(gl, this.upMat);
      low = dst;
    }
    // Composite to the canvas.
    const u = this.compMat.uniforms;
    u.tHDR.value = this.hdr.texture;
    u.tBloom.value = low.texture;
    u.uBloomStrength.value = s.bloomStrength / BLOOM_LEVELS;
    u.uExposure.value = s.exposure;
    u.uGrain.value = s.grain;
    u.uPureBlack.value = s.pureBlack ? 1 : 0;
    u.uFrame.value = frame;
    gl.setRenderTarget(null);
    this.quad.render(gl, this.compMat);
  }

  dispose() {
    this.hdr.dispose();
    this.down.forEach((t) => t.dispose());
    this.up.forEach((t) => t.dispose());
    this.quad.dispose();
    this.downMat.dispose();
    this.upMat.dispose();
    this.compMat.dispose();
  }
}
