import * as THREE from "three";
import { FINISH, SHOULDER } from "./glsl";

/**
 * Small deterministic post pipeline for the three.js looks.
 *
 *   scene -> half-float MSAA target (+ depth)
 *         -> optional gather DoF (depth or radial circle of confusion), at <= 1080 rows
 *         -> optional star streaks on highlights
 *         -> mip-chain bloom (half-float)
 *         -> final: DoF composite, bloom, vignette, highlight shoulder, sRGB,
 *            grain (1.5 %) and +/-1/255 dither -> canvas
 *
 * No temporal state: every pass reads only this frame's targets.
 * All sizes are relative to the frame height, so 720p and 4K look the same.
 */

const FS_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const DOWN_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uPrefilter;
uniform float uThreshold;
uniform float uKnee;
varying vec2 vUv;
vec3 s(vec2 o) { return texture2D(tSrc, vUv + o * uTexel).rgb; }
void main() {
  vec3 a = s(vec2(-2.0, 2.0)), b = s(vec2(0.0, 2.0)), c = s(vec2(2.0, 2.0));
  vec3 d = s(vec2(-2.0, 0.0)), e = s(vec2(0.0)), f = s(vec2(2.0, 0.0));
  vec3 g = s(vec2(-2.0, -2.0)), h = s(vec2(0.0, -2.0)), i = s(vec2(2.0, -2.0));
  vec3 j = s(vec2(-1.0, 1.0)), k = s(vec2(1.0, 1.0)), l = s(vec2(-1.0, -1.0)), m = s(vec2(1.0, -1.0));
  vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  if (uPrefilter > 0.5) {
    float br = max(col.r, max(col.g, col.b));
    float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
    soft = soft * soft / (4.0 * uKnee + 1e-4);
    float contrib = max(soft, br - uThreshold) / max(br, 1e-4);
    col *= contrib;
  }
  col = min(col, vec3(64.0));
  gl_FragColor = vec4(col, 1.0);
}
`;

const UP_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uWeight;
varying vec2 vUv;
vec3 s(vec2 o) { return texture2D(tSrc, vUv + o * uTexel).rgb; }
void main() {
  vec3 col = s(vec2(0.0)) * 4.0;
  col += (s(vec2(-1.0, 0.0)) + s(vec2(1.0, 0.0)) + s(vec2(0.0, -1.0)) + s(vec2(0.0, 1.0))) * 2.0;
  col += s(vec2(-1.0, -1.0)) + s(vec2(1.0, -1.0)) + s(vec2(-1.0, 1.0)) + s(vec2(1.0, 1.0));
  gl_FragColor = vec4(col / 16.0 * uWeight, 1.0);
}
`;

const DEPTH_FN = /* glsl */ `
uniform sampler2D tDepth;
uniform float uNear;
uniform float uFar;
uniform float uFocus;
uniform float uBand;
uniform float uCocScale;
uniform float uMaxCoc;
uniform float uCocMode;
uniform vec2 uCocCenter;
uniform vec2 uCocRadial;
uniform float uAspect;
float linDepth(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  return uNear * uFar / (uFar - d * (uFar - uNear));
}
// circle-of-confusion radius as a fraction of frame height
float cocAt(vec2 uv) {
  if (uCocMode > 0.5) {
    vec2 p = (uv - uCocCenter) * vec2(uAspect, 1.0);
    return uMaxCoc * smoothstep(uCocRadial.x, uCocRadial.y, length(p));
  }
  float z = linDepth(uv);
  float dz = max(abs(z - uFocus) - uBand, 0.0);
  return min(uCocScale * dz / z, uMaxCoc);
}
`;

const DOF_FRAG = /* glsl */ `
uniform sampler2D tColor;
${DEPTH_FN}
varying vec2 vUv;
const int N = 56;
void main() {
  float cc = cocAt(vUv);
  float cz = uCocMode > 0.5 ? 0.0 : linDepth(vUv);
  vec3 c0 = texture2D(tColor, vUv).rgb;
  vec3 acc = c0;
  float tot = 1.0;
  float R = max(cc, 0.3 * uMaxCoc);
  for (int i = 0; i < N; i++) {
    float fi = float(i);
    float rr = sqrt((fi + 0.5) / float(N));
    float th = fi * 2.39996323;
    float dist = rr * R;
    vec2 uv = vUv + vec2(cos(th), sin(th)) * dist * vec2(1.0 / uAspect, 1.0);
    vec3 sc = texture2D(tColor, uv).rgb;
    float scoc = cocAt(uv);
    if (uCocMode < 0.5) {
      float sz = linDepth(uv);
      if (sz > cz) scoc = min(scoc, cc * 2.0);
    }
    float w = smoothstep(dist - 0.004, dist + 0.004, scoc);
    acc += mix(acc / tot, sc, w);
    tot += 1.0;
  }
  gl_FragColor = vec4(acc / tot, 1.0);
}
`;

