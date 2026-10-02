import * as THREE from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";

/**
 * Post pipeline shared by the three.js looks.
 *
 * Depth of field ("slice DOF"): every material in these scenes is additive or
 * glow-like, so the frame can be rendered as a sum of depth slices. Each
 * fragment computes its circle of confusion from view depth and is split
 * between two neighbouring blur levels with tent weights (weights sum to 1).
 * Each level is rendered, blurred with a Gaussian of that level's radius and
 * added up. No depth buffer reconstruction, no temporal tricks: every frame is
 * a pure function of the scene state.
 *
 * Then: mip-chain bloom, soft tone curve, vignette, grain (fixed hash of pixel
 * + frame) and ±1/255 dither, written straight to the canvas.
 */

export type PostSettings = {
  /** Blur sigma per slice, in 4K pixels. First must be 0. Ascending. */
  slices: number[];
  /** Weight of each bloom mip level (1/2, 1/4, ... 1/64 res). */
  bloomWeights: number[];
  bloomThreshold: number;
  exposure: number;
  vignette: number;
  /** Grain amplitude (0.02 = 2%). */
  grain: number;
  /** Loop length used to wrap the grain seed. */
  loop: number;
  /** Optional colour lift for the darkest values (keeps blacks non-crushed). */
  lift?: [number, number, number];
};

export const dofUniforms = () => ({
  uFocus: { value: 10 },
  uAperture: { value: 40 },
  uSliceLo: { value: -1 },
  uSliceMid: { value: 0 },
  uSliceHi: { value: 1 },
  uCocMax: { value: 1 },
});
export type DofUniforms = ReturnType<typeof dofUniforms>;

/** GLSL: declare uniforms + sliceWeight(viewDepth). */
export const DOF_GLSL = /* glsl */ `
uniform float uFocus;
uniform float uAperture;
uniform float uSliceLo;
uniform float uSliceMid;
uniform float uSliceHi;
uniform float uCocMax;
float cocOf(float d) {
  return min(uAperture * abs(d - uFocus) / max(d, 1e-3), uCocMax);
}
float sliceWeight(float d) {
  float c = cocOf(d);
  float w = c <= uSliceMid
    ? (c - uSliceLo) / max(uSliceMid - uSliceLo, 1e-5)
    : (uSliceHi - c) / max(uSliceHi - uSliceMid, 1e-5);
  return clamp(w, 0.0, 1.0);
}
`;

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const copyMat = (additive: boolean) =>
  new THREE.ShaderMaterial({
    uniforms: { tSrc: { value: null }, uGain: { value: 1 } },
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      uniform sampler2D tSrc; uniform float uGain; varying vec2 vUv;
      void main() { gl_FragColor = vec4(texture2D(tSrc, vUv).rgb * uGain, 1.0); }`,
    blending: additive ? THREE.AdditiveBlending : THREE.NoBlending,
    depthTest: false,
    depthWrite: false,
    transparent: additive,
  });

const downMat = () =>
  new THREE.ShaderMaterial({
    uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 0 } },
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThreshold; varying vec2 vUv;
      void main() {
        // 4 bilinear taps = 4x4 tent footprint
        vec3 c = texture2D(tSrc, vUv + uTexel * vec2(-1.0, -1.0)).rgb
               + texture2D(tSrc, vUv + uTexel * vec2( 1.0, -1.0)).rgb
               + texture2D(tSrc, vUv + uTexel * vec2(-1.0,  1.0)).rgb
               + texture2D(tSrc, vUv + uTexel * vec2( 1.0,  1.0)).rgb;
        c *= 0.25;
        if (uThreshold > 0.0) c = max(c - vec3(uThreshold), vec3(0.0));
        gl_FragColor = vec4(c, 1.0);
      }`,
    depthTest: false,
    depthWrite: false,
  });

