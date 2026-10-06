import {
  AlwaysDepth,
  Camera,
  DepthTexture,
  FloatType,
  HalfFloatType,
  TextureDataType,

  LinearFilter,
  Mesh,
  NoBlending,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { GLSL_COMMON, Shared } from "./shared";

/**
 * Deterministic post pipeline (no temporal state, nothing carried between
 * frames):
 *
 *  1. opaque scene  → A   (HDR, MSAA, depth texture)
 *  2. depth DoF(A)  → B   (HDR, MSAA) — also writes A's depth into B
 *  3. overlay scene → B   (additive light; does its own DoF in-shader,
 *                          depth-tested against the opaque geometry)
 *  4. bloom mip chain from B
 *  5. composite → screen: exposure, bloom, tonemap, grade, vignette,
 *     then grain (fixed hash of pixel + frame) and ±1/255 dither last.
 */

export interface PostSettings {
  exposure: number;
  bloomStrength: number;
  bloomRadius: number; // 0..1 blend toward wider mips
  bloomThreshold: number;
  bloomKnee: number;
  vignette: number;
  grain: number; // amplitude, fraction of full scale (0.015 = 1.5 %)
  /** Saturation multiplier after tonemapping. */
  saturation: number;
  /** Screen-space DoF on the opaque layer. */
  opaqueDof: boolean;
  /** Lift applied to blacks (linear), keeps deep shadows from crushing. */
  lift: number;
  /** Chromatic fringe strength at the frame edges (px at 1080p). */
  fringe: number;
}

export const defaultPost = (): PostSettings => ({
  exposure: 1,
  bloomStrength: 0.6,
  bloomRadius: 0.6,
  bloomThreshold: 0.6,
  bloomKnee: 0.5,
  vignette: 0.25,
  grain: 0.015,
  saturation: 1,
  opaqueDof: false,
  lift: 0,
  fringe: 0,
});

const FS_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const fsMat = (frag: string, uniforms: Record<string, { value: unknown }>) =>
  new ShaderMaterial({
    uniforms,
    vertexShader: FS_VERT,
    fragmentShader: frag,
    depthTest: false,
    depthWrite: false,
    blending: NoBlending,
  });

export class Pipeline {
  readonly gl: WebGLRenderer;
  private w = 0;
  private h = 0;
  private rtA!: WebGLRenderTarget;
  private rtB!: WebGLRenderTarget;
  private mips: WebGLRenderTarget[] = [];
  private dofMips: WebGLRenderTarget[] = [];
  private boxMat: ShaderMaterial;
  private ups: WebGLRenderTarget[] = [];
  private quad: Mesh;
  private quadScene: Scene;
  private quadCam: OrthographicCamera;
  private dofMat: ShaderMaterial;
  private downMat: ShaderMaterial;
  private upMat: ShaderMaterial;
  private compMat: ShaderMaterial;
  private shared: Shared;

  /** Float32 HDR targets where filterable (fast on software GL, which emulates
   *  half floats); half float otherwise. */
  private hdrType: TextureDataType;

  constructor(gl: WebGLRenderer, shared: Shared) {
    this.gl = gl;
    this.hdrType =
      gl.extensions.has("EXT_color_buffer_float") && gl.extensions.has("OES_texture_float_linear")
        ? FloatType
        : HalfFloatType;
    this.shared = shared;
    this.quadCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new Mesh(new PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.quadScene = new Scene();
    this.quadScene.add(this.quad);

    this.dofMat = fsMat(
      /* glsl */ `
      ${GLSL_COMMON}
      uniform sampler2D tColor;
      uniform sampler2D tC1;
      uniform sampler2D tC2;
      uniform sampler2D tDepth;
      uniform float uNear;
      uniform float uFar;
      uniform float uEnabled;
      varying vec2 vUv;
      float viewDist(float z) {
        return (uNear * uFar) / ((uFar - uNear) * z - uFar);
      }
      void main() {
        float z = texture2D(tDepth, vUv).x;
        float d = -viewDist(z);
        vec3 col = texture2D(tColor, vUv).rgb;
        if (uEnabled > 0.5) {
          float coc = cocPx(d);
          // 16-tap golden-angle disc from the quarter-res copy (one fetch per tap:
          // software GL runs every branch, so no per-tap level selection).
          float r = coc * 0.5;
          vec3 acc = texture2D(tC2, vUv).rgb;
          for (int i = 0; i < 16; i++) {
            float fi = float(i) + 0.5;
            float rr = sqrt(fi / 16.0) * r;
            float a = fi * 2.39996323;
            acc += texture2D(tC2, vUv + vec2(cos(a), sin(a)) * rr / uResolution).rgb;
          }
          acc /= 17.0;
          // mid blur: half-res copy bridges sharp → quarter
          vec3 half_ = texture2D(tC1, vUv).rgb;
          vec3 blurred = mix(half_, acc, smoothstep(2.0, 5.0, coc));
          col = mix(col, blurred, smoothstep(0.6, 2.2, coc));
        }
        gl_FragColor = vec4(col, 1.0);
        gl_FragDepth = z;
      }`,
      {
        ...shared,
        tColor: { value: null },
        tC1: { value: null },
        tC2: { value: null },
        tDepth: { value: null },
        uNear: { value: 0.1 },
        uFar: { value: 100 },
        uEnabled: { value: 0 },
      },
    );

    // 2×2 box (4 bilinear taps) downsample for the DoF pyramid.
    this.boxMat = fsMat(
      /* glsl */ `
      uniform sampler2D tSrc;
      uniform vec2 uTexel;
      varying vec2 vUv;
      void main() {
        vec3 c = texture2D(tSrc, vUv + uTexel * vec2(-0.5, -0.5)).rgb + texture2D(tSrc, vUv + uTexel * vec2(0.5, -0.5)).rgb
          + texture2D(tSrc, vUv + uTexel * vec2(-0.5, 0.5)).rgb + texture2D(tSrc, vUv + uTexel * vec2(0.5, 0.5)).rgb;
        gl_FragColor = vec4(c * 0.25, 1.0);
      }`,
      { tSrc: { value: null }, uTexel: { value: new Vector2() } },
    );

    // 13-tap (CoD) downsample with soft-knee threshold on the first level.
    this.downMat = fsMat(
      /* glsl */ `
      uniform sampler2D tSrc;
      uniform vec2 uTexel;
      uniform float uPrefilter;
      uniform float uThreshold;
      uniform float uKnee;
      varying vec2 vUv;
      vec3 s(vec2 o) { return texture2D(tSrc, vUv + o * uTexel).rgb; }
      void main() {
        vec3 a = s(vec2(-2.0, 2.0)), b = s(vec2(0.0, 2.0)), c = s(vec2(2.0, 2.0));
        vec3 d = s(vec2(-2.0, 0.0)), e = s(vec2(0.0, 0.0)), f = s(vec2(2.0, 0.0));
        vec3 g = s(vec2(-2.0, -2.0)), h = s(vec2(0.0, -2.0)), i = s(vec2(2.0, -2.0));
        vec3 j = s(vec2(-1.0, 1.0)), k = s(vec2(1.0, 1.0)), l = s(vec2(-1.0, -1.0)), m = s(vec2(1.0, -1.0));
        vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
        if (uPrefilter > 0.5) {
          float br = max(col.r, max(col.g, col.b));
          float rq = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
          rq = (rq * rq) / (4.0 * uKnee + 1e-5);
          float w = max(rq, br - uThreshold) / max(br, 1e-5);
          col *= w;
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
      {
        tSrc: { value: null },
        uTexel: { value: new Vector2() },
        uPrefilter: { value: 0 },
        uThreshold: { value: 1 },
        uKnee: { value: 0.5 },
      },
    );

    // 9-tap tent upsample, blended with the finer level.
    this.upMat = fsMat(
      /* glsl */ `
      uniform sampler2D tLow;
      uniform sampler2D tHigh;
      uniform vec2 uTexel;
      uniform float uRadius;
      varying vec2 vUv;
      vec3 s(vec2 o) { return texture2D(tLow, vUv + o * uTexel).rgb; }
      void main() {
        vec3 col = s(vec2(0.0)) * 4.0
          + (s(vec2(-1.0, 0.0)) + s(vec2(1.0, 0.0)) + s(vec2(0.0, -1.0)) + s(vec2(0.0, 1.0))) * 2.0
          + s(vec2(-1.0, -1.0)) + s(vec2(1.0, -1.0)) + s(vec2(-1.0, 1.0)) + s(vec2(1.0, 1.0));
        col /= 16.0;
        gl_FragColor = vec4(texture2D(tHigh, vUv).rgb + col * uRadius, 1.0);
      }`,
      {
        tLow: { value: null },
        tHigh: { value: null },
        uTexel: { value: new Vector2() },
        uRadius: { value: 1 },
      },
    );

    this.compMat = fsMat(
      /* glsl */ `
      uniform sampler2D tScene;
      uniform sampler2D tBloom;
      uniform vec2 uRes;
      uniform float uFrameC;
      uniform float uExposure;
      uniform float uBloom;
      uniform float uVignette;
      uniform float uGrain;
      uniform float uSat;
      uniform float uLift;
      uniform float uFringe;
      varying vec2 vUv;

      // Linear up to 0.6 (dark colours land exactly on their hex values),
      // then an exponential shoulder toward 1. Applied to max channel to keep hue.
      vec3 aces(vec3 x) {
        float m = max(max(x.r, x.g), x.b);
        float k = 0.6;
        float t = m <= k ? m : k + (1.0 - k) * (1.0 - exp(-(m - k) / (1.0 - k)));
        vec3 c = x * (t / max(m, 1e-6));
        // desaturate the very hottest values toward white, like film
        float w = smoothstep(1.2, 6.0, m);
        return mix(c, vec3(t), w * 0.6);
      }
      float toSrgb(float c) {
        return c <= 0.0031308 ? c * 12.92 : 1.055 * pow(c, 1.0 / 2.4) - 0.055;
      }
      // Integer hash (pcg-style) of pixel + frame: fixed formula, no RNG state.
      uint pcg(uint v) {
        uint state = v * 747796405u + 2891336453u;
        uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
        return (word >> 22u) ^ word;
      }
      void main() {
        vec2 c = vUv - 0.5;
        vec3 sc;
        if (uFringe > 0.0) {
          vec2 off = c * dot(c, c) * uFringe * 4.0 / uRes * (uRes.y / 1080.0) * 100.0;
          sc = vec3(texture2D(tScene, vUv + off).r, texture2D(tScene, vUv).g, texture2D(tScene, vUv - off).b);
        } else {
          sc = texture2D(tScene, vUv).rgb;
        }
        vec3 col = sc + texture2D(tBloom, vUv).rgb * uBloom;
        col *= uExposure;
        col += uLift;
        col = aces(col);
        float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = max(mix(vec3(l), col, uSat), 0.0);
        float v = 1.0 - uVignette * smoothstep(0.2, 0.85, length(c * vec2(1.0, 0.75)) * 1.25);
        col *= v;
        vec3 srgb = vec3(toSrgb(col.r), toSrgb(col.g), toSrgb(col.b));
        uvec2 ip = uvec2(gl_FragCoord.xy);
        uint fr = uint(uFrameC);
        // grain: ±uGrain, luminance-weighted toward mid-tones, same for all channels
        uint h0 = pcg(ip.x + pcg(ip.y + pcg(fr)));
        uint h1 = pcg(h0);
        float g = (float(h0 & 65535u) / 65535.0 - 0.5) * 2.0 * uGrain;
        srgb += g * (0.35 + 0.65 * sqrt(clamp(l, 0.0, 1.0)));
        // ±1/255 triangular dither, last step before 8-bit quantisation
        // triangular-PDF dither from 8-bit fields of the two hashes
        vec3 dt = vec3(
          float(h0 >> 16u & 255u) + float(h1 & 255u),
          float(h0 >> 24u) + float(h1 >> 8u & 255u),
          float(h1 >> 16u & 255u) + float(h1 >> 24u)
        ) / 255.0 - 1.0;
        srgb += dt / 255.0;
        gl_FragColor = vec4(clamp(srgb, 0.0, 1.0), 1.0);
      }`,
      {
        tScene: { value: null },
        tBloom: { value: null },
        uRes: { value: new Vector2() },
        uFrameC: { value: 0 },
        uExposure: { value: 1 },
        uBloom: { value: 0.5 },
        uVignette: { value: 0.2 },
        uGrain: { value: 0.015 },
        uSat: { value: 1 },
        uLift: { value: 0 },
        uFringe: { value: 0 },
      },
    );
  }

  setSize(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.rtA?.dispose();
    this.rtB?.dispose();
    this.mips.forEach((m) => m.dispose());
    this.ups.forEach((m) => m.dispose());
    const depthTexture = new DepthTexture(w, h);
    depthTexture.type = FloatType;
    this.rtA = new WebGLRenderTarget(w, h, {
      type: this.hdrType,
      format: RGBAFormat,
      samples: 0,
      depthBuffer: true,
      depthTexture,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
    });
    this.dofMips.forEach((m) => m.dispose());
    this.dofMips = [1, 2].map(
      (i) =>
        new WebGLRenderTarget(Math.max(1, w >> i), Math.max(1, h >> i), {
          type: this.hdrType,
          minFilter: LinearFilter,
          magFilter: LinearFilter,
          depthBuffer: false,
        }),
    );
    this.rtB = new WebGLRenderTarget(w, h, {
      type: this.hdrType,
      format: RGBAFormat,
      samples: 0,
      depthBuffer: true,
      minFilter: LinearFilter,
      magFilter: LinearFilter,
    });
    this.mips = [];
    this.ups = [];
    let mw = w;
    let mh = h;
    for (let i = 0; i < 7; i++) {
      mw = Math.max(1, Math.round(mw / 2));
      mh = Math.max(1, Math.round(mh / 2));
      const o = { type: this.hdrType, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false };
      this.mips.push(new WebGLRenderTarget(mw, mh, o));
      this.ups.push(new WebGLRenderTarget(mw, mh, o));
    }
    this.shared.uResolution.value.set(w, h);
  }

  private pass(mat: ShaderMaterial, target: WebGLRenderTarget | null) {
    this.quad.material = mat;
    this.gl.setRenderTarget(target);
    this.gl.render(this.quadScene, this.quadCam);
  }

  render(
    opaque: Scene,
    overlay: Scene,
    camera: Camera,
    post: PostSettings,
    frame: number,
  ) {
    const gl = this.gl;
    const size = gl.getDrawingBufferSize(new Vector2());
    this.setSize(size.x, size.y);
    gl.autoClear = false;

    gl.setRenderTarget(this.rtA);
    gl.setClearColor(0x000000, 1);
    gl.clear(true, true, true);
    gl.render(opaque, camera);
    if (post.opaqueDof) {
      let srcT: Texture = this.rtA.texture;
      let sw2 = this.w;
      let sh2 = this.h;
      for (const m of this.dofMips) {
        this.boxMat.uniforms.tSrc.value = srcT;
        (this.boxMat.uniforms.uTexel.value as Vector2).set(1 / sw2, 1 / sh2);
        this.pass(this.boxMat, m);
        srcT = m.texture;
        sw2 = m.width;
        sh2 = m.height;
      }
      this.dofMat.uniforms.tC1.value = this.dofMips[0].texture;
      this.dofMat.uniforms.tC2.value = this.dofMips[1].texture;
    }
    const cam = camera as PerspectiveCamera;
    this.dofMat.uniforms.tColor.value = this.rtA.texture;
    this.dofMat.uniforms.tDepth.value = this.rtA.depthTexture;
    this.dofMat.uniforms.uNear.value = cam.near;
    this.dofMat.uniforms.uFar.value = cam.far;
    this.dofMat.uniforms.uEnabled.value = post.opaqueDof ? 1 : 0;
    // DoF pass writes depth, so it must have depth test/write on (always pass).
    this.dofMat.depthTest = true;
    this.dofMat.depthWrite = true;
    this.dofMat.depthFunc = AlwaysDepth;
    gl.setRenderTarget(this.rtB);
    gl.clear(true, true, true);
    this.pass(this.dofMat, this.rtB);
    gl.render(overlay, camera);

    // Bloom chain
    let src: Texture = this.rtB.texture;
    let sw = this.w;
    let sh = this.h;
    this.downMat.uniforms.uThreshold.value = post.bloomThreshold;
    this.downMat.uniforms.uKnee.value = post.bloomKnee;
    for (let i = 0; i < this.mips.length; i++) {
      this.downMat.uniforms.tSrc.value = src;
      (this.downMat.uniforms.uTexel.value as Vector2).set(1 / sw, 1 / sh);
      this.downMat.uniforms.uPrefilter.value = i === 0 ? 1 : 0;
      this.pass(this.downMat, this.mips[i]);
      src = this.mips[i].texture;
      sw = this.mips[i].width;
      sh = this.mips[i].height;
    }
    let low: Texture = this.mips[this.mips.length - 1].texture;
    for (let i = this.mips.length - 2; i >= 0; i--) {
      const lw = this.mips[i + 1].width;
      const lh = this.mips[i + 1].height;
      this.upMat.uniforms.tLow.value = low;
      this.upMat.uniforms.tHigh.value = this.mips[i].texture;
      (this.upMat.uniforms.uTexel.value as Vector2).set(1 / lw, 1 / lh);
      this.upMat.uniforms.uRadius.value = post.bloomRadius;
      this.pass(this.upMat, this.ups[i]);
      low = this.ups[i].texture;
    }

    const u = this.compMat.uniforms;
    u.tScene.value = this.rtB.texture;
    u.tBloom.value = low;
    (u.uRes.value as Vector2).set(this.w, this.h);
    // grain/dither pattern repeats every 600 frames so loop compositions match at the seam
    u.uFrameC.value = frame % 600;
    u.uExposure.value = post.exposure;
    u.uBloom.value = post.bloomStrength;
    u.uVignette.value = post.vignette;
    u.uGrain.value = post.grain;
    u.uSat.value = post.saturation;
    u.uLift.value = post.lift;
    u.uFringe.value = post.fringe;
    this.pass(this.compMat, null);
  }

  dispose() {
    this.rtA?.dispose();
    this.rtB?.dispose();
    this.mips.forEach((m) => m.dispose());
    this.ups.forEach((m) => m.dispose());
  }
}

export const tmpV3 = new Vector3();
