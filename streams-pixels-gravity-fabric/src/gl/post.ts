import * as THREE from "three";
import { HASH } from "./glsl";

// Post pipeline shared by every look:
//   scene (HDR, optional MSAA, optional depth) -> [depth of field] ->
//   bloom (mip chain) -> tonemap -> sRGB -> grain + dither -> canvas.
// All passes are stateless: every render target is fully overwritten each
// frame, so frames can render in any order on any thread.

const FS_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const fullscreenMaterial = (
  fragmentShader: string,
  uniforms: Record<string, THREE.IUniform>,
  extra: Partial<THREE.ShaderMaterialParameters> = {},
) =>
  new THREE.ShaderMaterial({
    vertexShader: FS_VERT,
    fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
    ...extra,
  });

export class FullscreenQuad {
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private mesh: THREE.Mesh;
  constructor() {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
    );
    this.mesh = new THREE.Mesh(g);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }
  render(gl: THREE.WebGLRenderer, material: THREE.Material, target: THREE.WebGLRenderTarget | null, clear = true) {
    this.mesh.material = material;
    gl.setRenderTarget(target);
    gl.autoClear = false;
    if (clear) gl.clear(true, false, false);
    gl.render(this.scene, this.camera);
  }
  dispose() {
    this.mesh.geometry.dispose();
  }
}

