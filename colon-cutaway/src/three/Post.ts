import * as THREE from "three";
import { HASH } from "./shaders";

// Post chain (all deterministic, no temporal accumulation):
//   scene (MSAA, HDR, depth+stencil) -> CoC prep -> DOF gather -> specks
//   -> bloom (bright pass + 3 blur levels) -> ACES + sRGB + dither + grain.

const FS_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// ACES fit, identical to three.js ACESFilmicToneMapping, and its inverse
// (used so the backdrop lands exactly on the requested display colours).
export const ACES = /* glsl */ `
const mat3 ACESIn = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
const mat3 ACESOut = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
vec3 RRTAndODTFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 acesTonemap(vec3 c, float exposure) {
  c *= exposure / 0.6;
  c = ACESIn * c;
  c = RRTAndODTFit(c);
  c = ACESOut * c;
  return clamp(c, 0.0, 1.0);
}
vec3 invRRT(vec3 y) {
  const float a = 0.0245786, b = 0.000090537, c = 0.983729, d = 0.4329510, e = 0.238081;
  vec3 A = 1.0 - c * y;
  vec3 B = a - d * y;
  vec3 C = -(b + e * y);
  return (-B + sqrt(max(B * B - 4.0 * A * C, 0.0))) / (2.0 * A);
}
vec3 acesInverse(vec3 display, float exposure) {
  vec3 c = inverse(ACESOut) * display;
  c = invRRT(c);
  c = inverse(ACESIn) * c;
  return c * 0.6 / exposure;
}
vec3 srgbToLinear(vec3 c) {
  return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
}
vec3 linearToSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
`;

const PREP_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform float uNear;
uniform float uFar;
uniform float uFocus;
uniform float uAperture; // CoC in px for an object at infinity
uniform float uMaxCoc;
varying vec2 vUv;
float viewZ(float d) {
  return (uNear * uFar) / ((uFar - uNear) * d - uFar);
}
void main() {
  vec4 c = texture2D(tColor, vUv);
  // never let a stray NaN/Inf reach the blur + bloom chain
  if (any(isnan(c.rgb)) || any(isinf(c.rgb))) c.rgb = vec3(0.0);
  c.rgb = min(c.rgb, vec3(64.0));
  float z = -viewZ(texture2D(tDepth, vUv).r);
  float coc = uAperture * (z - uFocus) / max(z, 1e-3);
  coc = clamp(coc, -uMaxCoc, uMaxCoc);
  gl_FragColor = vec4(c.rgb, coc);
}
`;

const DOF_TAPS = 28;
const DOF_FRAG = /* glsl */ `
uniform sampler2D tPrep;
uniform vec2 uTexel;
uniform float uMaxCoc;
varying vec2 vUv;
void main() {
  vec4 c0 = texture2D(tPrep, vUv);
  float r0 = abs(c0.a);
  vec3 acc = c0.rgb;
  float wsum = 1.0;
  if (uMaxCoc > 0.5) {
    for (int i = 0; i < ${DOF_TAPS}; i++) {
      float fi = float(i) + 0.5;
      float r = sqrt(fi / float(${DOF_TAPS})) * uMaxCoc;
      float a = fi * 2.39996323;
      vec4 s = texture2D(tPrep, vUv + vec2(cos(a), sin(a)) * r * uTexel);
      float rs = abs(s.a);
      // nearer samples may bleed over us; farther ones only within our own blur
      float reach = s.a < c0.a ? rs : min(rs, r0);
      float w = clamp(reach - r + 1.0, 0.0, 1.0);
      acc += s.rgb * w;
      wsum += w;
    }
  }
  gl_FragColor = vec4(acc / wsum, 1.0);
}
`;

const BRIGHT_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uThreshold;
varying vec2 vUv;
void main() {
  // 4-tap box downsample, then soft threshold
  vec3 c = texture2D(tSrc, vUv + uTexel * vec2(-0.5, -0.5)).rgb
         + texture2D(tSrc, vUv + uTexel * vec2(0.5, -0.5)).rgb
         + texture2D(tSrc, vUv + uTexel * vec2(-0.5, 0.5)).rgb
         + texture2D(tSrc, vUv + uTexel * vec2(0.5, 0.5)).rgb;
  c *= 0.25;
  float l = max(c.r, max(c.g, c.b));
  float knee = uThreshold * 0.25;
  float soft = clamp(l - uThreshold + knee, 0.0, 2.0 * knee);
  soft = soft * soft / (4.0 * knee + 1e-5);
  float w = max(soft, l - uThreshold) / max(l, 1e-4);
  gl_FragColor = vec4(c * w, 1.0);
}
`;

