import * as THREE from "three";
import { FULLSCREEN_VERT, GLSL_HASH } from "./glsl";

/**
 * Small deterministic post pipeline shared by the 3D looks:
 *   scene (HDR, 4x MSAA, depth texture)
 *     -> depth-of-field (scatter-as-gather disc, per-pixel circle of confusion)
 *     -> bloom (soft threshold + dual-filter mip chain)
 *     -> look-specific composite (background, grade, grain, dither) to the canvas.
 * No temporal accumulation anywhere: each frame is rendered from scratch.
 */

const triangle = (() => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
  return g;
})();

export const rawPass = (fragmentShader: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: `precision highp float;\nprecision highp int;\n${fragmentShader}`,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });

export class FullscreenQuad {
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private mesh = new THREE.Mesh(triangle);
  constructor() {
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }
  draw(gl: THREE.WebGLRenderer, material: THREE.Material, target: THREE.WebGLRenderTarget | null) {
    this.mesh.material = material;
    gl.setRenderTarget(target);
    gl.render(this.scene, this.camera);
  }
}

/** Shared tail for composite shaders: highlight roll-off, grain, dither. */
export const GLSL_FINISH = /* glsl */ `
${GLSL_HASH}
vec3 softClip(vec3 x) {
  const float k = 0.72;
  vec3 over = max(x - k, 0.0);
  return min(x, vec3(k)) + (1.0 - k) * (1.0 - exp(-over / (1.0 - k)));
}
// grainAmt 0.049 -> ~2% standard deviation (triangular noise has sd 0.408).
vec3 finish(vec3 c, vec2 fragCoord, uint frame, float grainAmt) {
  c = softClip(max(c, 0.0));
  c += triNoise(fragCoord, frame, 0u) * grainAmt;
  c += triNoise(fragCoord, frame, 2u) / 255.0;
  return clamp(c, 0.0, 1.0);
}
`;

const COC_GLSL = /* glsl */ `
uniform float uNear, uFar, uFocus, uCocScale, uMaxCoc;
float linDepth(float z) {
  float n = z * 2.0 - 1.0;
  return 2.0 * uNear * uFar / (uFar + uNear - n * (uFar - uNear));
}
float cocAt(float d) { return clamp(abs(1.0 / d - 1.0 / uFocus) * uCocScale, 0.0, uMaxCoc); }
`;

// Max circle of confusion of *geometry* (background ignored) per 8x8 pixel tile.
const TILE = 8;
const TILE_FRAG = /* glsl */ `
uniform sampler2D tDepth;
${COC_GLSL}
out vec4 outColor;
void main() {
  ivec2 size = textureSize(tDepth, 0);
  ivec2 base = ivec2(gl_FragCoord.xy) * ${TILE};
  float m = 0.0;
  for (int j = 0; j < ${TILE}; j++) {
    for (int i = 0; i < ${TILE}; i++) {
      float z = texelFetch(tDepth, min(base + ivec2(i, j), size - 1), 0).r;
      if (z < 0.99999) m = max(m, cocAt(linDepth(z)));
    }
  }
  outColor = vec4(m, 0.0, 0.0, 1.0);
}
`;
const DILATE_FRAG = /* glsl */ `
uniform sampler2D tTiles;
uniform int uRadius;
out vec4 outColor;
void main() {
  ivec2 size = textureSize(tTiles, 0);
  ivec2 c = ivec2(gl_FragCoord.xy);
  float m = 0.0;
  for (int j = -12; j <= 12; j++) {
    if (j < -uRadius || j > uRadius) continue;
    for (int i = -12; i <= 12; i++) {
      if (i < -uRadius || i > uRadius) continue;
      m = max(m, texelFetch(tTiles, clamp(c + ivec2(i, j), ivec2(0), size - 1), 0).r);
    }
  }
  outColor = vec4(m, 0.0, 0.0, 1.0);
}
`;

const DOF_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tTiles;
uniform vec2 uTexel;
${COC_GLSL}
in vec2 vUv;
out vec4 outColor;
#define TAPS 48
void main() {
  vec4 acc = texture(tColor, vUv);
  // No out-of-focus geometry within reach: the gather would return this pixel unchanged.
  float reach = texelFetch(tTiles, ivec2(gl_FragCoord.xy) / ${TILE}, 0).r;
  if (reach < 0.5) { outColor = acc; return; }
  float radius = min(uMaxCoc, reach + 1.0);
  float dc = linDepth(texture(tDepth, vUv).r);
  float cc = cocAt(dc);
  float wsum = 1.0;
  for (int i = 0; i < TAPS; i++) {
    float fi = float(i) + 0.5;
    float r = sqrt(fi / float(TAPS)) * radius;
    float a = fi * 2.39996323;
    vec2 suv = vUv + vec2(cos(a), sin(a)) * r * uTexel;
    float ds = linDepth(texture(tDepth, suv).r);
    float cs = cocAt(ds);
    // A sharp pixel is never covered by blur from geometry behind it.
    if (ds > dc) cs = min(cs, cc);
    float w = clamp(cs - r + 1.0, 0.0, 1.0);
    acc += texture(tColor, suv) * w;
    wsum += w;
  }
  outColor = acc / wsum;
}
`;

const PREFILTER_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uSrcTexel;
uniform float uThreshold, uKnee;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec2 h = uSrcTexel * 0.5;
  vec3 c = (texture(tSrc, vUv + vec2(-h.x, -h.y)).rgb + texture(tSrc, vUv + vec2(h.x, -h.y)).rgb +
            texture(tSrc, vUv + vec2(-h.x, h.y)).rgb + texture(tSrc, vUv + vec2(h.x, h.y)).rgb) * 0.25;
  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-4);
  float contrib = max(soft, br - uThreshold) / max(br, 1e-4);
  outColor = vec4(c * contrib, 1.0);
}
`;