const DOWN_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uPrefilter;
uniform float uThreshold;
uniform float uKnee;
varying vec2 vUv;
vec3 tap(vec2 o) { return texture2D(tSrc, vUv + o * uTexel).rgb; }
float karis(vec3 c) { return 1.0 / (1.0 + dot(c, vec3(0.2126, 0.7152, 0.0722))); }
vec3 prefilter(vec3 c) {
  float br = max(c.r, max(c.g, c.b));
  float rq = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  rq = rq * rq / (4.0 * uKnee + 1e-5);
  float w = max(rq, br - uThreshold) / max(br, 1e-5);
  return c * w;
}
void main() {
  // 13-tap downsample (Jimenez, CoD:AW).
  vec3 a = tap(vec2(-2.0, 2.0)), b = tap(vec2(0.0, 2.0)), c = tap(vec2(2.0, 2.0));
  vec3 d = tap(vec2(-2.0, 0.0)), e = tap(vec2(0.0, 0.0)), f = tap(vec2(2.0, 0.0));
  vec3 g = tap(vec2(-2.0, -2.0)), h = tap(vec2(0.0, -2.0)), i = tap(vec2(2.0, -2.0));
  vec3 j = tap(vec2(-1.0, 1.0)), k = tap(vec2(1.0, 1.0));
  vec3 l = tap(vec2(-1.0, -1.0)), m = tap(vec2(1.0, -1.0));
  vec3 col;
  if (uPrefilter > 0.5) {
    // Karis average on the first level keeps single bright pixels stable.
    vec3 g0 = (a + b + d + e) * 0.25, g1 = (b + c + e + f) * 0.25;
    vec3 g2 = (d + e + g + h) * 0.25, g3 = (e + f + h + i) * 0.25;
    vec3 g4 = (j + k + l + m) * 0.25;
    float w0 = karis(g0), w1 = karis(g1), w2 = karis(g2), w3 = karis(g3), w4 = karis(g4);
    col = (g0 * w0 * 0.125 + g1 * w1 * 0.125 + g2 * w2 * 0.125 + g3 * w3 * 0.125 + g4 * w4 * 0.5)
        / (w0 * 0.125 + w1 * 0.125 + w2 * 0.125 + w3 * 0.125 + w4 * 0.5);
    col = prefilter(col);
  } else {
    col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

const UP_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uWeight;
varying vec2 vUv;
vec3 tap(vec2 o) { return texture2D(tSrc, vUv + o * uTexel).rgb; }
void main() {
  vec3 c = tap(vec2(0.0)) * 4.0
    + (tap(vec2(-1.0, 0.0)) + tap(vec2(1.0, 0.0)) + tap(vec2(0.0, -1.0)) + tap(vec2(0.0, 1.0))) * 2.0
    + tap(vec2(-1.0, -1.0)) + tap(vec2(1.0, -1.0)) + tap(vec2(-1.0, 1.0)) + tap(vec2(1.0, 1.0));
  gl_FragColor = vec4(c * (uWeight / 16.0), 1.0);
}
`;

// --- Depth of field: CoC + half-res downsample, gather blur, composite ---
const COC_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uTexel;          // full-res texel
uniform float uNear, uFar;
uniform float uFocus;         // focus distance (view units)
uniform float uFocusRange;    // half-width of the sharp band
uniform float uMaxCoc;        // in full-res px
uniform float uNearScale, uFarScale;
varying vec2 vUv;
float viewZ(float d) { return (uNear * uFar) / ((uFar - uNear) * d - uFar); }
float coc(vec2 uv) {
  float z = -viewZ(texture2D(tDepth, uv).r);
  float dz = z - uFocus;
  float s = sign(dz) * max(abs(dz) - uFocusRange, 0.0);
  float k = s < 0.0 ? uNearScale : uFarScale;
  return clamp(s * k / max(z, 1e-3), -1.0, 1.0) * uMaxCoc;
}
void main() {
  vec2 o = uTexel * 0.5;
  vec3 c = (texture2D(tColor, vUv + vec2(-o.x, -o.y)).rgb + texture2D(tColor, vUv + vec2(o.x, -o.y)).rgb
          + texture2D(tColor, vUv + vec2(-o.x, o.y)).rgb + texture2D(tColor, vUv + vec2(o.x, o.y)).rgb) * 0.25;
  float k0 = coc(vUv + vec2(-o.x, -o.y)), k1 = coc(vUv + vec2(o.x, -o.y));
  float k2 = coc(vUv + vec2(-o.x, o.y)), k3 = coc(vUv + vec2(o.x, o.y));
  // keep the strongest near-field CoC so foreground blur bleeds over edges
  float kn = min(min(k0, k1), min(k2, k3));
  float kf = (k0 + k1 + k2 + k3) * 0.25;
  gl_FragColor = vec4(c, kn < -0.5 ? kn : kf);
}
`;

const GATHER_FRAG = /* glsl */ `
uniform sampler2D tSrc;       // half-res color + signed CoC (full-res px)
uniform vec2 uTexel;          // half-res texel
uniform float uMaxCoc;        // full-res px
varying vec2 vUv;
#define SAMPLES 72
void main() {
  vec4 center = texture2D(tSrc, vUv);
  float cSize = abs(center.a) * 0.5; // to half-res px
  vec3 col = center.rgb;
  float tot = 1.0;
  float nearCov = 0.0;
  float maxR = uMaxCoc * 0.5;
  for (int i = 1; i < SAMPLES; i++) {
    float fi = float(i);
    float r = maxR * sqrt(fi / float(SAMPLES));
    float a = fi * 2.39996323;
    vec2 off = vec2(cos(a), sin(a)) * r;
    vec4 s = texture2D(tSrc, vUv + off * uTexel);
    float sSize = abs(s.a) * 0.5;
    // background samples may not blur over a sharper foreground
    if (s.a > center.a) sSize = min(sSize, cSize * 2.0);
    float m = smoothstep(r - 1.0, r + 1.0, sSize);
    col += mix(col / tot, s.rgb, m);
    tot += 1.0;
    // foreground blur that spills over this pixel
    if (s.a < 0.0) nearCov = max(nearCov, abs(s.a) * m);
  }
  // alpha: how blurred this pixel ends up (own CoC or spilled foreground)
  gl_FragColor = vec4(col / tot, max(abs(center.a), nearCov));
}
`;

const DOF_COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D tSharp;
uniform sampler2D tBlur;
varying vec2 vUv;
void main() {
  vec3 sharp = texture2D(tSharp, vUv).rgb;
  vec4 blur = texture2D(tBlur, vUv);
  float t = smoothstep(0.6, 2.2, abs(blur.a));
  gl_FragColor = vec4(mix(sharp, blur.rgb, t), 1.0);
}
`;

const FINAL_FRAG = /* glsl */ `
${HASH}
uniform sampler2D tSrc;
uniform sampler2D tBloom;
uniform float uBloom;
uniform float uExposure;
uniform float uGrain;
uniform float uFrame;     // frame % 600
uniform vec3 uLift;       // added in linear before tonemap (background floor)
uniform float uVignette;
uniform float uSaturation;
varying vec2 vUv;
vec3 aces(vec3 x) {
  // Narkowicz ACES fit
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  vec3 c = texture2D(tSrc, vUv).rgb + texture2D(tBloom, vUv).rgb * uBloom;
  vec2 q = vUv - 0.5;
  c *= mix(1.0, smoothstep(0.95, 0.2, length(q * vec2(1.0, 0.75))), uVignette);
  c = c * uExposure + uLift;
  vec3 t = aces(c);
  float l = dot(t, vec3(0.2126, 0.7152, 0.0722));
  t = max(mix(vec3(l), t, uSaturation), 0.0);
  vec3 s = toSRGB(t);
  // Grain: fixed function of pixel position and (frame % 600). Luminance-
  // weighted so pure-black backgrounds stay nearly black.
  uvec3 key = uvec3(uvec2(gl_FragCoord.xy), uint(uFrame));
  float g = u2f(pcg3(key)) + u2f(pcg3(key + uvec3(0u, 0u, 7919u))) - 1.0; // triangular, [-1,1]
  float lum = dot(s, vec3(0.2126, 0.7152, 0.0722));
  s += g * uGrain * mix(0.25, 1.0, smoothstep(0.0, 0.25, lum));
  // +-1/255 triangular dither, after tonemap, before 8-bit quantisation
  float d = u2f(pcg3(key + uvec3(0u, 0u, 104729u))) + u2f(pcg3(key + uvec3(0u, 0u, 1299709u))) - 1.0;
  s += d / 255.0;
  gl_FragColor = vec4(s, 1.0);
}
`;

export type PostOptions = {
  msaa: number;
  depth: boolean;
  dof: boolean;
  bloomLevels?: number;
};

export type PostParams = {
  bloom: number;
  threshold: number;
  knee: number;
  exposure: number;
  grain: number;
  lift?: THREE.Color;
  vignette?: number;
  saturation?: number;
  // per-level weights for the bloom upsample (index 0 = finest)
  bloomWeights?: number[];
  dof?: {
    focus: number;
    focusRange: number;
    maxCocFrac: number; // max CoC as a fraction of output height
    nearScale: number;
    farScale: number;
  };
};

const rt = (w: number, h: number, opts: THREE.RenderTargetOptions = {}) =>
  new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    generateMipmaps: false,
    colorSpace: THREE.NoColorSpace,
    ...opts,
  });

export class Post {
  readonly width: number;
  readonly height: number;
  readonly sceneRT: THREE.WebGLRenderTarget;
  private quad = new FullscreenQuad();
  private down: THREE.WebGLRenderTarget[] = [];
  private downMat: THREE.ShaderMaterial;
  private upMat: THREE.ShaderMaterial;
  private finalMat: THREE.ShaderMaterial;
  private cocMat?: THREE.ShaderMaterial;
  private gatherMat?: THREE.ShaderMaterial;
  private dofCompMat?: THREE.ShaderMaterial;
  private halfA?: THREE.WebGLRenderTarget;
  private halfB?: THREE.WebGLRenderTarget;
  private dofOut?: THREE.WebGLRenderTarget;

  constructor(private gl: THREE.WebGLRenderer, private opts: PostOptions) {
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    this.width = size.x;
    this.height = size.y;
    this.sceneRT = rt(this.width, this.height, {
      depthBuffer: true,
      samples: opts.msaa,
      ...(opts.depth
        ? { depthTexture: new THREE.DepthTexture(this.width, this.height, THREE.FloatType) }
        : {}),
    });
    const levels = opts.bloomLevels ?? 7;
    let w = this.width;
    let h = this.height;
    for (let i = 0; i < levels; i++) {
      w = Math.max(1, Math.round(w / 2));
      h = Math.max(1, Math.round(h / 2));
      this.down.push(rt(w, h));
    }
    this.downMat = fullscreenMaterial(DOWN_FRAG, {
      tSrc: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uPrefilter: { value: 0 },
      uThreshold: { value: 1 },
      uKnee: { value: 0.5 },
    });
    this.upMat = fullscreenMaterial(
      UP_FRAG,
      { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uWeight: { value: 1 } },
      { blending: THREE.AdditiveBlending, transparent: true },
    );
    this.finalMat = fullscreenMaterial(FINAL_FRAG, {
      tSrc: { value: null },
      tBloom: { value: null },
      uBloom: { value: 1 },
      uExposure: { value: 1 },
      uGrain: { value: 0.02 },
      uFrame: { value: 0 },
      uLift: { value: new THREE.Color(0, 0, 0) },
      uVignette: { value: 0 },
      uSaturation: { value: 1 },
    });
    if (opts.dof) {
      const hw = Math.ceil(this.width / 2);
      const hh = Math.ceil(this.height / 2);
      this.halfA = rt(hw, hh);
      this.halfB = rt(hw, hh);
      this.dofOut = rt(this.width, this.height);
      this.cocMat = fullscreenMaterial(COC_FRAG, {
        tColor: { value: null },
        tDepth: { value: null },
        uTexel: { value: new THREE.Vector2(1 / this.width, 1 / this.height) },
        uNear: { value: 0.1 },
        uFar: { value: 100 },
        uFocus: { value: 5 },
        uFocusRange: { value: 0.2 },
        uMaxCoc: { value: 10 },
        uNearScale: { value: 1 },
        uFarScale: { value: 1 },
      });
      this.gatherMat = fullscreenMaterial(GATHER_FRAG, {
        tSrc: { value: null },
        uTexel: { value: new THREE.Vector2(1 / hw, 1 / hh) },
        uMaxCoc: { value: 10 },
      });
      this.dofCompMat = fullscreenMaterial(DOF_COMPOSITE_FRAG, {
        tSharp: { value: null },
        tBlur: { value: null },
      });
    }
  }

  /** Render `scene` with `camera` into the HDR target, then post-process to the canvas. */
  render(scene: THREE.Scene, camera: THREE.Camera, frame: number, p: PostParams, clearColor = new THREE.Color(0, 0, 0)) {
    const gl = this.gl;
    gl.setRenderTarget(this.sceneRT);
    gl.setClearColor(clearColor, 1);
    gl.autoClear = false;
    gl.clear(true, true, true);
    gl.render(scene, camera);
    this.finish(frame, p, camera);
  }

  /** Post-process whatever is already in sceneRT. */
  finish(frame: number, p: PostParams, camera?: THREE.Camera) {
    const gl = this.gl;
    let src: THREE.Texture = this.sceneRT.texture;

    if (this.opts.dof && p.dof && camera instanceof THREE.PerspectiveCamera) {
      const maxCoc = p.dof.maxCocFrac * this.height;
      const cu = this.cocMat!.uniforms;
      cu.tColor.value = this.sceneRT.texture;
      cu.tDepth.value = this.sceneRT.depthTexture;
      cu.uNear.value = camera.near;
      cu.uFar.value = camera.far;
      cu.uFocus.value = p.dof.focus;
      cu.uFocusRange.value = p.dof.focusRange;
      cu.uMaxCoc.value = maxCoc;
      cu.uNearScale.value = p.dof.nearScale;
      cu.uFarScale.value = p.dof.farScale;
      this.quad.render(gl, this.cocMat!, this.halfA!);
      const gu = this.gatherMat!.uniforms;
      gu.tSrc.value = this.halfA!.texture;
      gu.uMaxCoc.value = maxCoc;
      this.quad.render(gl, this.gatherMat!, this.halfB!);
      const du = this.dofCompMat!.uniforms;
      du.tSharp.value = this.sceneRT.texture;
      du.tBlur.value = this.halfB!.texture;
      this.quad.render(gl, this.dofCompMat!, this.dofOut!);
      src = this.dofOut!.texture;
    }

    // Bloom: downsample chain...
    const dm = this.downMat.uniforms;
    let prev: THREE.Texture = src;
    let pw = this.width;
    let ph = this.height;
    for (let i = 0; i < this.down.length; i++) {
      dm.tSrc.value = prev;
      dm.uTexel.value.set(1 / pw, 1 / ph);
      dm.uPrefilter.value = i === 0 ? 1 : 0;
      dm.uThreshold.value = p.threshold;
      dm.uKnee.value = p.knee;
      this.quad.render(gl, this.downMat, this.down[i]);
      prev = this.down[i].texture;
      pw = this.down[i].width;
      ph = this.down[i].height;
    }
    // ...then additive tent upsample back to level 0.
    const um = this.upMat.uniforms;
    for (let i = this.down.length - 1; i > 0; i--) {
      const s = this.down[i];
      um.tSrc.value = s.texture;
      um.uTexel.value.set(1 / s.width, 1 / s.height);
      um.uWeight.value = p.bloomWeights?.[i] ?? 1;
      this.quad.render(gl, this.upMat, this.down[i - 1], false);
    }

    const fm = this.finalMat.uniforms;
    fm.tSrc.value = src;
    fm.tBloom.value = this.down[0].texture;
    fm.uBloom.value = p.bloom / this.down.length;
    fm.uExposure.value = p.exposure;
    fm.uGrain.value = p.grain;
    fm.uFrame.value = ((frame % 600) + 600) % 600;
    fm.uLift.value.copy(p.lift ?? new THREE.Color(0, 0, 0));
    fm.uVignette.value = p.vignette ?? 0;
    fm.uSaturation.value = p.saturation ?? 1;
    this.quad.render(gl, this.finalMat, null);
  }

  dispose() {
    this.sceneRT.depthTexture?.dispose();
    this.sceneRT.dispose();
    this.down.forEach((d) => d.dispose());
    this.halfA?.dispose();
    this.halfB?.dispose();
    this.dofOut?.dispose();
    [this.downMat, this.upMat, this.finalMat, this.cocMat, this.gatherMat, this.dofCompMat].forEach((m) => m?.dispose());
    this.quad.dispose();
  }
}