const BLUR_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uDir; // texel step * direction
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv).rgb * 0.2270270;
  c += texture2D(tSrc, vUv + uDir * 1.3846154).rgb * 0.3162162;
  c += texture2D(tSrc, vUv - uDir * 1.3846154).rgb * 0.3162162;
  c += texture2D(tSrc, vUv + uDir * 3.2307692).rgb * 0.0702703;
  c += texture2D(tSrc, vUv - uDir * 3.2307692).rgb * 0.0702703;
  gl_FragColor = vec4(c, 1.0);
}
`;

const COPY_FRAG = /* glsl */ `
uniform sampler2D tSrc;
varying vec2 vUv;
void main() { gl_FragColor = vec4(texture2D(tSrc, vUv).rgb, 1.0); }
`;

const FINAL_FRAG = /* glsl */ `
${ACES}
${HASH}
uniform sampler2D tColor;
uniform sampler2D tB1;
uniform sampler2D tB2;
uniform sampler2D tB3;
uniform float uBloom;
uniform float uExposure;
uniform float uGrain;
uniform float uFrame;
varying vec2 vUv;
float h3(vec3 p) { return hash13(p); }
void main() {
  vec3 c = texture2D(tColor, vUv).rgb;
  vec3 b = texture2D(tB1, vUv).rgb * 0.5 + texture2D(tB2, vUv).rgb * 0.35 + texture2D(tB3, vUv).rgb * 0.3;
  c += b * uBloom;
  vec3 d = linearToSrgb(acesTonemap(c, uExposure));
  vec2 px = floor(gl_FragCoord.xy);
  // film grain (luma, fixed function of pixel + frame) and +-1/255 TPDF dither
  float g = h3(vec3(px, uFrame * 1.618 + 11.0)) - 0.5;
  d += g * uGrain;
  float t = h3(vec3(px + 0.37, uFrame + 101.0)) + h3(vec3(px + 7.11, uFrame + 211.0)) - 1.0;
  d += t / 255.0;
  gl_FragColor = vec4(clamp(d, 0.0, 1.0), 1.0);
}
`;

const SPECK_VERT = /* glsl */ `
attribute vec4 aSpeck; // size, brightness, phase, unused
uniform float uPxScale;
uniform float uFade;
varying float vBright;
varying float vViewZ;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewZ = -mv.z;
  vBright = aSpeck.y * uFade;
  gl_PointSize = aSpeck.x * uPxScale / max(-mv.z, 0.1);
  gl_Position = projectionMatrix * mv;
}
`;

const SPECK_FRAG = /* glsl */ `
uniform sampler2D tDepth;
uniform vec2 uRes;
uniform float uNear;
uniform float uFar;
varying float vBright;
varying float vViewZ;
float viewZ(float d) {
  return (uNear * uFar) / ((uFar - uNear) * d - uFar);
}
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(q, q);
  if (r2 > 1.0) discard;
  float sceneZ = -viewZ(texture2D(tDepth, gl_FragCoord.xy / uRes).r);
  float vis = smoothstep(-0.2, 0.4, sceneZ - vViewZ);
  // soft out-of-focus disc
  float a = (1.0 - smoothstep(0.35, 1.0, sqrt(r2))) * vBright * vis;
  gl_FragColor = vec4(vec3(a), 1.0);
}
`;

const fsMaterial = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.ShaderMaterial({
    vertexShader: FS_VERT,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });

const halfRT = (w: number, h: number) =>
  new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
  });

export type PostParams = {
  near: number;
  far: number;
  focus: number;
  aperture: number; // in fractions of image height
  maxCoc: number; // fraction of image height
  bloom: number;
  threshold: number;
  exposure: number;
  grain: number;
  frame: number;
};

export class Post {
  readonly sceneRT: THREE.WebGLRenderTarget;
  private prepRT: THREE.WebGLRenderTarget;
  private dofRT: THREE.WebGLRenderTarget;
  private bloomA: THREE.WebGLRenderTarget[] = [];
  private bloomB: THREE.WebGLRenderTarget[] = [];
  private quad: THREE.Mesh;
  private fsScene = new THREE.Scene();
  private fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private prep: THREE.ShaderMaterial;
  private dof: THREE.ShaderMaterial;
  private bright: THREE.ShaderMaterial;
  private blur: THREE.ShaderMaterial;
  private copy: THREE.ShaderMaterial;
  private final: THREE.ShaderMaterial;
  readonly speckMaterial: THREE.ShaderMaterial;

  constructor(
    private renderer: THREE.WebGLRenderer,
    readonly width: number,
    readonly height: number,
    samples: number,
  ) {
    const depthTexture = new THREE.DepthTexture(width, height, THREE.UnsignedInt248Type);
    depthTexture.format = THREE.DepthStencilFormat;
    this.sceneRT = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      samples,
      depthBuffer: true,
      stencilBuffer: true,
      depthTexture,
    });
    this.prepRT = halfRT(width, height);
    this.dofRT = halfRT(width, height);
    let w = width;
    let h = height;
    for (let i = 0; i < 3; i++) {
      w = Math.max(1, Math.floor(w / 2));
      h = Math.max(1, Math.floor(h / 2));
      this.bloomA.push(halfRT(w, h));
      this.bloomB.push(halfRT(w, h));
    }
    const tri = new THREE.BufferGeometry();
    tri.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.quad = new THREE.Mesh(tri);
    this.quad.frustumCulled = false;
    this.fsScene.add(this.quad);

    this.prep = fsMaterial(PREP_FRAG, {
      tColor: { value: this.sceneRT.texture },
      tDepth: { value: depthTexture },
      uNear: { value: 0.1 },
      uFar: { value: 100 },
      uFocus: { value: 10 },
      uAperture: { value: 0 },
      uMaxCoc: { value: 0 },
    });
    this.dof = fsMaterial(DOF_FRAG, {
      tPrep: { value: this.prepRT.texture },
      uTexel: { value: new THREE.Vector2(1 / width, 1 / height) },
      uMaxCoc: { value: 0 },
    });
    this.bright = fsMaterial(BRIGHT_FRAG, {
      tSrc: { value: this.dofRT.texture },
      uTexel: { value: new THREE.Vector2(1 / width, 1 / height) },
      uThreshold: { value: 1.5 },
    });
    this.blur = fsMaterial(BLUR_FRAG, { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } });
    this.copy = fsMaterial(COPY_FRAG, { tSrc: { value: null } });
    this.final = fsMaterial(FINAL_FRAG, {
      tColor: { value: this.dofRT.texture },
      tB1: { value: this.bloomA[0].texture },
      tB2: { value: this.bloomA[1].texture },
      tB3: { value: this.bloomA[2].texture },
      uBloom: { value: 1 },
      uExposure: { value: 1 },
      uGrain: { value: 0.02 },
      uFrame: { value: 0 },
    });
    this.speckMaterial = new THREE.ShaderMaterial({
      vertexShader: SPECK_VERT,
      fragmentShader: SPECK_FRAG,
      uniforms: {
        tDepth: { value: depthTexture },
        uRes: { value: new THREE.Vector2(width, height) },
        uNear: { value: 0.1 },
        uFar: { value: 100 },
        uPxScale: { value: height / 1080 },
        uFade: { value: 1 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });
  }

  private pass(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.fsScene, this.fsCam);
  }

  /** Call after the scene has been drawn into sceneRT. */
  finish(p: PostParams, specks: THREE.Scene | null, camera: THREE.Camera) {
    const H = this.height;
    const maxCoc = p.maxCoc * H;
    this.prep.uniforms.uNear.value = p.near;
    this.prep.uniforms.uFar.value = p.far;
    this.prep.uniforms.uFocus.value = p.focus;
    this.prep.uniforms.uAperture.value = p.aperture * H;
    this.prep.uniforms.uMaxCoc.value = maxCoc;
    this.pass(this.prep, this.prepRT);
    this.dof.uniforms.uMaxCoc.value = maxCoc;
    this.pass(this.dof, this.dofRT);

    if (specks) {
      this.speckMaterial.uniforms.uNear.value = p.near;
      this.speckMaterial.uniforms.uFar.value = p.far;
      this.renderer.setRenderTarget(this.dofRT);
      this.renderer.render(specks, camera);
    }
    // bloom
    this.bright.uniforms.uThreshold.value = p.threshold;
    this.pass(this.bright, this.bloomA[0]);
    for (let i = 0; i < 3; i++) {
      if (i > 0) {
        this.copy.uniforms.tSrc.value = this.bloomA[i - 1].texture;
        this.pass(this.copy, this.bloomA[i]);
      }
      const a = this.bloomA[i];
      const b = this.bloomB[i];
      this.blur.uniforms.tSrc.value = a.texture;
      this.blur.uniforms.uDir.value.set(1 / a.width, 0);
      this.pass(this.blur, b);
      this.blur.uniforms.tSrc.value = b.texture;
      this.blur.uniforms.uDir.value.set(0, 1 / a.height);
      this.pass(this.blur, a);
    }
    this.final.uniforms.uBloom.value = p.bloom;
    this.final.uniforms.uExposure.value = p.exposure;
    this.final.uniforms.uGrain.value = p.grain;
    this.final.uniforms.uFrame.value = p.frame;
    this.pass(this.final, null);
  }

  dispose() {
    this.sceneRT.dispose();
    this.prepRT.dispose();
    this.dofRT.dispose();
    this.bloomA.forEach((r) => r.dispose());
    this.bloomB.forEach((r) => r.dispose());
  }
}
