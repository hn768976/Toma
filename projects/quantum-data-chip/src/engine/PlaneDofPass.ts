import * as THREE from "three";
import { Pass, FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";

/**
 * Depth-of-field for scenes built on a ground plane (y = planeY).
 * Instead of a depth buffer, depth is computed analytically per pixel by
 * intersecting the view ray with the plane. This keeps the blur perfectly
 * smooth and resolution independent (blur sizes are fractions of the frame
 * height, so 1080p and 4K renders look the same).
 *
 * The image is pre-blurred into four gaussian levels (half/quarter res) and
 * each pixel blends between the sharp image and those levels according to
 * its circle of confusion.
 */
const blurFrag = /* glsl */ `
  uniform sampler2D tSrc;
  uniform vec2 uStep;   // uv step of one destination pixel along the blur axis
  uniform float uSigma; // in destination pixels
  varying vec2 vUv;
  void main(){
    if (uSigma < 0.05) { gl_FragColor = texture2D(tSrc, vUv); return; }
    float radius = ceil(uSigma * 3.0);
    vec4 acc = texture2D(tSrc, vUv);
    float wsum = 1.0;
    float inv = 1.0 / (2.0 * uSigma * uSigma);
    // linear sampling: two taps per fetch
    for (int k = 0; k < 64; k++) {
      float i = 1.0 + 2.0 * float(k);
      if (i > radius) break;
      float w1 = exp(-i * i * inv);
      float w2 = exp(-(i + 1.0) * (i + 1.0) * inv);
      float w = w1 + w2;
      float o = (i * w1 + (i + 1.0) * w2) / w;
      acc += texture2D(tSrc, vUv + uStep * o) * w;
      acc += texture2D(tSrc, vUv - uStep * o) * w;
      wsum += 2.0 * w;
    }
    gl_FragColor = acc / wsum;
  }
`;

const quadVert = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const compositeFrag = /* glsl */ `
  uniform sampler2D tSharp;
  uniform sampler2D tL1;
  uniform sampler2D tL2;
  uniform sampler2D tL3;
  uniform sampler2D tL4;
  uniform mat4 uInvProj;
  uniform mat4 uCamWorld;
  uniform vec3 uCamPos;
  uniform float uPlaneY;
  uniform float uFocus;
  uniform float uAperture;
  uniform float uNearMul;
  uniform float uMaxBlur;
  uniform float uSkyBlur;
  varying vec2 vUv;
  void main(){
    vec4 ndc = vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
    vec4 v = uInvProj * ndc; v /= v.w;
    vec3 dv = normalize(v.xyz);
    vec3 dw = (uCamWorld * vec4(dv, 0.0)).xyz;
    float coc;
    if (dw.y < -1e-4) {
      float t = (uPlaneY - uCamPos.y) / dw.y;
      float depth = t * (-dv.z);
      float c = uAperture * (depth - uFocus) / depth;
      coc = c < 0.0 ? -c * uNearMul : c;
    } else {
      coc = uSkyBlur;
    }
    float lv = clamp(coc / uMaxBlur, 0.0, 1.0) * 4.0;
    vec4 s0 = texture2D(tSharp, vUv);
    vec4 c;
    if (lv < 1.0) c = mix(s0, texture2D(tL1, vUv), lv);
    else if (lv < 2.0) c = mix(texture2D(tL1, vUv), texture2D(tL2, vUv), lv - 1.0);
    else if (lv < 3.0) c = mix(texture2D(tL2, vUv), texture2D(tL3, vUv), lv - 2.0);
    else c = mix(texture2D(tL3, vUv), texture2D(tL4, vUv), lv - 3.0);
    gl_FragColor = c;
  }
`;

export type DofParams = {
  focus: number; // view depth that is in focus
  aperture: number; // blur growth (fraction of height)
  maxBlur: number; // sigma of the strongest blur level, fraction of height
  nearMul?: number; // extra blur for foreground
  skyBlur?: number;
  planeY?: number;
};

export class PlaneDofPass extends Pass {
  camera: THREE.PerspectiveCamera;
  params: DofParams;
  private half: THREE.WebGLRenderTarget[];
  private quarter: THREE.WebGLRenderTarget[];
  private blurMat: THREE.ShaderMaterial;
  private compMat: THREE.ShaderMaterial;
  private blurQuad: FullScreenQuad;
  private compQuad: FullScreenQuad;
  private h = 1;

  constructor(camera: THREE.PerspectiveCamera, params: DofParams) {
    super();
    this.camera = camera;
    this.params = params;
    const mk = () =>
      new THREE.WebGLRenderTarget(1, 1, {
        type: THREE.HalfFloatType,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
      });
    this.half = [mk(), mk(), mk()]; // L1, L2, temp
    this.quarter = [mk(), mk(), mk()]; // L3, L4, temp
    this.blurMat = new THREE.ShaderMaterial({
      vertexShader: quadVert,
      fragmentShader: blurFrag,
      uniforms: { tSrc: { value: null }, uStep: { value: new THREE.Vector2() }, uSigma: { value: 1 } },
      depthTest: false,
      depthWrite: false,
    });
    this.compMat = new THREE.ShaderMaterial({
      vertexShader: quadVert,
      fragmentShader: compositeFrag,
      uniforms: {
        tSharp: { value: null },
        tL1: { value: null },
        tL2: { value: null },
        tL3: { value: null },
        tL4: { value: null },
        uInvProj: { value: new THREE.Matrix4() },
        uCamWorld: { value: new THREE.Matrix4() },
        uCamPos: { value: new THREE.Vector3() },
        uPlaneY: { value: 0 },
        uFocus: { value: 5 },
        uAperture: { value: 0.01 },
        uNearMul: { value: 1 },
        uMaxBlur: { value: 0.01 },
        uSkyBlur: { value: 0.01 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.blurQuad = new FullScreenQuad(this.blurMat);
    this.compQuad = new FullScreenQuad(this.compMat);
  }

  setSize(width: number, height: number) {
    this.h = height;
    const hw = Math.max(1, Math.round(width / 2));
    const hh = Math.max(1, Math.round(height / 2));
    const qw = Math.max(1, Math.round(width / 4));
    const qh = Math.max(1, Math.round(height / 4));
    this.half.forEach((t) => t.setSize(hw, hh));
    this.quarter.forEach((t) => t.setSize(qw, qh));
  }

  private blur(
    renderer: THREE.WebGLRenderer,
    src: THREE.Texture,
    dst: THREE.WebGLRenderTarget,
    tmp: THREE.WebGLRenderTarget,
    sigmaPx: number,
  ) {
    const w = dst.width;
    const h = dst.height;
    this.blurMat.uniforms.uSigma.value = sigmaPx;
    this.blurMat.uniforms.tSrc.value = src;
    this.blurMat.uniforms.uStep.value.set(1 / w, 0);
    renderer.setRenderTarget(tmp);
    this.blurQuad.render(renderer);
    this.blurMat.uniforms.tSrc.value = tmp.texture;
    this.blurMat.uniforms.uStep.value.set(0, 1 / h);
    renderer.setRenderTarget(dst);
    this.blurQuad.render(renderer);
  }

  render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget,
  ) {
    const p = this.params;
    const S = p.maxBlur * this.h; // sigma (full-res pixels) of level 4
    const s = [0.25, 0.5, 0.75, 1].map((k) => k * S);
    const add = (a: number, b: number) => Math.sqrt(Math.max(0, b * b - a * a));
    const [L1, L2, Ht] = this.half;
    const [L3, L4, Qt] = this.quarter;
    // sigmas expressed in destination pixels (half res = /2, quarter = /4)
    this.blur(renderer, readBuffer.texture, L1, Ht, s[0] / 2);
    this.blur(renderer, L1.texture, L2, Ht, add(s[0], s[1]) / 2);
    this.blur(renderer, L1.texture, L3, Qt, add(s[0], s[2]) / 4);
    this.blur(renderer, L3.texture, L4, Qt, add(s[2], s[3]) / 4);

    const u = this.compMat.uniforms;
    this.camera.updateMatrixWorld();
    u.tSharp.value = readBuffer.texture;
    u.tL1.value = L1.texture;
    u.tL2.value = L2.texture;
    u.tL3.value = L3.texture;
    u.tL4.value = L4.texture;
    u.uInvProj.value.copy(this.camera.projectionMatrixInverse);
    u.uCamWorld.value.copy(this.camera.matrixWorld);
    u.uCamPos.value.copy(this.camera.position);
    u.uPlaneY.value = p.planeY ?? 0;
    u.uFocus.value = p.focus;
    u.uAperture.value = p.aperture;
    u.uNearMul.value = p.nearMul ?? 1;
    u.uMaxBlur.value = p.maxBlur;
    u.uSkyBlur.value = p.skyBlur ?? p.maxBlur;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.compQuad.render(renderer);
  }

  dispose() {
    [...this.half, ...this.quarter].forEach((t) => t.dispose());
    this.blurMat.dispose();
    this.compMat.dispose();
    this.blurQuad.dispose();
    this.compQuad.dispose();
  }
}
