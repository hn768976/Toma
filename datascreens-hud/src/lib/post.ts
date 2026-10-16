import * as THREE from "three";

// Minimal post chain on half-float targets: optional depth-of-field gather
// (CoC read from the scene's alpha channel), optional bloom, and a final pass
// with dither and grain that are fixed functions of pixel position and frame.

const FULLSCREEN_VS = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

export const HASH_GLSL = /* glsl */ `
uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float hash3(uvec3 p) {
  return float(pcg(p.x ^ pcg(p.y ^ pcg(p.z)))) / 4294967295.0;
}`;

const makePass = (fs: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: FULLSCREEN_VS,
    fragmentShader: fs,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });

const DOF_FS = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tColor;
uniform vec2 uTexel;
uniform float uMaxRadius; // physical px
const int N = 64;
void main() {
  vec4 c = texture(tColor, vUv);
  float coc = c.a;
  float r = coc * uMaxRadius;
  if (r < 0.5) { outColor = vec4(c.rgb, 1.0); return; }
  vec3 acc = c.rgb;
  float wsum = 1.0;
  const float GA = 2.39996323;
  for (int i = 1; i < N; i++) {
    float fi = float(i);
    float rr = sqrt(fi / float(N)) * r;
    float a = fi * GA;
    vec2 o = vec2(cos(a), sin(a)) * rr * uTexel;
    vec4 s = texture(tColor, vUv + o);
    // a sample only contributes if its own blur reaches this pixel
    float w = smoothstep(rr - 1.0, rr + 1.0, s.a * uMaxRadius + 0.5);
    acc += s.rgb * w;
    wsum += w;
  }
  outColor = vec4(acc / wsum, 1.0);
}`;

const THRESH_FS = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tColor;
uniform float uThreshold;
void main() {
  vec3 c = texture(tColor, vUv).rgb;
  float l = max(c.r, max(c.g, c.b));
  float k = max(l - uThreshold, 0.0) / max(l, 1e-4);
  outColor = vec4(c * k, 1.0);
}`;