const STREAK_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uDir;
uniform float uLen;
varying vec2 vUv;
void main() {
  vec3 acc = vec3(0.0);
  for (int i = 1; i <= 16; i++) {
    float fi = float(i);
    float w = exp(-fi * 0.28);
    vec2 o = uDir * fi * uLen / 16.0;
    acc += (texture2D(tSrc, vUv + o).rgb + texture2D(tSrc, vUv - o).rgb) * w;
  }
  gl_FragColor = vec4(acc * 0.22, 1.0);
}
`;

const FINAL_FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform sampler2D tDof;
uniform sampler2D tStreakA;
uniform sampler2D tStreakB;
uniform float uUseDof;
uniform float uUseStreak;
uniform float uBloom;
uniform float uStreak;
uniform float uExposure;
uniform float uVignette;
uniform vec3 uVignetteColor;
uniform vec2 uVignetteCenter;
uniform float uGrain;
uniform float uDarkFade;
uniform float uFrame;
uniform float uSaturation;
${DEPTH_FN}
${FINISH}
${SHOULDER}
varying vec2 vUv;
void main() {
  vec3 col = texture2D(tScene, vUv).rgb;
  if (uUseDof > 0.5) {
    float coc = cocAt(vUv);
    vec3 b = texture2D(tDof, vUv).rgb;
    col = mix(col, b, smoothstep(0.0006, 0.004, coc));
  }
  col += texture2D(tBloom, vUv).rgb * uBloom;
  if (uUseStreak > 0.5) {
    col += (texture2D(tStreakA, vUv).rgb + texture2D(tStreakB, vUv).rgb) * uStreak;
  }
  col *= uExposure;
  vec2 vp = (vUv - uVignetteCenter) * vec2(uAspect, 1.0);
  float v = smoothstep(0.35, 1.25, length(vp));
  col = mix(col, uVignetteColor, clamp(v * uVignette, 0.0, 1.0));
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = max(mix(vec3(l), col, uSaturation), 0.0);
  col = shoulder(col);
  vec3 srgb = linearToSrgb(col);
  gl_FragColor = vec4(finish(srgb, gl_FragCoord.xy, uFrame, uGrain, uDarkFade), 1.0);
}
`;

export type PostOptions = {
  msaa?: number;
  depth?: boolean;
  dof?: {
    mode: "depth" | "radial";
    focus?: number;
    band?: number;
    cocScale?: number;
    /** max CoC radius, fraction of frame height */
    maxCoc: number;
    radialCenter?: [number, number];
    radialRange?: [number, number];
  };
  bloom?: { strength: number; threshold: number; knee?: number; levels?: number; radius?: number };
  streak?: { strength: number; length: number };
  exposure?: number;
  vignette?: { strength: number; color: [number, number, number]; center?: [number, number] };
  grain?: number;
  darkFade?: number;
  saturation?: number;
};

const makeRT = (w: number, h: number, extra: THREE.RenderTargetOptions = {}) =>
  new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    generateMipmaps: false,
    ...extra,
  });

export class PostPipeline {
  readonly w: number;
  readonly h: number;
  readonly opts: PostOptions;
  sceneRT: THREE.WebGLRenderTarget;
  private dofRT: THREE.WebGLRenderTarget | null = null;
  private mips: THREE.WebGLRenderTarget[] = [];
  private streakSrc: THREE.WebGLRenderTarget | null = null;
  private streakA: THREE.WebGLRenderTarget | null = null;
  private streakB: THREE.WebGLRenderTarget | null = null;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: THREE.Mesh;
  private downMat: THREE.ShaderMaterial;
  private upMat: THREE.ShaderMaterial;
  private dofMat: THREE.ShaderMaterial | null = null;
  private streakMat: THREE.ShaderMaterial;
  private finalMat: THREE.ShaderMaterial;
  private black: THREE.DataTexture;