const DOWN_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uSrcTexel;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec2 h = uSrcTexel;
  vec3 s = texture(tSrc, vUv).rgb * 4.0;
  s += texture(tSrc, vUv - h).rgb;
  s += texture(tSrc, vUv + h).rgb;
  s += texture(tSrc, vUv + vec2(h.x, -h.y)).rgb;
  s += texture(tSrc, vUv - vec2(h.x, -h.y)).rgb;
  outColor = vec4(s / 8.0, 1.0);
}
`;

const UP_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform sampler2D tBase;
uniform vec2 uSrcTexel;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec2 h = uSrcTexel;
  vec3 s = texture(tSrc, vUv + vec2(-h.x * 2.0, 0.0)).rgb;
  s += texture(tSrc, vUv + vec2(-h.x, h.y)).rgb * 2.0;
  s += texture(tSrc, vUv + vec2(0.0, h.y * 2.0)).rgb;
  s += texture(tSrc, vUv + vec2(h.x, h.y)).rgb * 2.0;
  s += texture(tSrc, vUv + vec2(h.x * 2.0, 0.0)).rgb;
  s += texture(tSrc, vUv + vec2(h.x, -h.y)).rgb * 2.0;
  s += texture(tSrc, vUv + vec2(0.0, -h.y * 2.0)).rgb;
  s += texture(tSrc, vUv + vec2(-h.x, -h.y)).rgb * 2.0;
  outColor = vec4(s / 12.0 + texture(tBase, vUv).rgb, 1.0);
}
`;

export type PostParams = {
  near: number;
  far: number;
  focus: number;
  /** Circle of confusion in px (at 1080 lines) per unit of |1/d - 1/focus|. */
  cocScale: number;
  /** Largest blur radius in px at 1080 lines. */
  maxCoc: number;
  bloomThreshold: number;
  bloomKnee: number;
};

const BLOOM_LEVELS = 6;

const makeTarget = (w: number, h: number, extra: Partial<THREE.RenderTargetOptions> = {}) =>
  new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    generateMipmaps: false,
    ...extra,
  });

export class PostPipeline {
  readonly composite: THREE.RawShaderMaterial;
  private quad = new FullscreenQuad();
  private width = 0;
  private height = 0;
  private sceneRT: THREE.WebGLRenderTarget | null = null;
  private dofRT: THREE.WebGLRenderTarget | null = null;
  private tileRT: THREE.WebGLRenderTarget | null = null;
  private tileDilRT: THREE.WebGLRenderTarget | null = null;
  private down: THREE.WebGLRenderTarget[] = [];
  private up: THREE.WebGLRenderTarget[] = [];
  private cocUniforms = () => ({
    uNear: { value: 0.1 },
    uFar: { value: 100 },
    uFocus: { value: 5 },
    uCocScale: { value: 1 },
    uMaxCoc: { value: 1 },
  });
  private tilePass = rawPass(TILE_FRAG, { tDepth: { value: null }, ...this.cocUniforms() });
  private dilatePass = rawPass(DILATE_FRAG, { tTiles: { value: null }, uRadius: { value: 1 } });
  private dof = rawPass(DOF_FRAG, {
    tColor: { value: null },
    tDepth: { value: null },
    tTiles: { value: null },
    uTexel: { value: new THREE.Vector2() },
    uNear: { value: 0.1 },
    uFar: { value: 100 },
    uFocus: { value: 5 },
    uCocScale: { value: 1 },
    uMaxCoc: { value: 1 },
  });
  private prefilter = rawPass(PREFILTER_FRAG, {
    tSrc: { value: null },
    uSrcTexel: { value: new THREE.Vector2() },
    uThreshold: { value: 1 },
    uKnee: { value: 0.5 },
  });
  private downPass = rawPass(DOWN_FRAG, { tSrc: { value: null }, uSrcTexel: { value: new THREE.Vector2() } });
  private upPass = rawPass(UP_FRAG, {
    tSrc: { value: null },
    tBase: { value: null },
    uSrcTexel: { value: new THREE.Vector2() },
  });