const BLUR_FS = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tColor;
uniform vec2 uDir; // texel step
void main() {
  // 9-tap gaussian via linear sampling
  vec3 c = texture(tColor, vUv).rgb * 0.2270270270;
  c += texture(tColor, vUv + uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture(tColor, vUv - uDir * 1.3846153846).rgb * 0.3162162162;
  c += texture(tColor, vUv + uDir * 3.2307692308).rgb * 0.0702702703;
  c += texture(tColor, vUv - uDir * 3.2307692308).rgb * 0.0702702703;
  outColor = vec4(c, 1.0);
}`;

const COPY_FS = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tColor;
void main() { outColor = vec4(texture(tColor, vUv).rgb, 1.0); }`;

const FINAL_FS = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tColor;
uniform sampler2D tBloom0;
uniform sampler2D tBloom1;
uniform sampler2D tBloom2;
uniform sampler2D tBloom3;
uniform sampler2D tBloom4;
uniform float uBloom;
uniform float uDither;
uniform float uGrain;
uniform uint uFrame;
${HASH_GLSL}
void main() {
  vec3 c = texture(tColor, vUv).rgb;
  if (uBloom > 0.0) {
    vec3 b = texture(tBloom0, vUv).rgb * 0.30 + texture(tBloom1, vUv).rgb * 0.25 +
             texture(tBloom2, vUv).rgb * 0.20 + texture(tBloom3, vUv).rgb * 0.15 +
             texture(tBloom4, vUv).rgb * 0.10;
    c += b * uBloom;
  }
  c = clamp(c, 0.0, 1.0);
  uvec3 p = uvec3(uvec2(gl_FragCoord.xy), uFrame);
  if (uGrain > 0.0) {
    float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float g = hash3(p + uvec3(0u, 0u, 7919u)) + hash3(p + uvec3(1301u, 0u, 15401u)) - 1.0;
    c += g * uGrain * smoothstep(0.03, 0.06, lum);
  }
  if (uDither > 0.0) {
    // triangular dither, +-1/255
    float d = hash3(p + uvec3(0u, 4801u, 101u)) + hash3(p + uvec3(9137u, 0u, 303u)) - 1.0;
    c += d * uDither / 255.0;
  }
  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

export interface PostOptions {
  msaa?: number;
  dof?: { maxRadius720: number };
  bloom?: { threshold: number; strength: number };
  dither: boolean;
  grain: number; // e.g. 0.01
  clearColor?: [number, number, number, number];
}

export class PostChain {
  private gl: THREE.WebGLRenderer;
  private opts: PostOptions;
  private w: number;
  private h: number;
  private u: number;
  private sceneRT: THREE.WebGLRenderTarget;
  private dofRT: THREE.WebGLRenderTarget | null = null;
  private bloomA: THREE.WebGLRenderTarget[] = [];
  private bloomB: THREE.WebGLRenderTarget[] = [];
  private quad: THREE.Mesh;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private dofMat: THREE.ShaderMaterial;
  private threshMat: THREE.ShaderMaterial;
  private blurMat: THREE.ShaderMaterial;
  private copyMat: THREE.ShaderMaterial;
  private finalMat: THREE.ShaderMaterial;

  constructor(gl: THREE.WebGLRenderer, w: number, h: number, opts: PostOptions) {
    this.gl = gl;
    this.opts = opts;
    this.w = w;
    this.h = h;
    this.u = h / 720;
    const rtOpts = {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      depthBuffer: true,
      samples: opts.msaa ?? 0,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    };
    this.sceneRT = new THREE.WebGLRenderTarget(w, h, rtOpts);
    if (opts.dof) {
      this.dofRT = new THREE.WebGLRenderTarget(w, h, { ...rtOpts, samples: 0, depthBuffer: false });
    }
    if (opts.bloom) {
      let bw = Math.max(1, Math.floor(w / 2));
      let bh = Math.max(1, Math.floor(h / 2));
      for (let i = 0; i < 5; i++) {
        const o = { ...rtOpts, samples: 0, depthBuffer: false };
        this.bloomA.push(new THREE.WebGLRenderTarget(bw, bh, o));
        this.bloomB.push(new THREE.WebGLRenderTarget(bw, bh, o));
        bw = Math.max(1, Math.floor(bw / 2));
        bh = Math.max(1, Math.floor(bh / 2));
      }
    }
    this.dofMat = makePass(DOF_FS, {
      tColor: { value: null },
      uTexel: { value: new THREE.Vector2(1 / w, 1 / h) },
      uMaxRadius: { value: (opts.dof?.maxRadius720 ?? 0) * this.u },
    });
    this.threshMat = makePass(THRESH_FS, {
      tColor: { value: null },
      uThreshold: { value: opts.bloom?.threshold ?? 1 },
    });
    this.blurMat = makePass(BLUR_FS, { tColor: { value: null }, uDir: { value: new THREE.Vector2() } });
    this.copyMat = makePass(COPY_FS, { tColor: { value: null } });
        this.finalMat = makePass(FINAL_FS, {
      tColor: { value: null },
      tBloom0: { value: this.bloomB[0]?.texture ?? null },
      tBloom1: { value: this.bloomB[1]?.texture ?? null },
      tBloom2: { value: this.bloomB[2]?.texture ?? null },
      tBloom3: { value: this.bloomB[3]?.texture ?? null },
      tBloom4: { value: this.bloomB[4]?.texture ?? null },
      uBloom: { value: opts.bloom?.strength ?? 0 },
      uDither: { value: opts.dither ? 1 : 0 },
      uGrain: { value: opts.grain },
      uFrame: { value: 0 },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.finalMat);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  private pass(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    this.gl.setRenderTarget(target);
    this.gl.render(this.quadScene, this.quadCam);
  }

  render(scene: THREE.Scene, camera: THREE.Camera, loopFrame: number) {
    const gl = this.gl;
    const cc = this.opts.clearColor ?? [0, 0, 0, 0];
    gl.setClearColor(new THREE.Color(cc[0], cc[1], cc[2]), cc[3]);
    gl.setRenderTarget(this.sceneRT);
    gl.clear(true, true, true);
    gl.render(scene, camera);

    let color = this.sceneRT.texture;
    if (this.dofRT) {
      this.dofMat.uniforms.tColor.value = color;
      this.pass(this.dofMat, this.dofRT);
      color = this.dofRT.texture;
    }

    if (this.opts.bloom) {
      this.threshMat.uniforms.tColor.value = color;
      this.pass(this.threshMat, this.bloomB[0]);
      // result of level i ends up in bloomB[i]
      for (let i = 0; i < this.bloomA.length; i++) {
        const a = this.bloomA[i];
        const b = this.bloomB[i];
        if (i > 0) {
          this.copyMat.uniforms.tColor.value = this.bloomB[i - 1].texture;
          this.pass(this.copyMat, b);
        }
        const tw = 1 / a.width;
        const th = 1 / a.height;
        for (let k = 1; k <= 2; k++) {
          this.blurMat.uniforms.tColor.value = b.texture;
          this.blurMat.uniforms.uDir.value.set(tw * k, 0);
          this.pass(this.blurMat, a);
          this.blurMat.uniforms.tColor.value = a.texture;
          this.blurMat.uniforms.uDir.value.set(0, th * k);
          this.pass(this.blurMat, b);
        }
      }
    }

    this.finalMat.uniforms.tColor.value = color;
    this.finalMat.uniforms.uFrame.value = loopFrame;
    this.pass(this.finalMat, null);
  }

  get size() {
    return { w: this.w, h: this.h, u: this.u };
  }

  dispose() {
    this.sceneRT.dispose();
    this.dofRT?.dispose();
    this.bloomA.forEach((t) => t.dispose());
    this.bloomB.forEach((t) => t.dispose());
    [this.dofMat, this.threshMat, this.blurMat, this.copyMat, this.finalMat].forEach((m) => m.dispose());
    this.quad.geometry.dispose();
  }
}