const gaussMat = () =>
  new THREE.ShaderMaterial({
    uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() }, uSigma: { value: 1 } },
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      uniform sampler2D tSrc; uniform vec2 uDir; uniform float uSigma; varying vec2 vUv;
      void main() {
        float s = max(uSigma, 0.3);
        int r = int(ceil(s * 3.0));
        vec3 acc = texture2D(tSrc, vUv).rgb; float wsum = 1.0;
        for (int i = 1; i <= 24; i++) {
          if (i > r) break;
          float fi = float(i);
          float w = exp(-fi * fi / (2.0 * s * s));
          acc += w * (texture2D(tSrc, vUv + uDir * fi).rgb + texture2D(tSrc, vUv - uDir * fi).rgb);
          wsum += 2.0 * w;
        }
        gl_FragColor = vec4(acc / wsum, 1.0);
      }`,
    depthTest: false,
    depthWrite: false,
  });

const finalMat = () =>
  new THREE.ShaderMaterial({
    uniforms: {
      tSrc: { value: null },
      tB0: { value: null },
      tB1: { value: null },
      tB2: { value: null },
      tB3: { value: null },
      tB4: { value: null },
      tB5: { value: null },
      uBW: { value: [0, 0, 0, 0, 0, 0] },
      uExposure: { value: 1 },
      uVignette: { value: 0 },
      uGrain: { value: 0.02 },
      uFrame: { value: 0 },
      uLift: { value: new THREE.Vector3() },
      uRes: { value: new THREE.Vector2() },
    },
    vertexShader: VERT,
    fragmentShader: /* glsl */ `
      uniform sampler2D tSrc, tB0, tB1, tB2, tB3, tB4, tB5;
      uniform float uBW[6];
      uniform float uExposure, uVignette, uGrain, uFrame;
      uniform vec3 uLift; uniform vec2 uRes;
      varying vec2 vUv;
      // integer hash -> [0,1): fixed formula of pixel + frame
      float hash3(uvec3 v) {
        v = v * 1664525u + 1013904223u;
        v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
        v ^= v >> 16u;
        v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
        return float(v.x & 0xffffffu) / 16777216.0;
      }
      void main() {
        vec3 c = texture2D(tSrc, vUv).rgb;
        c += uBW[0] * texture2D(tB0, vUv).rgb + uBW[1] * texture2D(tB1, vUv).rgb
           + uBW[2] * texture2D(tB2, vUv).rgb + uBW[3] * texture2D(tB3, vUv).rgb
           + uBW[4] * texture2D(tB4, vUv).rgb + uBW[5] * texture2D(tB5, vUv).rgb;
        c *= uExposure;
        // soft shoulder above 0.8, identity below
        vec3 k = max(c - 0.8, 0.0);
        c = min(c, 0.8) + 0.2 * (1.0 - exp(-k / 0.2));
        vec2 q = vUv - 0.5; q.x *= uRes.x / uRes.y;
        c *= 1.0 - uVignette * smoothstep(0.25, 1.05, length(q));
        c += uLift;
        uvec2 p = uvec2(gl_FragCoord.xy);
        uint f = uint(uFrame);
        float g = hash3(uvec3(p, f)) - 0.5;
        // ~uniform grain: strong enough in the darks to survive H.264 (prevents encoder banding)
        float lum = dot(c, vec3(0.299, 0.587, 0.114));
        c += g * uGrain * (0.85 + 0.3 * sqrt(clamp(lum, 0.0, 1.0)));
        // triangular dither, +-1/255
        float d = hash3(uvec3(p, f + 7919u)) + hash3(uvec3(p.yx, f + 104729u)) - 1.0;
        c += d / 255.0;
        gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
      }`,
    depthTest: false,
    depthWrite: false,
  });

const makeRT = (w: number, h: number, samples = 0, depth = false) =>
  new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: depth,
    samples,
    colorSpace: THREE.NoColorSpace,
  });

type Level = { w: number; h: number; a: THREE.WebGLRenderTarget; b: THREE.WebGLRenderTarget };

export class PostPipeline {
  readonly w: number;
  readonly h: number;
  /** render pixels per 4K pixel */
  readonly pxScale: number;
  readonly dof = dofUniforms();
  private slice: THREE.WebGLRenderTarget;
  /** reduced-size slice targets (with depth) for blurred slices */
  private sliceLv: THREE.WebGLRenderTarget[] = [];
  /** Shared by materials whose size is in pixels (lines, points): the current slice target. */
  readonly view = { uRes: { value: new THREE.Vector2(1, 1) }, uPxScale: { value: 1 } };
  private accum: THREE.WebGLRenderTarget;
  private levels: Level[] = [];
  private bloomLevels: Level[] = [];
  private quad = new FullScreenQuad();
  private mCopy = copyMat(false);
  private mAdd = copyMat(true);
  private mDown = downMat();
  private mGauss = gaussMat();
  private mFinal = finalMat();

  constructor(
    private gl: THREE.WebGLRenderer,
    w: number,
    h: number,
    public settings: PostSettings,
  ) {
    this.w = w;
    this.h = h;
    this.pxScale = h / 2160;
    this.slice = makeRT(w, h, 0, true);
    this.accum = makeRT(w, h);
    let lw = w;
    let lh = h;
    for (let i = 0; i < 7; i++) {
      lw = Math.max(1, Math.ceil(lw / 2));
      lh = Math.max(1, Math.ceil(lh / 2));
      this.levels.push({ w: lw, h: lh, a: makeRT(lw, lh), b: makeRT(lw, lh) });
      this.sliceLv.push(makeRT(lw, lh, 0, true));
      this.bloomLevels.push({ w: lw, h: lh, a: makeRT(lw, lh), b: makeRT(lw, lh) });
    }
    this.dof.uCocMax.value = settings.slices[settings.slices.length - 1];
  }

  private pass(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    this.gl.setRenderTarget(target);
    this.quad.render(this.gl);
  }

  private down(src: THREE.Texture, sw: number, sh: number, dst: THREE.WebGLRenderTarget, threshold = 0) {
    this.mDown.uniforms.tSrc.value = src;
    this.mDown.uniforms.uTexel.value.set(1 / sw, 1 / sh);
    this.mDown.uniforms.uThreshold.value = threshold;
    this.pass(this.mDown, dst);
  }

  private gauss(l: Level, sigma: number) {
    this.mGauss.uniforms.uSigma.value = sigma;
    this.mGauss.uniforms.tSrc.value = l.a.texture;
    this.mGauss.uniforms.uDir.value.set(1 / l.w, 0);
    this.pass(this.mGauss, l.b);
    this.mGauss.uniforms.tSrc.value = l.b.texture;
    this.mGauss.uniforms.uDir.value.set(0, 1 / l.h);
    this.pass(this.mGauss, l.a);
  }

  /**
   * Render one DOF slice and add it, blurred by sigma (render px), into accum.
   * Blurred slices are rendered straight into a smaller target (1/2^n size)
   * so that the remaining blur there is 1.5..3 px: much less fill, same look.
   */
  private renderSlice(scene: THREE.Scene, camera: THREE.Camera, sigma: number) {
    const gl = this.gl;
    let n = 0;
    while (n < this.levels.length && sigma / Math.pow(2, n + 1) >= 1.5) n++;
    const target = n === 0 ? this.slice : this.sliceLv[n - 1];
    const tw = n === 0 ? this.w : this.levels[n - 1].w;
    const th = n === 0 ? this.h : this.levels[n - 1].h;
    this.view.uRes.value.set(tw, th);
    this.view.uPxScale.value = this.pxScale * (th / this.h);
    gl.setRenderTarget(target);
    gl.clear(true, true, true);
    gl.render(scene, camera);
    let src: THREE.Texture = target.texture;
    if (sigma >= 0.6) {
      const rem = sigma / Math.pow(2, n);
      if (n === 0) {
        // small blur at full res
        this.gaussFull(rem);
        src = this.fullTmpA.texture;
      } else {
        const l = this.levels[n - 1];
        this.mGauss.uniforms.uSigma.value = rem;
        this.mGauss.uniforms.tSrc.value = target.texture;
        this.mGauss.uniforms.uDir.value.set(1 / l.w, 0);
        this.pass(this.mGauss, l.b);
        this.mGauss.uniforms.tSrc.value = l.b.texture;
        this.mGauss.uniforms.uDir.value.set(0, 1 / l.h);
        this.pass(this.mGauss, l.a);
        src = l.a.texture;
      }
    }
    this.mAdd.uniforms.tSrc.value = src;
    this.pass(this.mAdd, this.accum);
  }

  private fullTmpA!: THREE.WebGLRenderTarget;
  private fullTmpB!: THREE.WebGLRenderTarget;
  private gaussFull(sigma: number) {
    if (!this.fullTmpA) {
      this.fullTmpA = makeRT(this.w, this.h);
      this.fullTmpB = makeRT(this.w, this.h);
    }
    this.mGauss.uniforms.uSigma.value = sigma;
    this.mGauss.uniforms.tSrc.value = this.slice.texture;
    this.mGauss.uniforms.uDir.value.set(1 / this.w, 0);
    this.pass(this.mGauss, this.fullTmpB);
    this.mGauss.uniforms.tSrc.value = this.fullTmpB.texture;
    this.mGauss.uniforms.uDir.value.set(0, 1 / this.h);
    this.pass(this.mGauss, this.fullTmpA);
  }

  render(scene: THREE.Scene, camera: THREE.Camera, frame: number) {
    const gl = this.gl;
    const s = this.settings;
    gl.autoClear = false;
    gl.setClearColor(0x000000, 1);
    gl.setRenderTarget(this.accum);
    gl.clear(true, true, true);
    const L = s.slices;
    for (let k = 0; k < L.length; k++) {
      this.dof.uSliceLo.value = k === 0 ? -1 : L[k - 1];
      this.dof.uSliceMid.value = L[k];
      this.dof.uSliceHi.value = k === L.length - 1 ? L[k] + 1 : L[k + 1];
      this.renderSlice(scene, camera, L[k] * this.pxScale);
    }
    // bloom mip chain
    let src: THREE.Texture = this.accum.texture;
    let sw = this.w;
    let sh = this.h;
    for (let i = 0; i < 6; i++) {
      const l = this.bloomLevels[i];
      this.down(src, sw, sh, l.a, i === 0 ? s.bloomThreshold : 0);
      src = l.a.texture;
      sw = l.w;
      sh = l.h;
    }
    for (let i = 0; i < 6; i++) {
      if (s.bloomWeights[i] > 0) this.gauss(this.bloomLevels[i], 1.6);
    }
    const u = this.mFinal.uniforms;
    u.tSrc.value = this.accum.texture;
    for (let i = 0; i < 6; i++) (u as Record<string, THREE.IUniform>)[`tB${i}`].value = this.bloomLevels[i].a.texture;
    u.uBW.value = [0, 1, 2, 3, 4, 5].map((i) => s.bloomWeights[i] ?? 0);
    u.uExposure.value = s.exposure;
    u.uVignette.value = s.vignette;
    u.uGrain.value = s.grain;
    u.uFrame.value = ((frame % s.loop) + s.loop) % s.loop;
    u.uLift.value.set(...(s.lift ?? [0, 0, 0]));
    u.uRes.value.set(this.w, this.h);
    gl.setRenderTarget(null);
    gl.setViewport(0, 0, this.w / gl.getPixelRatio(), this.h / gl.getPixelRatio());
    this.pass(this.mFinal, null);
    void this.mCopy;
  }

  dispose() {
    this.slice.dispose();
    this.accum.dispose();
    for (const t of this.sliceLv) t.dispose();
    this.fullTmpA?.dispose();
    this.fullTmpB?.dispose();
    for (const l of [...this.levels, ...this.bloomLevels]) {
      l.a.dispose();
      l.b.dispose();
    }
    this.quad.dispose();
    for (const m of [this.mCopy, this.mAdd, this.mDown, this.mGauss, this.mFinal]) m.dispose();
  }
}