  /**
   * `compositeFrag` receives: tScene (premultiplied HDR after DoF), tBloom,
   * uRes (drawing-buffer px), plus any uniforms passed in.
   */
  constructor(compositeFrag: string, compositeUniforms: Record<string, THREE.IUniform>) {
    this.composite = rawPass(compositeFrag, {
      tScene: { value: null },
      tBloom: { value: null },
      uRes: { value: new THREE.Vector2() },
      ...compositeUniforms,
    });
  }

  private ensureSize(w: number, h: number) {
    if (w === this.width && h === this.height && this.sceneRT) return;
    this.dispose();
    this.width = w;
    this.height = h;
    const depthTexture = new THREE.DepthTexture(w, h);
    depthTexture.type = THREE.UnsignedIntType;
    this.sceneRT = makeTarget(w, h, { depthBuffer: true, samples: 4, depthTexture });
    this.dofRT = makeTarget(w, h);
    const tw = Math.ceil(w / TILE);
    const th = Math.ceil(h / TILE);
    const tileOpts = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter };
    this.tileRT = makeTarget(tw, th, tileOpts);
    this.tileDilRT = makeTarget(tw, th, tileOpts);
    let bw = w;
    let bh = h;
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      bw = Math.max(1, Math.floor(bw / 2));
      bh = Math.max(1, Math.floor(bh / 2));
      this.down.push(makeTarget(bw, bh));
      if (i < BLOOM_LEVELS - 1) this.up.push(makeTarget(bw, bh));
    }
  }

  dispose() {
    this.sceneRT?.depthTexture?.dispose();
    this.sceneRT?.dispose();
    this.dofRT?.dispose();
    this.tileRT?.dispose();
    this.tileDilRT?.dispose();
    this.down.forEach((t) => t.dispose());
    this.up.forEach((t) => t.dispose());
    this.down = [];
    this.up = [];
    this.sceneRT = null;
  }

  render(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, p: PostParams) {
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    const w = size.x;
    const h = size.y;
    this.ensureSize(w, h);
    const sceneRT = this.sceneRT!;
    const dofRT = this.dofRT!;
    const res = h / 1080;

    gl.autoClear = true;
    gl.setClearColor(0x000000, 0);
    gl.setRenderTarget(sceneRT);
    gl.clear(true, true, true);
    gl.render(scene, camera);

    const maxCoc = Math.max(1, p.maxCoc * res);
    for (const m of [this.tilePass, this.dof]) {
      m.uniforms.uNear.value = p.near;
      m.uniforms.uFar.value = p.far;
      m.uniforms.uFocus.value = p.focus;
      m.uniforms.uCocScale.value = p.cocScale * res;
      m.uniforms.uMaxCoc.value = maxCoc;
    }
    this.tilePass.uniforms.tDepth.value = sceneRT.depthTexture;
    this.quad.draw(gl, this.tilePass, this.tileRT);
    this.dilatePass.uniforms.tTiles.value = this.tileRT!.texture;
    this.dilatePass.uniforms.uRadius.value = Math.min(12, Math.ceil(maxCoc / TILE) + 1);
    this.quad.draw(gl, this.dilatePass, this.tileDilRT);

    const du = this.dof.uniforms;
    du.tColor.value = sceneRT.texture;
    du.tDepth.value = sceneRT.depthTexture;
    du.tTiles.value = this.tileDilRT!.texture;
    du.uTexel.value.set(1 / w, 1 / h);
    this.quad.draw(gl, this.dof, dofRT);

    const pu = this.prefilter.uniforms;
    pu.tSrc.value = dofRT.texture;
    pu.uSrcTexel.value.set(1 / w, 1 / h);
    pu.uThreshold.value = p.bloomThreshold;
    pu.uKnee.value = p.bloomKnee;
    this.quad.draw(gl, this.prefilter, this.down[0]);
    for (let i = 1; i < BLOOM_LEVELS; i++) {
      const src = this.down[i - 1];
      this.downPass.uniforms.tSrc.value = src.texture;
      this.downPass.uniforms.uSrcTexel.value.set(1 / src.width, 1 / src.height);
      this.quad.draw(gl, this.downPass, this.down[i]);
    }
    let src = this.down[BLOOM_LEVELS - 1];
    for (let i = BLOOM_LEVELS - 2; i >= 0; i--) {
      this.upPass.uniforms.tSrc.value = src.texture;
      this.upPass.uniforms.tBase.value = this.down[i].texture;
      this.upPass.uniforms.uSrcTexel.value.set(1 / src.width, 1 / src.height);
      this.quad.draw(gl, this.upPass, this.up[i]);
      src = this.up[i];
    }

    const cu = this.composite.uniforms;
    cu.tScene.value = dofRT.texture;
    cu.tBloom.value = this.up[0].texture;
    cu.uRes.value.set(w, h);
    this.quad.draw(gl, this.composite, null);
  }
}
