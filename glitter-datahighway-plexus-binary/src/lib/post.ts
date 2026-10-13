// three.js post pipeline: HDR scene target -> optional DoF -> bloom -> finish.
// Every pass is a RawShaderMaterial on a full-screen triangle; no TAA, no clocks.
import * as THREE from "three";
import { FINISH_GLSL } from "./glsl";

const VERT = /* glsl */ `
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const makePass = (fragment: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VERT,
    fragmentShader: "precision highp float;\nprecision highp int;\nin vec2 vUv;\nout vec4 outColor;\n" + fragment,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });

const rt = (w: number, h: number, mip = false, samples = 0) =>
  new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: mip,
    depthBuffer: samples > 0,
    samples,
  });

// Dual-filter style bloom: 13-tap downsample, 3x3 tent upsample.
const DOWN = /* glsl */ `
uniform sampler2D src; uniform vec2 texel; uniform float prefilter; uniform float threshold;
void main() {
  vec2 t = texel;
  vec3 a = texture(src, vUv + t * vec2(-2, -2)).rgb, b = texture(src, vUv + t * vec2(0, -2)).rgb, c = texture(src, vUv + t * vec2(2, -2)).rgb;
  vec3 d = texture(src, vUv + t * vec2(-2, 0)).rgb, e = texture(src, vUv).rgb, f = texture(src, vUv + t * vec2(2, 0)).rgb;
  vec3 g = texture(src, vUv + t * vec2(-2, 2)).rgb, h = texture(src, vUv + t * vec2(0, 2)).rgb, i = texture(src, vUv + t * vec2(2, 2)).rgb;
  vec3 j = texture(src, vUv + t * vec2(-1, -1)).rgb, k = texture(src, vUv + t * vec2(1, -1)).rgb;
  vec3 l = texture(src, vUv + t * vec2(-1, 1)).rgb, m = texture(src, vUv + t * vec2(1, 1)).rgb;
  vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  col = min(col, vec3(64.0));
  if (prefilter > 0.5) {
    float br = max(col.r, max(col.g, col.b));
    col *= max(br - threshold, 0.0) / max(br, 1e-4);
  }
  outColor = vec4(col, 1.0);
}`;

const UP = /* glsl */ `
uniform sampler2D src; uniform sampler2D base; uniform vec2 texel; uniform float radius;
void main() {
  vec2 t = texel * radius;
  vec3 s = texture(src, vUv + t * vec2(-1, -1)).rgb + 2.0 * texture(src, vUv + t * vec2(0, -1)).rgb + texture(src, vUv + t * vec2(1, -1)).rgb
    + 2.0 * texture(src, vUv + t * vec2(-1, 0)).rgb + 4.0 * texture(src, vUv).rgb + 2.0 * texture(src, vUv + t * vec2(1, 0)).rgb
    + texture(src, vUv + t * vec2(-1, 1)).rgb + 2.0 * texture(src, vUv + t * vec2(0, 1)).rgb + texture(src, vUv + t * vec2(1, 1)).rgb;
  outColor = vec4(texture(base, vUv).rgb + s / 16.0, 1.0);
}`;

export type DofSurface =
  // CoC from the ray hitting the plane n.x = d (world space).
  | { kind: "plane"; normal: THREE.Vector3; d: number }
  // CoC from the ray hitting a sphere of radius r centred at c.
  | { kind: "sphere"; radius: number; center: THREE.Vector3 };

export type PostOptions = {
  bloomStrength: number;
  bloomThreshold: number;
  bloomRadius: number; // upsample spread
  bloomLevels?: number;
  vignette: number;
  grain: number; // 0.015 = 1.5%
  grainFloor: number; // 0 or luminance below which grain fades
  exposure: number;
  // DoF on an analytic surface (CoC in fractions of frame height).
  dof?: {
    surface: DofSurface;
    focusDist: number; // world distance of the focal plane from the camera
    // coc = clamp(scale * |1/focus - 1/dist| * focus, 0, maxCoc)
    scale: number;
    maxCoc: number;
    // Optional extra: CoC = max(coc, nearBoost) for dist < nearDist
    farScale?: number;
  };
  // Extra full-screen haze added before bloom: sky / horizon gradients.
  backgroundGlsl?: string; // defines vec3 background(vec2 uv)
};

const DOF_FRAG = (surfaceKind: "plane" | "sphere") => /* glsl */ `
uniform sampler2D src; uniform mat4 invViewProj; uniform vec3 camPos;
uniform vec3 pNormal; uniform float pD; uniform vec4 sph; // center, radius
uniform float focusDist; uniform float cocScale; uniform float farScale; uniform float maxCoc; uniform vec2 res;
float hitDist(vec2 uv) {
  vec4 p = invViewProj * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
  vec3 dir = normalize(p.xyz / p.w - camPos);
  ${
    surfaceKind === "plane"
      ? `float dn = dot(dir, pNormal);
  float t = (pD - dot(camPos, pNormal)) / (abs(dn) < 1e-5 ? 1e-5 : dn);
  return t > 0.0 ? t : 1e4;`
      : `vec3 o = camPos - sph.xyz;
  float b = dot(o, dir), c = dot(o, o) - sph.w * sph.w;
  float disc = b * b - c;
  if (disc < 0.0) return 1e4;
  float t = -b - sqrt(disc);
  return t > 0.0 ? t : 1e4;`
  }
}
float cocAt(vec2 uv) {
  float dist = hitDist(uv);
  float x = focusDist / dist - 1.0;  // >0 near, <0 far
  float s = x > 0.0 ? cocScale : farScale;
  return clamp(abs(x) * s, 0.0, maxCoc);
}
void main() {
  float coc = cocAt(vUv);           // fraction of frame height
  float rPx = coc * res.y;
  if (rPx < 0.5) { outColor = vec4(texture(src, vUv).rgb, 1.0); return; }
  const int N = 72;
  float lod = max(0.0, log2(rPx * 1.6 / sqrt(float(N))));
  vec3 acc = vec3(0.0); float wsum = 0.0;
  for (int i = 0; i < N; i++) {
    float fi = float(i) + 0.5;
    float r = sqrt(fi / float(N));
    float a = fi * 2.39996323;
    vec2 off = vec2(cos(a), sin(a)) * r * rPx / res;
    vec3 c = textureLod(src, vUv + off, lod).rgb;
    float w = 1.0 + 0.6 * r; // slight edge-bright bokeh
    acc += c * w; wsum += w;
  }
  outColor = vec4(acc / wsum, 1.0);
}`;

const FINAL_FRAG = (bg?: string) => /* glsl */ `
uniform sampler2D scene; uniform sampler2D bloom; uniform float bloomStrength; uniform float exposure;
uniform float loopFrame; uniform float vignette; uniform float grain; uniform float grainFloor; uniform vec2 res;
${bg ?? "vec3 background(vec2 uv) { return vec3(0.0); }"}
${FINISH_GLSL}
void main() {
  vec3 c = texture(scene, vUv).rgb + background(vUv) + texture(bloom, vUv).rgb * bloomStrength;
  c = softClip(min(c, vec3(1e3)) * exposure, 0.75);
  outColor = vec4(finish(c, vUv, floor(gl_FragCoord.xy), loopFrame, vignette, grain, grainFloor), 1.0);
}`;

export class PostPipeline {
  readonly sceneRT: THREE.WebGLRenderTarget;
  private resolved: THREE.WebGLRenderTarget | null = null; // mipmapped copy for DoF
  private dofRT: THREE.WebGLRenderTarget | null = null;
  private down: THREE.WebGLRenderTarget[] = [];
  private up: THREE.WebGLRenderTarget[] = [];
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: THREE.Mesh;
  private copyMat = makePass("uniform sampler2D src; void main(){ outColor = vec4(texture(src, vUv).rgb, 1.0); }", { src: { value: null } });
  private downMat = makePass(DOWN, { src: { value: null }, texel: { value: new THREE.Vector2() }, prefilter: { value: 0 }, threshold: { value: 0 } });
  private upMat = makePass(UP, { src: { value: null }, base: { value: null }, texel: { value: new THREE.Vector2() }, radius: { value: 1 } });
  private dofMat: THREE.RawShaderMaterial | null = null;
  private finalMat: THREE.RawShaderMaterial;

  constructor(
    private width: number,
    private height: number,
    private opts: PostOptions,
  ) {
    this.sceneRT = rt(width, height, false, 4);
    if (opts.dof) {
      this.resolved = rt(width, height, true);
      this.dofRT = rt(width, height);
      const s = opts.dof.surface;
      this.dofMat = makePass(DOF_FRAG(s.kind), {
        src: { value: null },
        invViewProj: { value: new THREE.Matrix4() },
        camPos: { value: new THREE.Vector3() },
        pNormal: { value: s.kind === "plane" ? s.normal.clone().normalize() : new THREE.Vector3(0, 1, 0) },
        pD: { value: s.kind === "plane" ? s.d : 0 },
        sph: { value: s.kind === "sphere" ? new THREE.Vector4(s.center.x, s.center.y, s.center.z, s.radius) : new THREE.Vector4() },
        focusDist: { value: opts.dof.focusDist },
        cocScale: { value: opts.dof.scale },
        farScale: { value: opts.dof.farScale ?? opts.dof.scale },
        maxCoc: { value: opts.dof.maxCoc },
        res: { value: new THREE.Vector2(width, height) },
      });
    }
    const levels = opts.bloomLevels ?? 7;
    let w = width, h = height;
    for (let i = 0; i < levels; i++) {
      w = Math.max(1, Math.floor(w / 2));
      h = Math.max(1, Math.floor(h / 2));
      this.down.push(rt(w, h));
      this.up.push(rt(w, h));
    }
    this.finalMat = makePass(FINAL_FRAG(opts.backgroundGlsl), {
      scene: { value: null },
      bloom: { value: null },
      bloomStrength: { value: opts.bloomStrength },
      exposure: { value: opts.exposure },
      loopFrame: { value: 0 },
      vignette: { value: opts.vignette },
      grain: { value: opts.grain },
      grainFloor: { value: opts.grainFloor },
      res: { value: new THREE.Vector2(width, height) },
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.quad = new THREE.Mesh(geo, this.copyMat);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  private pass(gl: THREE.WebGLRenderer, mat: THREE.Material, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    gl.setRenderTarget(target);
    gl.render(this.quadScene, this.quadCam);
  }

  render(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, loopFrame: number) {
    gl.autoClear = true;
    gl.setClearColor(0x000000, 1);
    gl.setRenderTarget(this.sceneRT);
    gl.clear(true, true, true);
    gl.render(scene, camera);
    let src: THREE.Texture = this.sceneRT.texture;

    if (this.dofMat && this.resolved && this.dofRT) {
      // Resolve MSAA into a mipmapped target, then gather-blur by analytic CoC.
      this.copyMat.uniforms.src.value = src;
      this.pass(gl, this.copyMat, this.resolved);
      const u = this.dofMat.uniforms;
      camera.updateMatrixWorld();
      u.invViewProj.value.multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse);
      u.camPos.value.setFromMatrixPosition(camera.matrixWorld);
      u.src.value = this.resolved.texture;
      this.pass(gl, this.dofMat, this.dofRT);
      src = this.dofRT.texture;
    }

    // Bloom chain.
    let prev: THREE.Texture = src;
    let pw = this.width, ph = this.height;
    this.down.forEach((target, i) => {
      this.downMat.uniforms.src.value = prev;
      this.downMat.uniforms.texel.value.set(1 / pw, 1 / ph);
      this.downMat.uniforms.prefilter.value = i === 0 ? 1 : 0;
      this.downMat.uniforms.threshold.value = this.opts.bloomThreshold;
      this.pass(gl, this.downMat, target);
      prev = target.texture;
      pw = target.width;
      ph = target.height;
    });
    let upSrc: THREE.Texture = this.down[this.down.length - 1].texture;
    for (let i = this.down.length - 2; i >= 0; i--) {
      const lower = i + 1 === this.down.length - 1 ? this.down[i + 1] : this.up[i + 1];
      this.upMat.uniforms.src.value = upSrc;
      this.upMat.uniforms.base.value = this.down[i].texture;
      this.upMat.uniforms.texel.value.set(1 / lower.width, 1 / lower.height);
      this.upMat.uniforms.radius.value = this.opts.bloomRadius;
      this.pass(gl, this.upMat, this.up[i]);
      upSrc = this.up[i].texture;
    }

    const f = this.finalMat.uniforms;
    f.scene.value = src;
    f.bloom.value = upSrc;
    f.loopFrame.value = loopFrame;
    this.pass(gl, this.finalMat, null);
  }

  dispose() {
    [this.sceneRT, this.resolved, this.dofRT, ...this.down, ...this.up].forEach((t) => t?.dispose());
  }
}
