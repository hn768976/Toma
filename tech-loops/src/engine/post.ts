import * as THREE from "three";
import { shaderMat } from "./material";
import { COLOR, FULLSCREEN_VERT, HASH } from "./glsl";

/**
 * Shared post chain. All passes are fixed functions of their inputs: no history
 * buffers, no TAA, no accumulation. Grain and dither hash (pixel, frame % 600).
 */
export interface PostOptions {
  /** MSAA samples for the scene target (0 when a depth texture is needed). */
  msaa: number;
  /** Attach a depth texture to the scene target (bokeh occlusion). */
  depthTexture?: boolean;
  bloomStrength: number;
  /** 0..1: how much the wide (low-res) bloom levels contribute. */
  bloomRadius: number;
  bloomThreshold: number;
  bloomKnee: number;
  exposure: number;
  vignette: number;
  /** Grain amplitude in output units (0.015 = 1.5 %). */
  grain: number;
  /** Fade grain to zero below this luminance (0 disables the fade). */
  grainDarkCut: number;
  /** How strongly over-bright colours roll off to white (default 0.12). */
  whiten?: number;
  /** Radial soft-focus toward the frame corners (0 = off). */
  cornerBlur?: number;
  /** Depth-of-field gather. The scene alpha carries signed CoC as a fraction of frame height. */
  dof?: { maxRadius: number };
}

const quadGeo = new THREE.PlaneGeometry(2, 2);

const makePass = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
  shaderMat({
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });

const DOWN_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform sampler2D tSrc;
uniform vec2 texel;
uniform float threshold;
uniform float knee;
uniform bool prefilter;
${COLOR}
vec3 tap(vec2 o) { return texture(tSrc, vUv + o * texel).rgb; }
void main() {
  // 13-tap downsample (Jimenez 2014), weighted to avoid fireflies.
  vec3 a = tap(vec2(-2, -2)), b = tap(vec2(0, -2)), c = tap(vec2(2, -2));
  vec3 d = tap(vec2(-1, -1)), e = tap(vec2(1, -1));
  vec3 f = tap(vec2(-2, 0)), g = tap(vec2(0, 0)), h = tap(vec2(2, 0));
  vec3 i = tap(vec2(-1, 1)), j = tap(vec2(1, 1));
  vec3 k = tap(vec2(-2, 2)), l = tap(vec2(0, 2)), m = tap(vec2(2, 2));
  vec3 col = (d + e + i + j) * 0.125;
  col += (a + b + g + f) * 0.03125;
  col += (b + c + h + g) * 0.03125;
  col += (f + g + l + k) * 0.03125;
  col += (g + h + m + l) * 0.03125;
  if (prefilter) {
    float br = max(col.r, max(col.g, col.b));
    float rq = clamp(br - threshold + knee, 0.0, 2.0 * knee);
    rq = rq * rq / (4.0 * knee + 1e-5);
    float w = max(rq, br - threshold) / max(br, 1e-5);
    col *= w;
    col = min(col, vec3(60.0));
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

const UP_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform sampler2D tLow;
uniform sampler2D tCur;
uniform vec2 texel;
uniform float weight;
vec3 tap(vec2 o) { return texture(tLow, vUv + o * texel).rgb; }
void main() {
  vec3 s = tap(vec2(-1, -1)) + tap(vec2(1, -1)) + tap(vec2(-1, 1)) + tap(vec2(1, 1));
  s += 2.0 * (tap(vec2(0, -1)) + tap(vec2(0, 1)) + tap(vec2(-1, 0)) + tap(vec2(1, 0)));
  s += 4.0 * tap(vec2(0, 0));
  gl_FragColor = vec4(texture(tCur, vUv).rgb + s / 16.0 * weight, 1.0);
}
`;

const COPY_DOWN_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform sampler2D tSrc;
uniform vec2 texel;
void main() {
  vec4 s = texture(tSrc, vUv + texel * vec2(-0.5, -0.5));
  s += texture(tSrc, vUv + texel * vec2(0.5, -0.5));
  s += texture(tSrc, vUv + texel * vec2(-0.5, 0.5));
  s += texture(tSrc, vUv + texel * vec2(0.5, 0.5));
  gl_FragColor = s * 0.25;
}
`;

// Depth-of-field gather at half resolution. Each sample is accepted when its own
// circle of confusion reaches the pixel (scatter-as-gather), weighted by 1/area.
const DOF_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform sampler2D tSrc;      // half-res: rgb, a = signed CoC (fraction of frame height)
uniform vec2 resolution;     // half-res size in px
uniform float maxRadius;     // fraction of frame height
#define N 64
void main() {
  float H = resolution.y;
  vec4 c0 = texture(tSrc, vUv);
  float r0 = abs(c0.a) * H;
  float Rmax = maxRadius * H;
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  const float GA = 2.39996323;
  for (int i = 0; i < N; i++) {
    float fi = float(i) + 0.5;
    float rr = sqrt(fi / float(N)) * Rmax;
    float th = fi * GA;
    vec2 o = vec2(cos(th), sin(th)) * rr;
    vec4 s = texture(tSrc, vUv + o / resolution);
    float rs = abs(s.a) * H;
    // Background samples may not bleed over a sharper foreground pixel.
    float sr = (s.a > c0.a) ? min(rs, r0) : rs;
    float cover = clamp(sr - rr + 1.0, 0.0, 1.0);
    float w = cover / max(rs * rs, 1.0);
    acc += s.rgb * w;
    wsum += w;
  }
  vec3 col = wsum > 0.0 ? acc / wsum : c0.rgb;
  gl_FragColor = vec4(col, c0.a);
}
`;

const DOF_MERGE_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform sampler2D tSharp;
uniform sampler2D tBlur;
uniform vec2 resolution;
void main() {
  vec4 s = texture(tSharp, vUv);
  vec4 b = texture(tBlur, vUv);
  float r = max(abs(s.a), abs(b.a)) * resolution.y;
  float k = smoothstep(0.6, 2.2, r);
  gl_FragColor = vec4(mix(s.rgb, b.rgb, k), s.a);
}
`;

const FINAL_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform sampler2D tSoft;
uniform float bloomStrength;
uniform float exposure;
uniform float vignette;
uniform float grain;
uniform float grainDarkCut;
uniform float cornerBlur;
uniform float whiten;
uniform float frame;
uniform vec2 resolution;
${HASH}
${COLOR}
vec3 tonemap(vec3 c) {
  // Exponential shoulder, then a little white roll-off so hot cores go white.
  vec3 t = 1.0 - exp(-c);
  float over = max(max(c.r, max(c.g, c.b)) - 1.0, 0.0);
  return mix(t, vec3(1.0), clamp(over * whiten, 0.0, 0.6));
}
void main() {
  vec3 col = texture(tScene, vUv).rgb;
  if (cornerBlur > 0.0) {
    vec2 q = (vUv - 0.5) * vec2(resolution.x / resolution.y, 1.0);
    float m = smoothstep(0.35, 1.0, length(q * vec2(0.9, 1.25))) * cornerBlur;
    col = mix(col, texture(tSoft, vUv).rgb, clamp(m, 0.0, 1.0));
  }
  col += texture(tBloom, vUv).rgb * bloomStrength;
  col *= exposure;
  vec2 v = (vUv - 0.5) * vec2(resolution.x / resolution.y, 1.0) * 1.0;
  float vig = 1.0 - vignette * smoothstep(0.25, 1.15, dot(v, v) * 1.6);
  col *= vig;
  col = tonemap(col);
  vec3 srgb = linearToSrgb(col);
  uvec2 px = uvec2(gl_FragCoord.xy);
  uint f = uint(mod(frame, 600.0));
  float L = luma(col);
  float gfade = grainDarkCut > 0.0 ? smoothstep(grainDarkCut * 0.5, grainDarkCut * 1.6, L) : 1.0;
  float g = hash1(uvec3(px, f)) + hash1(uvec3(px + 7919u, f + 613u)) - 1.0; // triangular, [-1,1]
  srgb += g * grain * gfade;
  // +-1/255 triangular dither before 8-bit quantisation.
  float d = hash1(uvec3(px + 104729u, f + 1291u)) + hash1(uvec3(px + 15485863u, f + 337u)) - 1.0;
  srgb += d / 255.0;
  gl_FragColor = vec4(srgb, 1.0);
}
`;

export class Post {
  readonly gl: THREE.WebGLRenderer;
  readonly opts: PostOptions;
  w = 0;
  h = 0;
  scene!: THREE.WebGLRenderTarget;
  /** Output of DoF (or the scene RT when DoF is off). Looks may draw into it after DoF (bokeh). */
  dofOut!: THREE.WebGLRenderTarget;
  private dofHalf!: THREE.WebGLRenderTarget;
  private dofHalfBlur!: THREE.WebGLRenderTarget;
  private down: THREE.WebGLRenderTarget[] = [];
  private up: THREE.WebGLRenderTarget[] = [];
  private soft: THREE.WebGLRenderTarget[] = [];
  private mesh = new THREE.Mesh(quadGeo);
  private cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quadScene = new THREE.Scene();
  private downMat = makePass(DOWN_FRAG, {
    tSrc: { value: null },
    texel: { value: new THREE.Vector2() },
    threshold: { value: 1 },
    knee: { value: 0.5 },
    prefilter: { value: false },
  });
  private upMat = makePass(UP_FRAG, {
    tLow: { value: null },
    tCur: { value: null },
    texel: { value: new THREE.Vector2() },
    weight: { value: 1 },
  });
  private copyDownMat = makePass(COPY_DOWN_FRAG, {
    tSrc: { value: null },
    texel: { value: new THREE.Vector2() },
  });
  private dofMat = makePass(DOF_FRAG, {
    tSrc: { value: null },
    resolution: { value: new THREE.Vector2() },
    maxRadius: { value: 0.03 },
  });
  private dofMergeMat = makePass(DOF_MERGE_FRAG, {
    tSharp: { value: null },
    tBlur: { value: null },
    resolution: { value: new THREE.Vector2() },
  });
  finalMat = makePass(FINAL_FRAG, {
    tScene: { value: null },
    tBloom: { value: null },
    tSoft: { value: null },
    bloomStrength: { value: 1 },
    exposure: { value: 1 },
    vignette: { value: 0 },
    grain: { value: 0.015 },
    grainDarkCut: { value: 0 },
    cornerBlur: { value: 0 },
    whiten: { value: 0.12 },
    frame: { value: 0 },
    resolution: { value: new THREE.Vector2() },
  });

  constructor(gl: THREE.WebGLRenderer, opts: PostOptions) {
    this.gl = gl;
    this.opts = opts;
    this.quadScene.add(this.mesh);
    this.mesh.frustumCulled = false;
  }

  private rt(w: number, h: number, extra: Partial<THREE.RenderTargetOptions> = {}) {
    return new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      generateMipmaps: false,
      colorSpace: THREE.LinearSRGBColorSpace,
      ...extra,
    });
  }

  /** (Re)allocate targets for the current drawing-buffer size. Returns [w, h]. */
  ensureSize(): [number, number] {
    const v = this.gl.getDrawingBufferSize(new THREE.Vector2());
    const w = Math.round(v.x);
    const h = Math.round(v.y);
    if (w === this.w && h === this.h) return [w, h];
    this.disposeTargets();
    this.w = w;
    this.h = h;
    this.scene = this.rt(w, h, {
      depthBuffer: true,
      samples: this.opts.msaa,
      ...(this.opts.depthTexture ? { depthTexture: new THREE.DepthTexture(w, h, THREE.UnsignedIntType) } : {}),
    });
    if (this.opts.dof) {
      this.dofHalf = this.rt(w >> 1, h >> 1);
      this.dofHalfBlur = this.rt(w >> 1, h >> 1);
      this.dofOut = this.rt(w, h);
    } else {
      this.dofOut = this.scene;
    }
    let lw = w;
    let lh = h;
    for (let i = 0; i < 7; i++) {
      lw = Math.max(1, lw >> 1);
      lh = Math.max(1, lh >> 1);
      this.down.push(this.rt(lw, lh));
      this.up.push(this.rt(lw, lh));
    }
    if (this.opts.cornerBlur) {
      this.soft.push(this.rt(w >> 1, h >> 1), this.rt(w >> 2, h >> 2), this.rt(w >> 3, h >> 3));
    }
    return [w, h];
  }

  blit(mat: THREE.Material, target: THREE.WebGLRenderTarget | null) {
    this.mesh.material = mat;
    this.gl.setRenderTarget(target);
    this.gl.render(this.quadScene, this.cam);
  }

  /** Bind the scene target and clear it. */
  beginScene(clear: THREE.Color, clearAlpha = 1) {
    this.gl.setRenderTarget(this.scene);
    this.gl.setClearColor(clear, clearAlpha);
    this.gl.clear(true, true, false);
  }

  /** Run DoF (if enabled) from the scene target into dofOut. */
  runDof() {
    if (!this.opts.dof) return;
    const { w, h } = this;
    this.copyDownMat.uniforms.tSrc.value = this.scene.texture;
    this.copyDownMat.uniforms.texel.value.set(1 / w, 1 / h);
    this.blit(this.copyDownMat, this.dofHalf);
    this.dofMat.uniforms.tSrc.value = this.dofHalf.texture;
    this.dofMat.uniforms.resolution.value.set(this.dofHalf.width, this.dofHalf.height);
    this.dofMat.uniforms.maxRadius.value = this.opts.dof.maxRadius;
    this.blit(this.dofMat, this.dofHalfBlur);
    this.dofMergeMat.uniforms.tSharp.value = this.scene.texture;
    this.dofMergeMat.uniforms.tBlur.value = this.dofHalfBlur.texture;
    this.dofMergeMat.uniforms.resolution.value.set(w, h);
    this.blit(this.dofMergeMat, this.dofOut);
  }

  /** Bloom + corner soften + tonemap + grain + dither, to the canvas. */
  finish(frame: number, src: THREE.WebGLRenderTarget = this.dofOut) {
    const o = this.opts;
    // Bloom pyramid.
    let prev = src.texture;
    let pw = src.width;
    let ph = src.height;
    for (let i = 0; i < this.down.length; i++) {
      const u = this.downMat.uniforms;
      u.tSrc.value = prev;
      u.texel.value.set(1 / pw, 1 / ph);
      u.prefilter.value = i === 0;
      u.threshold.value = o.bloomThreshold;
      u.knee.value = o.bloomKnee;
      this.blit(this.downMat, this.down[i]);
      prev = this.down[i].texture;
      pw = this.down[i].width;
      ph = this.down[i].height;
    }
    const n = this.down.length;
    let low = this.down[n - 1];
    for (let i = n - 2; i >= 0; i--) {
      const u = this.upMat.uniforms;
      u.tLow.value = low.texture;
      u.tCur.value = this.down[i].texture;
      u.texel.value.set(1 / low.width, 1 / low.height);
      u.weight.value = 0.35 + 0.65 * o.bloomRadius;
      this.blit(this.upMat, this.up[i]);
      low = this.up[i];
    }
    // Corner softening source.
    if (o.cornerBlur) {
      let s = src.texture;
      let sw = src.width;
      let sh = src.height;
      for (const t of this.soft) {
        this.downMat.uniforms.tSrc.value = s;
        this.downMat.uniforms.texel.value.set(1 / sw, 1 / sh);
        this.downMat.uniforms.prefilter.value = false;
        this.blit(this.downMat, t);
        s = t.texture;
        sw = t.width;
        sh = t.height;
      }
    }
    const f = this.finalMat.uniforms;
    f.tScene.value = src.texture;
    f.tBloom.value = this.up[0].texture;
    f.tSoft.value = o.cornerBlur ? this.soft[this.soft.length - 1].texture : src.texture;
    f.bloomStrength.value = o.bloomStrength;
    f.exposure.value = o.exposure;
    f.vignette.value = o.vignette;
    f.grain.value = o.grain;
    f.grainDarkCut.value = o.grainDarkCut;
    f.cornerBlur.value = o.cornerBlur ?? 0;
    f.whiten.value = o.whiten ?? 0.12;
    f.frame.value = frame;
    f.resolution.value.set(this.w, this.h);
    this.blit(this.finalMat, null);
  }

  private disposeTargets() {
    this.scene?.depthTexture?.dispose();
    this.scene?.dispose();
    if (this.opts.dof) {
      this.dofHalf?.dispose();
      this.dofHalfBlur?.dispose();
      this.dofOut?.dispose();
    }
    for (const t of [...this.down, ...this.up, ...this.soft]) t.dispose();
    this.down = [];
    this.up = [];
    this.soft = [];
  }

  dispose() {
    this.disposeTargets();
    for (const m of [this.downMat, this.upMat, this.copyDownMat, this.dofMat, this.dofMergeMat, this.finalMat]) m.dispose();
  }
}
