import * as THREE from "three";
import { FULLSCREEN_VERT } from "./glsl";

/** One big triangle covering the viewport, rendered with an arbitrary material. */
export class FullscreenPass {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly mesh: THREE.Mesh;

  constructor() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3),
    );
    this.mesh = new THREE.Mesh(geo);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }

  render(
    gl: THREE.WebGLRenderer,
    material: THREE.Material,
    target: THREE.WebGLRenderTarget | null,
  ) {
    this.mesh.material = material;
    gl.setRenderTarget(target);
    gl.render(this.scene, this.camera);
  }

  dispose() {
    this.mesh.geometry.dispose();
  }
}

/** RawShaderMaterial for a fullscreen pass (GLSL3, no depth). */
export const passMaterial = (
  fragmentShader: string,
  uniforms: Record<string, THREE.IUniform>,
) =>
  new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: FULLSCREEN_VERT,
    fragmentShader: "precision highp float;\nprecision highp int;\n" + fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });

export const makeTarget = (
  w: number,
  h: number,
  opts: Partial<THREE.RenderTargetOptions> = {},
) =>
  new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.ClampToEdgeWrapping,
    wrapT: THREE.ClampToEdgeWrapping,
    depthBuffer: false,
    ...opts,
  });

const DOWN_FRAG = /* glsl */ `
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uSrc;
uniform vec2 uTexel;      // 1 / source size
uniform float uThreshold; // < 0 disables the prefilter (only used on level 0)
uniform float uKnee;
vec3 prefilter(vec3 c) {
  if (uThreshold < 0.0) return c;
  float br = max(c.r, max(c.g, c.b));
  float rq = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  rq = rq * rq / (4.0 * uKnee + 1e-5);
  float w = max(rq, br - uThreshold) / max(br, 1e-5);
  return c * w;
}
void main() {
  // 13-tap "Call of Duty" downsample: stable, no fireflies, fully deterministic.
  vec2 t = uTexel;
  vec3 a = texture(uSrc, vUv + t * vec2(-2.0, 2.0)).rgb;
  vec3 b = texture(uSrc, vUv + t * vec2(0.0, 2.0)).rgb;
  vec3 c = texture(uSrc, vUv + t * vec2(2.0, 2.0)).rgb;
  vec3 d = texture(uSrc, vUv + t * vec2(-2.0, 0.0)).rgb;
  vec3 e = texture(uSrc, vUv).rgb;
  vec3 f = texture(uSrc, vUv + t * vec2(2.0, 0.0)).rgb;
  vec3 g = texture(uSrc, vUv + t * vec2(-2.0, -2.0)).rgb;
  vec3 h = texture(uSrc, vUv + t * vec2(0.0, -2.0)).rgb;
  vec3 i = texture(uSrc, vUv + t * vec2(2.0, -2.0)).rgb;
  vec3 j = texture(uSrc, vUv + t * vec2(-1.0, 1.0)).rgb;
  vec3 k = texture(uSrc, vUv + t * vec2(1.0, 1.0)).rgb;
  vec3 l = texture(uSrc, vUv + t * vec2(-1.0, -1.0)).rgb;
  vec3 m = texture(uSrc, vUv + t * vec2(1.0, -1.0)).rgb;
  vec3 s = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  outColor = vec4(prefilter(s), 1.0);
}
`;

const UP_FRAG = /* glsl */ `
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uLow;   // coarser level (being upsampled)
uniform sampler2D uHigh;  // finer level of the down chain
uniform vec2 uTexel;      // 1 / coarse size
uniform float uRadius;
void main() {
  vec2 t = uTexel * uRadius;
  vec3 s = texture(uLow, vUv).rgb * 4.0;
  s += (texture(uLow, vUv + vec2(-t.x, 0.0)).rgb + texture(uLow, vUv + vec2(t.x, 0.0)).rgb +
        texture(uLow, vUv + vec2(0.0, -t.y)).rgb + texture(uLow, vUv + vec2(0.0, t.y)).rgb) * 2.0;
  s += texture(uLow, vUv + vec2(-t.x, -t.y)).rgb + texture(uLow, vUv + vec2(t.x, -t.y)).rgb +
       texture(uLow, vUv + vec2(-t.x, t.y)).rgb + texture(uLow, vUv + vec2(t.x, t.y)).rgb;
  outColor = vec4(s / 16.0 + texture(uHigh, vUv).rgb, 1.0);
}
`;