  constructor(w: number, h: number, opts: PostOptions) {
    this.w = w;
    this.h = h;
    this.opts = opts;
    const aspect = w / h;
    this.black = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    this.black.needsUpdate = true;

    const depthTexture = opts.depth ? new THREE.DepthTexture(w, h, THREE.UnsignedIntType) : null;
    this.sceneRT = makeRT(w, h, {
      samples: opts.msaa ?? 4,
      depthBuffer: true,
      depthTexture,
    });

    const depthUniforms = () => ({
      tDepth: { value: depthTexture ?? this.black },
      uNear: { value: 0.1 },
      uFar: { value: 100 },
      uFocus: { value: opts.dof?.focus ?? 10 },
      uBand: { value: opts.dof?.band ?? 0 },
      uCocScale: { value: opts.dof?.cocScale ?? 0.05 },
      uMaxCoc: { value: opts.dof?.maxCoc ?? 0 },
      uCocMode: { value: opts.dof?.mode === "radial" ? 1 : 0 },
      uCocCenter: { value: new THREE.Vector2(...(opts.dof?.radialCenter ?? [0.5, 0.5])) },
      uCocRadial: { value: new THREE.Vector2(...(opts.dof?.radialRange ?? [0.4, 1.0])) },
      uAspect: { value: aspect },
    });

    if (opts.dof) {
      // DoF gather runs at <= 1080 rows so its look (and cost) is resolution independent.
      const s = Math.min(1, 1080 / h) * 0.5;
      this.dofRT = makeRT(Math.round(w * s), Math.round(h * s));
      this.dofMat = new THREE.ShaderMaterial({
        vertexShader: FS_VERT,
        fragmentShader: DOF_FRAG,
        uniforms: { tColor: { value: null }, ...depthUniforms() },
        depthTest: false,
        depthWrite: false,
      });
    }

    const levels = opts.bloom?.levels ?? 6;
    let mw = w;
    let mh = h;
    for (let i = 0; i < levels; i++) {
      mw = Math.max(1, Math.round(mw / 2));
      mh = Math.max(1, Math.round(mh / 2));
      this.mips.push(makeRT(mw, mh));
    }

    if (opts.streak) {
      const sw = Math.round(w / 4);
      const sh = Math.round(h / 4);
      this.streakSrc = makeRT(sw, sh);
      this.streakA = makeRT(sw, sh);
      this.streakB = makeRT(sw, sh);
    }

    this.downMat = new THREE.ShaderMaterial({
      vertexShader: FS_VERT,
      fragmentShader: DOWN_FRAG,
      uniforms: {
        tSrc: { value: null },
        uTexel: { value: new THREE.Vector2() },
        uPrefilter: { value: 0 },
        uThreshold: { value: opts.bloom?.threshold ?? 1 },
        uKnee: { value: opts.bloom?.knee ?? 0.5 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.upMat = new THREE.ShaderMaterial({
      vertexShader: FS_VERT,
      fragmentShader: UP_FRAG,
      uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uWeight: { value: 1 } },
      depthTest: false,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      transparent: true,
    });
    this.streakMat = new THREE.ShaderMaterial({
      vertexShader: FS_VERT,
      fragmentShader: STREAK_FRAG,
      uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() }, uLen: { value: 0.1 } },
      depthTest: false,
      depthWrite: false,
    });
    this.finalMat = new THREE.ShaderMaterial({
      vertexShader: FS_VERT,
      fragmentShader: FINAL_FRAG,
      uniforms: {
        tScene: { value: this.sceneRT.texture },
        tBloom: { value: this.mips[0].texture },
        tDof: { value: this.dofRT?.texture ?? this.black },
        tStreakA: { value: this.streakA?.texture ?? this.black },
        tStreakB: { value: this.streakB?.texture ?? this.black },
        uUseDof: { value: opts.dof ? 1 : 0 },
        uUseStreak: { value: opts.streak ? 1 : 0 },
        uBloom: { value: opts.bloom?.strength ?? 0 },
        uStreak: { value: opts.streak?.strength ?? 0 },
        uExposure: { value: opts.exposure ?? 1 },
        uVignette: { value: opts.vignette?.strength ?? 0 },
        uVignetteColor: { value: new THREE.Vector3(...(opts.vignette?.color ?? [0, 0, 0])) },
        uVignetteCenter: { value: new THREE.Vector2(...(opts.vignette?.center ?? [0.5, 0.5])) },
        uGrain: { value: opts.grain ?? 0.015 },
        uDarkFade: { value: opts.darkFade ?? 0 },
        uFrame: { value: 0 },
        uSaturation: { value: opts.saturation ?? 1 },
        ...depthUniforms(),
      },
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.finalMat);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  /** Camera clip planes feed the depth-based CoC. */
  setCamera(cam: THREE.PerspectiveCamera) {
    for (const m of [this.dofMat, this.finalMat]) {
      if (!m) continue;
      m.uniforms.uNear.value = cam.near;
      m.uniforms.uFar.value = cam.far;
    }
  }

  setFocus(focus: number) {
    for (const m of [this.dofMat, this.finalMat]) {
      if (m) m.uniforms.uFocus.value = focus;
    }
  }

  private pass(gl: THREE.WebGLRenderer, mat: THREE.Material, target: THREE.WebGLRenderTarget | null, clear = true) {
    this.quad.material = mat;
    gl.setRenderTarget(target);
    if (clear) gl.clear(true, false, false);
    gl.render(this.quadScene, this.quadCam);
  }

  /** Render `scene` with `camera` into the HDR target and run the post chain to the canvas. */
  render(
    gl: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    grainFrame: number,
  ) {
    gl.autoClear = false;
    gl.setRenderTarget(this.sceneRT);
    gl.setClearColor(scene.background instanceof THREE.Color ? scene.background : new THREE.Color(0), 1);
    gl.clear(true, true, true);
    gl.render(scene, camera);
    this.finish(gl, grainFrame);
  }

  /** Run the post chain on whatever was rendered into sceneRT. */
  finish(gl: THREE.WebGLRenderer, grainFrame: number) {
    gl.autoClear = false;
    gl.setClearColor(0x000000, 1);
    const src = this.sceneRT.texture;

    if (this.dofMat && this.dofRT) {
      this.dofMat.uniforms.tColor.value = src;
      this.pass(gl, this.dofMat, this.dofRT);
    }

    // bloom down chain
    let prev: THREE.Texture = src;
    let pw = this.w;
    let ph = this.h;
    for (let i = 0; i < this.mips.length; i++) {
      const u = this.downMat.uniforms;
      u.tSrc.value = prev;
      u.uTexel.value.set(1 / pw, 1 / ph);
      u.uPrefilter.value = i === 0 ? 1 : 0;
      this.pass(gl, this.downMat, this.mips[i]);
      prev = this.mips[i].texture;
      pw = this.mips[i].width;
      ph = this.mips[i].height;
    }

    // star streaks from the prefiltered highlights
    if (this.streakSrc && this.streakA && this.streakB && this.opts.streak) {
      const u = this.upMat.uniforms;
      u.tSrc.value = this.mips[1].texture;
      u.uTexel.value.set(1 / this.mips[1].width, 1 / this.mips[1].height);
      u.uWeight.value = 1;
      this.pass(gl, this.upMat, this.streakSrc);
      const s = this.streakMat.uniforms;
      s.tSrc.value = this.streakSrc.texture;
      const len = this.opts.streak.length;
      s.uLen.value = len;
      s.uDir.value.set(1 / (this.w / this.h), 0);
      this.pass(gl, this.streakMat, this.streakA);
      s.uDir.value.set(0, 1);
      this.pass(gl, this.streakMat, this.streakB);
    }

    // bloom up chain (additive into the next larger mip)
    const radius = this.opts.bloom?.radius ?? 0.85;
    for (let i = this.mips.length - 1; i > 0; i--) {
      const u = this.upMat.uniforms;
      u.tSrc.value = this.mips[i].texture;
      u.uTexel.value.set(1 / this.mips[i].width, 1 / this.mips[i].height);
      u.uWeight.value = radius;
      this.pass(gl, this.upMat, this.mips[i - 1], false);
    }

    this.finalMat.uniforms.uFrame.value = grainFrame;
    this.pass(gl, this.finalMat, null);
  }

  dispose() {
    this.sceneRT.dispose();
    this.dofRT?.dispose();
    this.mips.forEach((m) => m.dispose());
    this.streakSrc?.dispose();
    this.streakA?.dispose();
    this.streakB?.dispose();
  }
}
