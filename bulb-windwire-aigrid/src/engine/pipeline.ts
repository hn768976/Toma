import {
  Camera,
  FloatType,
  GLSL3,
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  Material,
  Mesh,
  NearestFilter,
  NoBlending,
  Object3D,
  OrthographicCamera,
  PlaneGeometry,
  RawShaderMaterial,
  RGBAFormat,
  Scene,
  Vector2,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import type { RGB } from "./color";

// ---------------------------------------------------------------------------
// Full-screen pass helper
// ---------------------------------------------------------------------------

const quadGeom = new PlaneGeometry(2, 2);
const quadCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

const FS_VERT = /* glsl */ `
in vec3 position;
out vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export class Pass {
  mat: RawShaderMaterial;
  private scene = new Scene();
  constructor(frag: string, uniforms: Record<string, { value: unknown }>, defines: Record<string, string | number> = {}) {
    this.mat = new RawShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: "precision highp float;\n" + FS_VERT,
      fragmentShader: "precision highp float;\nprecision highp int;\n" + frag,
      uniforms,
      defines,
      depthTest: false,
      depthWrite: false,
      blending: NoBlending,
    });
    const m = new Mesh(quadGeom, this.mat);
    m.frustumCulled = false;
    this.scene.add(m);
  }
  get u() {
    return this.mat.uniforms;
  }
  draw(gl: WebGLRenderer, target: WebGLRenderTarget | null) {
    gl.setRenderTarget(target);
    gl.render(this.scene, quadCam);
  }
  dispose() {
    this.mat.dispose();
  }
}

// ---------------------------------------------------------------------------
// Shared GLSL
// ---------------------------------------------------------------------------

export const GLSL_COMMON = /* glsl */ `
vec3 srgbToLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 linearToSrgb(vec3 c) { c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
// PCG 3D hash (Jarzynski & Olano). Integer-only, identical on every GPU.
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
vec3 hash3(uvec3 v) { return vec3(pcg3d(v)) * (1.0 / 4294967296.0); }
`;

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------

// Plain (optionally lod-biased) copy. Used to make the half-res mipmapped copy.
const COPY_FRAG = /* glsl */ `
uniform sampler2D uSrc;
in vec2 vUv; out vec4 o;
void main() {
  // 4 bilinear taps = 4x4 box at 2x downsample.
  vec2 t = 1.0 / vec2(textureSize(uSrc, 0));
  vec4 c = texture(uSrc, vUv + t * vec2(-0.5, -0.5)) + texture(uSrc, vUv + t * vec2(0.5, -0.5))
         + texture(uSrc, vUv + t * vec2(-0.5, 0.5)) + texture(uSrc, vUv + t * vec2(0.5, 0.5));
  o = vec4(c.rgb * 0.25, 1.0);
}
`;

// 13-tap "Call of Duty" downsample. uLod lets the first level read a coarser mip.
const DOWN_FRAG = /* glsl */ `
uniform sampler2D uSrc; uniform float uLod;
in vec2 vUv; out vec4 o;
vec3 s(vec2 off) { return textureLod(uSrc, vUv + off, uLod).rgb; }
void main() {
  vec2 t = exp2(uLod) / vec2(textureSize(uSrc, 0));
  vec3 a = s(t * vec2(-2, 2)), b = s(t * vec2(0, 2)), c = s(t * vec2(2, 2));
  vec3 d = s(t * vec2(-2, 0)), e = s(vec2(0)), f = s(t * vec2(2, 0));
  vec3 g = s(t * vec2(-2, -2)), h = s(t * vec2(0, -2)), i = s(t * vec2(2, -2));
  vec3 j = s(t * vec2(-1, 1)), k = s(t * vec2(1, 1)), l = s(t * vec2(-1, -1)), m = s(t * vec2(1, -1));
  vec3 r = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  o = vec4(r, 1.0);
}
`;

// 3x3 tent upsample of the coarser level, added to this level.
const UP_FRAG = /* glsl */ `
uniform sampler2D uCoarse; uniform sampler2D uFine; uniform float uFineWeight;
in vec2 vUv; out vec4 o;
void main() {
  vec2 t = 1.0 / vec2(textureSize(uCoarse, 0));
  vec3 r = texture(uCoarse, vUv).rgb * 4.0;
  r += (texture(uCoarse, vUv + t * vec2(-1, 0)).rgb + texture(uCoarse, vUv + t * vec2(1, 0)).rgb
      + texture(uCoarse, vUv + t * vec2(0, -1)).rgb + texture(uCoarse, vUv + t * vec2(0, 1)).rgb) * 2.0;
  r += texture(uCoarse, vUv + t * vec2(-1, -1)).rgb + texture(uCoarse, vUv + t * vec2(1, -1)).rgb
     + texture(uCoarse, vUv + t * vec2(-1, 1)).rgb + texture(uCoarse, vUv + t * vec2(1, 1)).rgb;
  o = vec4(r / 16.0 + texture(uFine, vUv).rgb * uFineWeight, 1.0);
}
`;

const COC_GLSL = /* glsl */ `
uniform float uFocus, uAperture, uMaxCoc, uFullH;
// Circle of confusion radius in FULL-resolution pixels (thin lens, scaled to frame height).
float cocPx(float z) { return min(uAperture * abs(z - uFocus) / max(z, 1e-3), uMaxCoc) * uFullH; }
`;

// Max CoC per 16x16 tile (sparse 4x4 sample of the footprint).
const TILE_FRAG = /* glsl */ `
${COC_GLSL}
uniform sampler2D uDepth;
in vec2 vUv; out vec4 o;
void main() {
  vec2 ts = 1.0 / vec2(textureSize(uDepth, 0));
  float m = 0.0;
  for (int y = 0; y < 4; y++) for (int x = 0; x < 4; x++) {
    vec2 off = (vec2(x, y) * 4.0 - 6.0) * ts;
    m = max(m, cocPx(texture(uDepth, vUv + off).r));
  }
  o = vec4(m, 0, 0, 1);
}
`;

const DILATE_FRAG = /* glsl */ `
uniform sampler2D uTile;
in vec2 vUv; out vec4 o;
void main() {
  vec2 ts = 1.0 / vec2(textureSize(uTile, 0));
  float m = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) m = max(m, texture(uTile, vUv + vec2(x, y) * ts).r);
  o = vec4(m, 0, 0, 1);
}
`;

// Scatter-as-gather DoF at half resolution. A sample contributes to this pixel
// if its own blur disc covers it; samples behind this pixel may not spread
// further than this pixel's own blur. Large discs read coarser mips so the
// fixed sample count never undersamples thin lines.
const GATHER_FRAG = /* glsl */ `
${COC_GLSL}
uniform sampler2D uColor; // half-res, mipmapped
uniform sampler2D uDepth; // full-res view depth
uniform sampler2D uTile;  // dilated tile max CoC (full-res px)
in vec2 vUv; out vec4 o;
const int N = 56;
void main() {
  vec2 halfRes = vec2(textureSize(uColor, 0));
  float zp = texture(uDepth, vUv).r;
  float cp = cocPx(zp) * 0.5;               // in half-res px
  float R = max(texture(uTile, vUv).r * 0.5, cp);
  if (R < 0.6) { o = vec4(textureLod(uColor, vUv, 0.0).rgb, cp); return; }
  float spacing = R * 1.7725 / sqrt(float(N));
  float lod = max(0.0, log2(spacing));
  float w0 = 1.0 / max(cp * cp, 1.0);
  vec3 sum = textureLod(uColor, vUv, max(0.0, log2(max(cp, 1.0)) - 0.5)).rgb * w0;
  float wsum = w0, csum = w0 * cp;
  for (int i = 0; i < N; i++) {
    float fi = float(i) + 0.5;
    float r = sqrt(fi / float(N)) * R;
    float a = fi * 2.39996323;
    vec2 quv = vUv + r * vec2(cos(a), sin(a)) / halfRes;
    float zq = texture(uDepth, quv).r;
    float cq = cocPx(zq) * 0.5;
    if (zq > zp) cq = min(cq, cp);
    float cover = clamp(cq - r + spacing * 0.5 + 0.5, 0.0, 1.0);
    float w = cover / max(cq * cq, 1.0);
    sum += textureLod(uColor, quv, lod).rgb * w;
    wsum += w; csum += w * cq;
  }
  o = vec4(sum / wsum, csum / wsum);
}
`;

const DEPTH_CLEAR_FRAG = /* glsl */ `
uniform float uFar; out vec4 o; in vec2 vUv;
void main() { o = vec4(uFar, 0, 0, 1); }
`;

/** Per-look composite hooks, all GLSL. `background(uv)` returns sRGB. */
export type CompositeHooks = {
  background: string; // vec3 background(vec2 uv)
  extraUniforms?: Record<string, { value: unknown }>;
};

const makeCompositeFrag = (hooks: CompositeHooks) => /* glsl */ `
${GLSL_COMMON}
uniform sampler2D uScene, uBlur, uBloom;
uniform float uUseDof, uBloomStrength, uExposure, uVignette, uGrain, uDither, uAspect;
uniform float uGrainFrame;
uniform vec2 uFlarePos; uniform vec3 uFlareColor; uniform float uFlareIntensity, uFlareStreak;
uniform vec3 uBloomTint;
in vec2 vUv; out vec4 o;
${hooks.background}

vec3 flare(vec2 uv) {
  if (uFlareIntensity <= 0.0) return vec3(0);
  vec2 d = (uv - uFlarePos) * vec2(uAspect, 1.0);
  float r = length(d);
  float core = exp(-r * r / 0.0003) * 3.5 + exp(-r * r / 0.006) * 0.55 + exp(-r / 0.1) * 0.12;
  // Horizontal anamorphic streak: thin and long, plus a softer wide one.
  float streak = exp(-d.y * d.y / 0.00003) * exp(-abs(d.x) / (0.1 * uFlareStreak)) * 0.9
               + exp(-d.y * d.y / 0.0009) * exp(-abs(d.x) / (0.08 * uFlareStreak)) * 0.4;
  // Two faint ghosts mirrored through the frame centre.
  vec2 g1 = (uv - (vec2(0.5) + (vec2(0.5) - uFlarePos) * 0.55)) * vec2(uAspect, 1.0);
  vec2 g2 = (uv - (vec2(0.5) + (vec2(0.5) - uFlarePos) * 1.15)) * vec2(uAspect, 1.0);
  float ghosts = smoothstep(0.045, 0.03, length(g1)) * 0.025 + smoothstep(0.02, 0.012, length(g2)) * 0.03;
  return uFlareColor * uFlareIntensity * (core + streak + ghosts);
}

void main() {
  vec4 sc = texture(uScene, vUv);
  vec3 hdr = sc.rgb;
  if (uUseDof > 0.5) {
    vec4 b = texture(uBlur, vUv);
    float t = smoothstep(0.35, 1.0, b.a); // b.a = blur radius in half-res px
    hdr = mix(hdr, b.rgb, t);
  }
  hdr += texture(uBloom, vUv).rgb * uBloomStrength * uBloomTint;
  hdr += flare(vUv);
  vec3 mapped = 1.0 - exp(-hdr * uExposure);
  vec3 bg = srgbToLinear(background(vUv));
  // Scene alpha = coverage by opaque solids, which hide the background.
  vec3 lin = bg * (1.0 - clamp(sc.a, 0.0, 1.0)) + mapped;
  // Vignette (in linear light, on everything).
  vec2 vd = (vUv - 0.5) * vec2(uAspect, 1.0);
  lin *= 1.0 - uVignette * smoothstep(0.25, 1.05, dot(vd, vd) * 1.6);
  vec3 c = linearToSrgb(lin);
  // Dither (+-1 LSB triangular) and grain from pixel position and frame only.
  vec3 h = hash3(uvec3(uvec2(gl_FragCoord.xy), uint(uGrainFrame)));
  vec3 h2 = hash3(uvec3(uvec2(gl_FragCoord.xy) + 7919u, uint(uGrainFrame) + 104729u));
  float grain = (h.x + h.y - 1.0) * uGrain;
  vec3 dither = (h2 + vec3(h.z, h2.x, h2.y) - 1.0) * uDither;
  c += grain + dither;
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export type DofParams = { focus: number; aperture: number; maxCoc: number; far: number };
export type FlareParams = { pos: [number, number]; intensity: number; color: RGB; streak?: number };

export type PipelineOptions = {
  msaa: number;
  dof: boolean;
  bloomStrength: number;
  /** Weights of bloom levels 0 (finest, 1/6 frame height... ) to 5 (coarsest). */
  bloomLevelWeights: number[];
  bloomTint?: RGB;
  exposure: number;
  vignette: number;
  grain: number; // amplitude, fraction of full scale
  composite: CompositeHooks;
};

const rt = (w: number, h: number, opts: Partial<{ samples: number; depth: boolean; float: boolean; mips: boolean; nearest: boolean }> = {}) =>
  new WebGLRenderTarget(w, h, {
    type: opts.float ? FloatType : HalfFloatType,
    format: RGBAFormat,
    depthBuffer: !!opts.depth,
    stencilBuffer: false,
    samples: opts.samples ?? 0,
    generateMipmaps: !!opts.mips,
    minFilter: opts.nearest ? NearestFilter : opts.mips ? LinearMipmapLinearFilter : LinearFilter,
    magFilter: opts.nearest ? NearestFilter : LinearFilter,
  });

const BLOOM_LEVELS = 6;
const BLOOM_BASE_H = 360;

export class Pipeline {
  private size = new Vector2();
  private targets: {
    scene: WebGLRenderTarget;
    half: WebGLRenderTarget;
    depth?: WebGLRenderTarget;
    tile?: WebGLRenderTarget;
    tile2?: WebGLRenderTarget;
    blur?: WebGLRenderTarget;
    bloomDown: WebGLRenderTarget[];
    bloomUp: WebGLRenderTarget[];
  } | null = null;
  private copy = new Pass(COPY_FRAG, { uSrc: { value: null } });
  private down = new Pass(DOWN_FRAG, { uSrc: { value: null }, uLod: { value: 0 } });
  private up = new Pass(UP_FRAG, { uCoarse: { value: null }, uFine: { value: null }, uFineWeight: { value: 1 } });
  private cocU = {
    uFocus: { value: 10 },
    uAperture: { value: 0 },
    uMaxCoc: { value: 0.02 },
    uFullH: { value: 720 },
  };
  private tile = new Pass(TILE_FRAG, { ...this.cocU, uDepth: { value: null } });
  private dilate = new Pass(DILATE_FRAG, { uTile: { value: null } });
  private gather = new Pass(GATHER_FRAG, { ...this.cocU, uColor: { value: null }, uDepth: { value: null }, uTile: { value: null } });
  private depthClear = new Pass(DEPTH_CLEAR_FRAG, { uFar: { value: 1000 } });
  composite: Pass;

  constructor(
    private gl: WebGLRenderer,
    private opts: PipelineOptions,
  ) {
    this.composite = new Pass(makeCompositeFrag(opts.composite), {
      uScene: { value: null },
      uBlur: { value: null },
      uBloom: { value: null },
      uUseDof: { value: opts.dof ? 1 : 0 },
      uBloomStrength: { value: opts.bloomStrength },
      uBloomTint: { value: opts.bloomTint ?? [1, 1, 1] },
      uExposure: { value: opts.exposure },
      uVignette: { value: opts.vignette },
      uGrain: { value: opts.grain },
      uDither: { value: 1 / 255 },
      uAspect: { value: 16 / 9 },
      uGrainFrame: { value: 0 },
      uFlarePos: { value: [0.5, 0.5] },
      uFlareColor: { value: [1, 1, 1] },
      uFlareIntensity: { value: 0 },
      uFlareStreak: { value: 1 },
      ...(opts.composite.extraUniforms ?? {}),
    });
  }

  get uniforms() {
    return this.composite.u;
  }

  private ensure() {
    const s = this.gl.getDrawingBufferSize(new Vector2());
    if (this.targets && s.equals(this.size)) return this.targets;
    this.disposeTargets();
    this.size.copy(s);
    const W = s.x,
      H = s.y;
    const hw = Math.max(1, Math.round(W / 2)),
      hh = Math.max(1, Math.round(H / 2));
    const bloomDown: WebGLRenderTarget[] = [];
    const bloomUp: WebGLRenderTarget[] = [];
    // Bloom levels have a fixed size in frame-height units, so the glow is the
    // same shape at 720p and 4K.
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      const bh = Math.max(2, Math.round(BLOOM_BASE_H / 2 ** i));
      const bw = Math.max(2, Math.round((bh * W) / H));
      bloomDown.push(rt(bw, bh));
      bloomUp.push(rt(bw, bh));
    }
    this.targets = {
      scene: rt(W, H, { samples: this.opts.msaa, depth: true }),
      half: rt(hw, hh, { mips: true }),
      bloomDown,
      bloomUp,
    };
    if (this.opts.dof) {
      this.targets.depth = rt(W, H, { depth: true, float: true, nearest: true });
      const tw = Math.ceil(W / 16),
        th = Math.ceil(H / 16);
      this.targets.tile = rt(tw, th, { nearest: true });
      this.targets.tile2 = rt(tw, th, { nearest: true });
      this.targets.blur = rt(hw, hh);
    }
    return this.targets;
  }

  /**
   * Draw one frame. `scene` is drawn additively into an HDR target over black;
   * the background is added in the composite. For the depth prepass, meshes
   * carry `userData.depthMat`; meshes without one are hidden in that pass.
   */
  render(args: { scene: Scene; camera: Camera; frame: number; grainPeriod: number; dof?: DofParams; flare?: FlareParams }) {
    const { gl } = this;
    const T = this.ensure();
    const W = this.size.x,
      H = this.size.y;

    // 1. Scene (HDR, additive content over black).
    gl.setRenderTarget(T.scene);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, true, false);
    // Depth-only meshes (e.g. an invisible table top) take part in the DoF depth pass only.
    const depthOnly: Object3D[] = [];
    args.scene.traverse((o) => {
      if (o.userData.depthOnly && o.visible) depthOnly.push(o);
    });
    depthOnly.forEach((o) => (o.visible = false));
    gl.render(args.scene, args.camera);
    depthOnly.forEach((o) => (o.visible = true));

    // 2. Half-res mipmapped copy (feeds the DoF gather and the bloom chain).
    this.copy.u.uSrc.value = T.scene.texture;
    this.copy.draw(gl, T.half);

    // 3. DoF.
    if (this.opts.dof && args.dof && T.depth && T.tile && T.tile2 && T.blur) {
      this.cocU.uFocus.value = args.dof.focus;
      this.cocU.uAperture.value = args.dof.aperture;
      this.cocU.uMaxCoc.value = args.dof.maxCoc;
      this.cocU.uFullH.value = H;
      this.depthClear.u.uFar.value = args.dof.far;
      this.depthClear.draw(gl, T.depth);
      gl.setRenderTarget(T.depth);
      gl.clear(false, true, false);
      const swapped: { m: Mesh; mat: Material | Material[] }[] = [];
      const hidden: Object3D[] = [];
      args.scene.traverseVisible((o) => {
        const m = o as Mesh;
        if (!m.isMesh && !(o as unknown as { isPoints?: boolean }).isPoints) return;
        const dm = o.userData.depthMat as Material | undefined;
        if (dm) {
          swapped.push({ m, mat: m.material });
          m.material = dm;
        } else hidden.push(o);
      });
      hidden.forEach((o) => (o.visible = false));
      gl.render(args.scene, args.camera);
      swapped.forEach(({ m, mat }) => (m.material = mat));
      hidden.forEach((o) => (o.visible = true));

      this.tile.u.uDepth.value = T.depth.texture;
      this.tile.draw(gl, T.tile);
      this.dilate.u.uTile.value = T.tile.texture;
      this.dilate.draw(gl, T.tile2);
      this.gather.u.uColor.value = T.half.texture;
      this.gather.u.uDepth.value = T.depth.texture;
      this.gather.u.uTile.value = T.tile2.texture;
      this.gather.draw(gl, T.blur);
    }

    // 4. Bloom: down chain from the half-res copy, then tent upsample.
    const halfH = T.half.height;
    this.down.u.uSrc.value = T.half.texture;
    this.down.u.uLod.value = Math.max(0, Math.log2(halfH / BLOOM_BASE_H));
    this.down.draw(gl, T.bloomDown[0]);
    for (let i = 1; i < BLOOM_LEVELS; i++) {
      this.down.u.uSrc.value = T.bloomDown[i - 1].texture;
      this.down.u.uLod.value = 0;
      this.down.draw(gl, T.bloomDown[i]);
    }
    const wts = this.opts.bloomLevelWeights;
    let coarse = T.bloomDown[BLOOM_LEVELS - 1];
    for (let i = BLOOM_LEVELS - 2; i >= 0; i--) {
      this.up.u.uCoarse.value = coarse.texture;
      this.up.u.uFine.value = T.bloomDown[i].texture;
      this.up.u.uFineWeight.value = wts[i] ?? 1;
      this.up.draw(gl, T.bloomUp[i]);
      coarse = T.bloomUp[i];
    }

    // 5. Composite to the canvas.
    const u = this.composite.u;
    u.uScene.value = T.scene.texture;
    u.uBlur.value = T.blur?.texture ?? null;
    u.uBloom.value = T.bloomUp[0].texture;
    u.uUseDof.value = this.opts.dof && args.dof ? 1 : 0;
    u.uAspect.value = W / H;
    u.uGrainFrame.value = ((args.frame % args.grainPeriod) + args.grainPeriod) % args.grainPeriod;
    if (args.flare) {
      u.uFlarePos.value = args.flare.pos;
      u.uFlareIntensity.value = args.flare.intensity;
      u.uFlareColor.value = args.flare.color;
      u.uFlareStreak.value = args.flare.streak ?? 1;
    } else u.uFlareIntensity.value = 0;
    this.composite.draw(gl, null);
    gl.setRenderTarget(null);
  }

  private disposeTargets() {
    if (!this.targets) return;
    const t = this.targets;
    [t.scene, t.half, t.depth, t.tile, t.tile2, t.blur, ...t.bloomDown, ...t.bloomUp].forEach((x) => x?.dispose());
    this.targets = null;
  }

  dispose() {
    this.disposeTargets();
    [this.copy, this.down, this.up, this.tile, this.dilate, this.gather, this.depthClear, this.composite].forEach((p) => p.dispose());
  }
}