/**
 * Deterministic bloom: a fixed mip chain (13-tap down, 3x3 tent up). The level
 * count is chosen from the frame height so the bloom radius is the same fraction
 * of the frame at 720p, 4K and 6K.
 */
export class BloomChain {
  private downs: THREE.WebGLRenderTarget[] = [];
  private ups: THREE.WebGLRenderTarget[] = [];
  private readonly downMat = passMaterial(DOWN_FRAG, {
    uSrc: { value: null },
    uTexel: { value: new THREE.Vector2() },
    uThreshold: { value: -1 },
    uKnee: { value: 0.5 },
  });
  private readonly upMat = passMaterial(UP_FRAG, {
    uLow: { value: null },
    uHigh: { value: null },
    uTexel: { value: new THREE.Vector2() },
    uRadius: { value: 1 },
  });
  private w = 0;
  private h = 0;

  constructor(private readonly pass: FullscreenPass) {}

  private resize(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    this.disposeTargets();
    this.w = w;
    this.h = h;
    // Coarsest level ~ 1/64 of a 2160 frame height -> keep ~34 px; scale levels with height.
    const levels = Math.max(3, Math.round(Math.log2(h / 34)));
    let cw = w;
    let ch = h;
    for (let i = 0; i < levels; i++) {
      cw = Math.max(1, Math.floor(cw / 2));
      ch = Math.max(1, Math.floor(ch / 2));
      this.downs.push(makeTarget(cw, ch));
      if (i < levels - 1) this.ups.push(makeTarget(cw, ch));
    }
  }

  /** Returns a texture (half the source resolution) holding the bloom. */
  render(
    gl: THREE.WebGLRenderer,
    src: THREE.Texture,
    srcW: number,
    srcH: number,
    threshold: number,
    knee: number,
  ): THREE.Texture {
    this.resize(srcW, srcH);
    let input: THREE.Texture = src;
    let iw = srcW;
    let ih = srcH;
    this.downs.forEach((rt, i) => {
      this.downMat.uniforms.uSrc.value = input;
      this.downMat.uniforms.uTexel.value.set(1 / iw, 1 / ih);
      this.downMat.uniforms.uThreshold.value = i === 0 ? threshold : -1;
      this.downMat.uniforms.uKnee.value = knee;
      this.pass.render(gl, this.downMat, rt);
      input = rt.texture;
      iw = rt.width;
      ih = rt.height;
    });
    // Up chain: ups[i] has the size of downs[i]; combine coarser result with downs[i].
    let low: THREE.WebGLRenderTarget = this.downs[this.downs.length - 1];
    for (let i = this.downs.length - 2; i >= 0; i--) {
      const rt = this.ups[i];
      this.upMat.uniforms.uLow.value = low.texture;
      this.upMat.uniforms.uHigh.value = this.downs[i].texture;
      this.upMat.uniforms.uTexel.value.set(1 / low.width, 1 / low.height);
      this.pass.render(gl, this.upMat, rt);
      low = rt;
    }
    return low.texture;
  }

  get levelCount() {
    return this.downs.length;
  }

  private disposeTargets() {
    this.downs.forEach((t) => t.dispose());
    this.ups.forEach((t) => t.dispose());
    this.downs = [];
    this.ups = [];
  }

  dispose() {
    this.disposeTargets();
    this.downMat.dispose();
    this.upMat.dispose();
  }
}
