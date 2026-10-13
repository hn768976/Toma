import * as THREE from "three";
import { createBlueNoiseTexture } from "./blueNoise";
import { COLOR_GLSL, HASH_GLSL } from "./glsl";
import { mulberry32 } from "./random";

// Post pipeline shared by every look.
//
//   scene ──► half-float MSAA target (+ depth)
//          ├─► SSAO (half res, fixed kernel, fixed per-pixel rotation)
//          ├─► DoF  (half res CoC gather, separable, mixed in by CoC)
//          ├─► bloom (1/4 + 1/8 res)
//          └─► composite: AO · DoF · bloom · chromatic aberration · vignette
//              · tone map · linear→sRGB · grain (1.5%) · ±1/255 blue-noise dither
//
// Everything is a pure function of the scene state and `frame % period`.

export type PostOptions = {
  samples?: number;
  ssao?: { radius: number; strength: number; bias?: number };
  /** focus/range in view-space distance, maxBlur as a fraction of frame height */
  dof?: { focus: number; range: number; maxBlur: number; nearOnly?: boolean; farScale?: number };
  bloom?: { threshold: number; strength: number; knee?: number };
  /** chromatic aberration at the frame edge, fraction of width */
  ca?: number;
  vignette?: number;
  vignetteColor?: THREE.ColorRepresentation;
  grain?: number;
  /** frames after which grain / dither repeat */
  period: number;
  tonemap?: "none" | "aces";
  exposure?: number;
};

const DEPTH_GLSL = /* glsl */ `
uniform sampler2D tDepth;
uniform float uNear;
uniform float uFar;
uniform float uOrtho;
float viewZ(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  if (uOrtho > 0.5) return uNear + d * (uFar - uNear);
  return (uNear * uFar) / ((uFar - uNear) * d - uFar) * -1.0;
}
`;

const COC_GLSL = /* glsl */ `
uniform vec4 uDof; // focus, range, nearOnly, farScale
float cocAt(vec2 uv) {
  float z = viewZ(uv);
  float d = z - uDof.x;
  if (d > 0.0) { if (uDof.z > 0.5) return 0.0; d *= uDof.w; }
  return clamp(abs(d) / uDof.y, 0.0, 1.0);
}
`;

const mat = (fragmentShader: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.ShaderMaterial({
    vertexShader: VERT3,
    fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
    glslVersion: THREE.GLSL3,
  });

// GLSL3 needs an explicit output; keep shaders readable with a tiny prelude.
const F = (body: string) => /* glsl */ `
precision highp float;
precision highp int;
#define texture2D texture
in vec2 vUv;
out vec4 fragColor;
${body}
`;

const VERT3 = /* glsl */ `
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const makeTarget = (w: number, h: number, opts: THREE.RenderTargetOptions = {}) =>
  new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    generateMipmaps: false,
    ...opts,
  });

// Fixed SSAO hemisphere kernel – seeded, generated once.
const SSAO_KERNEL: THREE.Vector3[] = (() => {
  const rng = mulberry32(0x55a0);
  const out: THREE.Vector3[] = [];
  const n = 12;
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3(rng() * 2 - 1, rng() * 2 - 1, rng() * 0.85 + 0.15).normalize();
    const s = (i + 1) / n;
    v.multiplyScalar(0.15 + 0.85 * s * s);
    out.push(v);
  }
  return out;
})();

export class Pipeline {
  readonly opts: PostOptions;
  private w = 0;
  private h = 0;
  private sceneRT!: THREE.WebGLRenderTarget;
  private aoRT?: THREE.WebGLRenderTarget;
  private aoBlurRT?: THREE.WebGLRenderTarget;
  private dofA?: THREE.WebGLRenderTarget;
  private dofB?: THREE.WebGLRenderTarget;
  private bloomA?: THREE.WebGLRenderTarget;
  private bloomB?: THREE.WebGLRenderTarget;
  private bloomC?: THREE.WebGLRenderTarget;
  private bloomD?: THREE.WebGLRenderTarget;
  private quad: THREE.Mesh;
  private quadScene: THREE.Scene;
  private quadCam: THREE.OrthographicCamera;
  private blueNoise = createBlueNoiseTexture();
  private ssaoMat?: THREE.ShaderMaterial;
  private aoBlurMat?: THREE.ShaderMaterial;
  private dofPrepMat?: THREE.ShaderMaterial;
  private dofBlurMat?: THREE.ShaderMaterial;
  private brightMat?: THREE.ShaderMaterial;
  private blurMat?: THREE.ShaderMaterial;
  private downMat?: THREE.ShaderMaterial;
  private compositeMat: THREE.ShaderMaterial;

  constructor(opts: PostOptions) {
    this.opts = opts;
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.quadScene = new THREE.Scene();
    this.quadScene.add(this.quad);

    const depthUniforms = () => ({
      tDepth: { value: null },
      uNear: { value: 0.1 },
      uFar: { value: 100 },
      uOrtho: { value: 0 },
    });

    if (opts.ssao) {
      this.ssaoMat = new THREE.ShaderMaterial({
        vertexShader: VERT3,
        glslVersion: THREE.GLSL3,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          ...depthUniforms(),
          uProj: { value: new THREE.Matrix4() },
          uInvProj: { value: new THREE.Matrix4() },
          uKernel: { value: SSAO_KERNEL },
          uRadius: { value: opts.ssao.radius },
          uBias: { value: opts.ssao.bias ?? 0.02 },
          uBlueNoise: { value: this.blueNoise },
          uTexel: { value: new THREE.Vector2() },
        },
        fragmentShader: F(/* glsl */ `
          ${DEPTH_GLSL}
          uniform mat4 uProj;
          uniform mat4 uInvProj;
          uniform vec3 uKernel[12];
          uniform float uRadius;
          uniform float uBias;
          uniform sampler2D uBlueNoise;
          uniform vec2 uTexel;
          vec3 viewPos(vec2 uv) {
            float d = texture2D(tDepth, uv).x;
            vec4 p = uInvProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
            return p.xyz / p.w;
          }
          void main() {
            float d0 = texture2D(tDepth, vUv).x;
            if (d0 >= 0.9999) { fragColor = vec4(1.0); return; }
            vec3 p = viewPos(vUv);
            vec3 px1 = viewPos(vUv + vec2(uTexel.x, 0.0));
            vec3 px0 = viewPos(vUv - vec2(uTexel.x, 0.0));
            vec3 py1 = viewPos(vUv + vec2(0.0, uTexel.y));
            vec3 py0 = viewPos(vUv - vec2(0.0, uTexel.y));
            vec3 dx = abs(px1.z - p.z) < abs(p.z - px0.z) ? px1 - p : p - px0;
            vec3 dy = abs(py1.z - p.z) < abs(p.z - py0.z) ? py1 - p : p - py0;
            vec3 n = normalize(cross(dx, dy));
            // fixed (frame-independent) per-pixel rotation from blue noise
            float a = texture2D(uBlueNoise, mod(gl_FragCoord.xy, 64.0) / 64.0).r * 6.2831853;
            vec3 rv = vec3(cos(a), sin(a), 0.0);
            vec3 t = normalize(rv - n * dot(rv, n));
            vec3 b = cross(n, t);
            mat3 tbn = mat3(t, b, n);
            float occ = 0.0;
            for (int i = 0; i < 12; i++) {
              vec3 s = p + tbn * uKernel[i] * uRadius;
              vec4 o = uProj * vec4(s, 1.0);
              vec2 suv = o.xy / o.w * 0.5 + 0.5;
              float sz = viewPos(suv).z;
              float rc = smoothstep(0.0, 1.0, uRadius / max(abs(p.z - sz), 1e-4));
              occ += (sz >= s.z + uBias ? 1.0 : 0.0) * rc;
            }
            fragColor = vec4(vec3(1.0 - occ / 12.0), 1.0);
          }
        `),
      });
      this.aoBlurMat = mat(
        F(/* glsl */ `
          uniform sampler2D tAo;
          uniform vec2 uTexel;
          void main() {
            float s = 0.0;
            for (int y = -2; y <= 1; y++)
              for (int x = -2; x <= 1; x++)
                s += texture2D(tAo, vUv + (vec2(x, y) + 0.5) * uTexel).r;
            fragColor = vec4(vec3(s / 16.0), 1.0);
          }
        `),
        { tAo: { value: null }, uTexel: { value: new THREE.Vector2() } },
      );
    }

    if (opts.dof) {
      this.dofPrepMat = mat(
        F(/* glsl */ `
          ${DEPTH_GLSL}
          ${COC_GLSL}
          uniform sampler2D tColor;
          uniform sampler2D tAo;
          uniform float uAoStrength;
          uniform vec2 uTexel; // full-res texel
          void main() {
            vec3 c = vec3(0.0);
            float coc = 0.0;
            for (int i = 0; i < 4; i++) {
              vec2 o = vec2(float(i & 1), float(i >> 1)) - 0.5;
              vec2 uv = vUv + o * uTexel;
              c += texture2D(tColor, uv).rgb;
              coc = max(coc, cocAt(uv));
            }
            c *= 0.25;
            float ao = mix(1.0, texture2D(tAo, vUv).r, uAoStrength);
            fragColor = vec4(c * ao, coc);
          }
        `),
        {
          ...depthUniforms(),
          uDof: { value: new THREE.Vector4() },
          tColor: { value: null },
          tAo: { value: null },
          uAoStrength: { value: 0 },
          uTexel: { value: new THREE.Vector2() },
        },
      );
      this.dofBlurMat = mat(
        F(/* glsl */ `
          uniform sampler2D tSrc;
          uniform vec2 uDir;     // texel-sized direction
          uniform float uMaxPx;  // max blur radius in this target's pixels
          void main() {
            vec4 c0 = texture2D(tSrc, vUv);
            vec3 acc = c0.rgb;
            float wsum = 1.0;
            float cocAcc = c0.a;
            for (int i = -8; i <= 8; i++) {
              if (i == 0) continue;
              float t = float(i) / 8.0;
              float dpx = abs(t) * uMaxPx;
              vec4 s = texture2D(tSrc, vUv + uDir * t * uMaxPx);
              // a sample contributes when its own circle of confusion reaches us
              float reach = clamp(s.a * uMaxPx - dpx + 1.0, 0.0, 1.0);
              float w = exp(-t * t * 2.0) * reach;
              acc += s.rgb * w;
              cocAcc += s.a * w;
              wsum += w;
            }
            fragColor = vec4(acc / wsum, cocAcc / wsum);
          }
        `),
        { tSrc: { value: null }, uDir: { value: new THREE.Vector2() }, uMaxPx: { value: 1 } },
      );
    }

    if (opts.bloom) {
      this.brightMat = mat(
        F(/* glsl */ `
          uniform sampler2D tColor;
          uniform vec2 uTexel;
          uniform float uThreshold;
          uniform float uKnee;
          void main() {
            vec3 c = vec3(0.0);
            for (int i = 0; i < 4; i++) {
              vec2 o = (vec2(float(i & 1), float(i >> 1)) - 0.5) * 2.0;
              c += texture2D(tColor, vUv + o * uTexel).rgb;
            }
            c *= 0.25;
            float l = max(c.r, max(c.g, c.b));
            float k = smoothstep(uThreshold - uKnee, uThreshold + uKnee, l);
            fragColor = vec4(c * k, 1.0);
          }
        `),
        {
          tColor: { value: null },
          uTexel: { value: new THREE.Vector2() },
          uThreshold: { value: opts.bloom.threshold },
          uKnee: { value: opts.bloom.knee ?? 0.25 },
        },
      );
      this.blurMat = mat(
        F(/* glsl */ `
          uniform sampler2D tSrc;
          uniform vec2 uDir;
          void main() {
            vec3 c = texture2D(tSrc, vUv).rgb * 0.2270270;
            c += texture2D(tSrc, vUv + uDir * 1.3846154).rgb * 0.3162162;
            c += texture2D(tSrc, vUv - uDir * 1.3846154).rgb * 0.3162162;
            c += texture2D(tSrc, vUv + uDir * 3.2307692).rgb * 0.0702703;
            c += texture2D(tSrc, vUv - uDir * 3.2307692).rgb * 0.0702703;
            fragColor = vec4(c, 1.0);
          }
        `),
        { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } },
      );
      this.downMat = mat(
        F(/* glsl */ `
          uniform sampler2D tSrc;
          uniform vec2 uTexel;
          void main() {
            vec3 c = vec3(0.0);
            for (int i = 0; i < 4; i++) {
              vec2 o = (vec2(float(i & 1), float(i >> 1)) - 0.5);
              c += texture2D(tSrc, vUv + o * uTexel).rgb;
            }
            fragColor = vec4(c * 0.25, 1.0);
          }
        `),
        { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } },
      );
    }

    const vc = new THREE.Color(opts.vignetteColor ?? 0x000000);
    this.compositeMat = mat(
      F(/* glsl */ `
        ${DEPTH_GLSL}
        ${COC_GLSL}
        ${COLOR_GLSL}
        ${HASH_GLSL}
        uniform sampler2D tColor;
        uniform sampler2D tAo;
        uniform sampler2D tDof;
        uniform sampler2D tBloom1;
        uniform sampler2D tBloom2;
        uniform sampler2D uBlueNoise;
        uniform float uAoStrength;
        uniform float uHasDof;
        uniform float uBloom;
        uniform float uCa;
        uniform float uVignette;
        uniform vec3 uVignetteColor;
        uniform float uGrain;
        uniform float uFrame;
        uniform float uTonemap;
        uniform float uExposure;
        uniform vec2 uRes;

        vec3 aces(vec3 x) {
          const float a = 2.51; const float b = 0.03; const float c = 2.43;
          const float d = 0.59; const float e = 0.14;
          return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
        }

        vec3 sceneAt(vec2 uv) {
          vec3 c = texture2D(tColor, uv).rgb;
          if (uAoStrength > 0.0) c *= mix(1.0, texture2D(tAo, uv).r, uAoStrength);
          if (uHasDof > 0.5) {
            vec4 b = texture2D(tDof, uv);
            float f = smoothstep(0.02, 0.35, max(cocAt(uv), b.a));
            c = mix(c, b.rgb, f);
          }
          return c;
        }

        void main() {
          vec2 uv = vUv;
          vec3 col;
          vec2 dc = uv - 0.5;
          if (uCa > 0.0) {
            vec2 off = dc * dot(dc, dc) * 4.0 * uCa;
            col.r = sceneAt(uv + off).r;
            col.g = sceneAt(uv).g;
            col.b = sceneAt(uv - off).b;
          } else {
            col = sceneAt(uv);
          }
          if (uBloom > 0.0) {
            col += (texture2D(tBloom1, uv).rgb * 0.55 + texture2D(tBloom2, uv).rgb * 0.75) * uBloom;
          }
          col *= uExposure;
          if (uVignette > 0.0) {
            vec2 v = dc * vec2(uRes.x / uRes.y, 1.0) / 0.5;
            float vig = smoothstep(0.55, 1.9, length(v));
            col = mix(col, uVignetteColor, vig * uVignette);
          }
          if (uTonemap > 0.5) col = aces(col);
          vec3 s = linearToSrgb(clamp(col, 0.0, 1.0));
          // film grain: fixed formula of pixel position and frame
          uvec3 hp = uvec3(uvec2(gl_FragCoord.xy), uint(uFrame));
          float g = hash3(hp) - 0.5;
          s += g * uGrain;
          // +-1/255 dither: blue noise, offset by frame
          vec2 bp = mod(floor(gl_FragCoord.xy) + vec2(mod(uFrame * 37.0, 64.0), mod(uFrame * 23.0, 64.0)), 64.0);
          float bn = texture2D(uBlueNoise, (bp + 0.5) / 64.0).r;
          bn = fract(bn + uFrame * 0.61803398875);
          s += (bn - 0.5) * (2.0 / 255.0);
          fragColor = vec4(s, 1.0);
        }
      `),
      {
        ...depthUniforms(),
        uDof: { value: new THREE.Vector4() },
        tColor: { value: null },
        tAo: { value: null },
        tDof: { value: null },
        tBloom1: { value: null },
        tBloom2: { value: null },
        uBlueNoise: { value: this.blueNoise },
        uAoStrength: { value: 0 },
        uHasDof: { value: 0 },
        uBloom: { value: 0 },
        uCa: { value: opts.ca ?? 0 },
        uVignette: { value: opts.vignette ?? 0 },
        uVignetteColor: { value: new THREE.Vector3(vc.r, vc.g, vc.b) },
        uGrain: { value: opts.grain ?? 0.015 },
        uFrame: { value: 0 },
        uTonemap: { value: opts.tonemap === "aces" ? 1 : 0 },
        uExposure: { value: opts.exposure ?? 1 },
        uRes: { value: new THREE.Vector2() },
      },
    );
  }

  private ensureSize(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    this.dispose(false);
    this.w = w;
    this.h = h;
    const needDepth = !!(this.opts.dof || this.opts.ssao);
    this.sceneRT = makeTarget(w, h, {
      samples: this.opts.samples ?? 4,
      depthBuffer: true,
      ...(needDepth ? { depthTexture: new THREE.DepthTexture(w, h, THREE.FloatType) } : {}),
    });
    const hw = Math.ceil(w / 2);
    const hh = Math.ceil(h / 2);
    if (this.opts.ssao) {
      this.aoRT = makeTarget(hw, hh);
      this.aoBlurRT = makeTarget(hw, hh);
    }
    if (this.opts.dof) {
      this.dofA = makeTarget(hw, hh);
      this.dofB = makeTarget(hw, hh);
    }
    if (this.opts.bloom) {
      const qw = Math.ceil(w / 4);
      const qh = Math.ceil(h / 4);
      this.bloomA = makeTarget(qw, qh);
      this.bloomB = makeTarget(qw, qh);
      this.bloomC = makeTarget(Math.ceil(qw / 2), Math.ceil(qh / 2));
      this.bloomD = makeTarget(Math.ceil(qw / 2), Math.ceil(qh / 2));
    }
  }

  private pass(gl: THREE.WebGLRenderer, m: THREE.Material, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = m;
    gl.setRenderTarget(target);
    gl.render(this.quadScene, this.quadCam);
  }

  private setDepthUniforms(m: THREE.ShaderMaterial, camera: THREE.Camera) {
    const c = camera as THREE.PerspectiveCamera;
    m.uniforms.tDepth.value = this.sceneRT.depthTexture;
    m.uniforms.uNear.value = c.near;
    m.uniforms.uFar.value = c.far;
    m.uniforms.uOrtho.value = (camera as THREE.OrthographicCamera).isOrthographicCamera ? 1 : 0;
  }

  render(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, frame: number) {
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    const w = size.x;
    const h = size.y;
    this.ensureSize(w, h);
    const o = this.opts;
    const prevAutoClear = gl.autoClear;
    gl.autoClear = true;
    gl.toneMapping = THREE.NoToneMapping;

    gl.setRenderTarget(this.sceneRT);
    gl.clear(true, true, true);
    gl.render(scene, camera);

    const cm = this.compositeMat;
    const hw = this.aoRT?.width ?? Math.ceil(w / 2);
    const hh = this.aoRT?.height ?? Math.ceil(h / 2);

    let aoStrength = 0;
    if (o.ssao && this.ssaoMat && this.aoBlurMat && this.aoRT && this.aoBlurRT) {
      const cam = camera as THREE.PerspectiveCamera;
      this.setDepthUniforms(this.ssaoMat, camera);
      this.ssaoMat.uniforms.uProj.value.copy(cam.projectionMatrix);
      this.ssaoMat.uniforms.uInvProj.value.copy(cam.projectionMatrixInverse);
      this.ssaoMat.uniforms.uTexel.value.set(1 / w, 1 / h);
      this.pass(gl, this.ssaoMat, this.aoRT);
      this.aoBlurMat.uniforms.tAo.value = this.aoRT.texture;
      this.aoBlurMat.uniforms.uTexel.value.set(1 / hw, 1 / hh);
      this.pass(gl, this.aoBlurMat, this.aoBlurRT);
      aoStrength = o.ssao.strength;
      cm.uniforms.tAo.value = this.aoBlurRT.texture;
    }
    cm.uniforms.uAoStrength.value = aoStrength;

    if (o.dof && this.dofPrepMat && this.dofBlurMat && this.dofA && this.dofB) {
      const dofVec = new THREE.Vector4(o.dof.focus, o.dof.range, o.dof.nearOnly ? 1 : 0, o.dof.farScale ?? 1);
      this.setDepthUniforms(this.dofPrepMat, camera);
      this.dofPrepMat.uniforms.uDof.value.copy(dofVec);
      this.dofPrepMat.uniforms.tColor.value = this.sceneRT.texture;
      this.dofPrepMat.uniforms.tAo.value = this.aoBlurRT?.texture ?? null;
      this.dofPrepMat.uniforms.uAoStrength.value = aoStrength;
      this.dofPrepMat.uniforms.uTexel.value.set(1 / w, 1 / h);
      this.pass(gl, this.dofPrepMat, this.dofA);
      const maxPx = o.dof.maxBlur * this.dofA.height;
      const bm = this.dofBlurMat;
      bm.uniforms.uMaxPx.value = maxPx;
      bm.uniforms.tSrc.value = this.dofA.texture;
      bm.uniforms.uDir.value.set(1 / this.dofA.width, 0);
      this.pass(gl, bm, this.dofB);
      bm.uniforms.tSrc.value = this.dofB.texture;
      bm.uniforms.uDir.value.set(0, 1 / this.dofA.height);
      this.pass(gl, bm, this.dofA);
      this.setDepthUniforms(cm, camera);
      cm.uniforms.uDof.value.copy(dofVec);
      cm.uniforms.tDof.value = this.dofA.texture;
      cm.uniforms.uHasDof.value = 1;
    } else {
      cm.uniforms.uHasDof.value = 0;
      if (o.ssao) this.setDepthUniforms(cm, camera);
    }

    if (o.bloom && this.brightMat && this.blurMat && this.downMat && this.bloomA && this.bloomB && this.bloomC && this.bloomD) {
      // Bloom reads the DoF-free scene; small glints do not need DoF.
      this.brightMat.uniforms.tColor.value = this.sceneRT.texture;
      this.brightMat.uniforms.uTexel.value.set(1 / w, 1 / h);
      this.pass(gl, this.brightMat, this.bloomA);
      const qa = this.bloomA;
      this.blurMat.uniforms.tSrc.value = qa.texture;
      this.blurMat.uniforms.uDir.value.set(1 / qa.width, 0);
      this.pass(gl, this.blurMat, this.bloomB);
      this.blurMat.uniforms.tSrc.value = this.bloomB.texture;
      this.blurMat.uniforms.uDir.value.set(0, 1 / qa.height);
      this.pass(gl, this.blurMat, qa);
      this.downMat.uniforms.tSrc.value = qa.texture;
      this.downMat.uniforms.uTexel.value.set(1 / qa.width, 1 / qa.height);
      this.pass(gl, this.downMat, this.bloomC);
      const qc = this.bloomC;
      this.blurMat.uniforms.tSrc.value = qc.texture;
      this.blurMat.uniforms.uDir.value.set(2 / qc.width, 0);
      this.pass(gl, this.blurMat, this.bloomD);
      this.blurMat.uniforms.tSrc.value = this.bloomD.texture;
      this.blurMat.uniforms.uDir.value.set(0, 2 / qc.height);
      this.pass(gl, this.blurMat, qc);
      cm.uniforms.tBloom1.value = qa.texture;
      cm.uniforms.tBloom2.value = qc.texture;
      cm.uniforms.uBloom.value = o.bloom.strength;
    } else {
      cm.uniforms.uBloom.value = 0;
    }

    cm.uniforms.tColor.value = this.sceneRT.texture;
    cm.uniforms.uFrame.value = ((frame % o.period) + o.period) % o.period;
    cm.uniforms.uRes.value.set(w, h);
    this.pass(gl, cm, null);
    gl.autoClear = prevAutoClear;
  }

  dispose(all = true) {
    this.sceneRT?.depthTexture?.dispose();
    this.sceneRT?.dispose();
    this.aoRT?.dispose();
    this.aoBlurRT?.dispose();
    this.dofA?.dispose();
    this.dofB?.dispose();
    this.bloomA?.dispose();
    this.bloomB?.dispose();
    this.bloomC?.dispose();
    this.bloomD?.dispose();
    if (all) {
      this.blueNoise.dispose();
    }
  }
}

/** Uniform values for the background blue-noise dither (see BG_DITHER_GLSL). */
export const bgDitherOffset = (frame: number, period: number) => {
  const f = ((frame % period) + period) % period;
  return new THREE.Vector3((f * 19) % 64, (f * 41) % 64, (f * 0.7548776662) % 1);
};

export const sharedBlueNoise = createBlueNoiseTexture();
