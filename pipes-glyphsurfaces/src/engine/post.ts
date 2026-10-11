import * as THREE from "three";
import { HASH_GLSL } from "./glsl";

/**
 * Single-frame post pipeline shared by every look. No history buffers, no TAA:
 *   scene (HDR, alpha = view depth / depthScale, MSAA)
 *   -> DoF prefilter (downsample + signed CoC)
 *   -> DoF gather (fixed Vogel-disc pattern, scatter-as-gather weighting)
 *   -> composite (sharp full-res vs blurred, by gathered blur amount)
 *   -> bloom (fixed mip chain: box downsample, tent upsample)
 *   -> final (exposure, tone map, grade, vignette, sRGB, grain, dither)
 *
 * Every size-dependent value is expressed as a fraction of image height, so a
 * 720p preview and a 4K render have the same look.
 */
export type PostSettings = {
  depthScale: number; // scene alpha = viewZ / depthScale
  focusDist: number; // view-space distance to the focus plane along the view axis
  focusTilt?: [number, number]; // focus plane slope (view-space dz/dx, dz/dy)
  aperture: number; // CoC (fraction of image height) per unit of |z - zf| / z
  maxCoc: number; // CoC clamp, fraction of image height
  nearScale?: number; // extra multiplier for near-field CoC
  bloomThreshold: number;
  bloomKnee: number;
  bloomIntensity: number;
  exposure: number;
  lift: [number, number, number];
  gain: [number, number, number];
  gamma: [number, number, number];
  saturation: number;
  contrast: number;
  vignette: number;
  debug?: number;
  grain: number; // amplitude, display-referred (0.015 = 1.5 %)
};

const VERT = /* glsl */ `
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const makeRT = (w: number, h: number, samples = 0, depth = false) => {
  const rt = new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: depth,
    samples,
    generateMipmaps: false,
  });
  rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
  return rt;
};

const pass = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VERT,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });

// Downsample by an integer factor k with a box filter built from bilinear taps.
const DOWN_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv; out vec4 outColor;
uniform sampler2D tSrc; uniform vec2 uSrcTexel; uniform int uTaps;
uniform float uThreshold; uniform float uKnee; uniform int uMode;
void main() {
  vec4 acc = vec4(0.0);
  float o = float(uTaps - 1);
  for (int j = 0; j < 8; j++) { if (j >= uTaps) break;
    for (int i = 0; i < 8; i++) { if (i >= uTaps) break;
      vec2 off = (vec2(float(i), float(j)) * 2.0 - o) * uSrcTexel;
      vec4 s = texture(tSrc, vUv + off);
      if (uMode == 1) {
        // bloom prefilter: soft-knee threshold, and clamp fireflies
        float br = max(s.r, max(s.g, s.b));
        float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
        soft = soft * soft / (4.0 * uKnee + 1e-5);
        float c = max(soft, br - uThreshold) / max(br, 1e-5);
        s.rgb = min(s.rgb * c, vec3(40.0));
      }
      acc += s;
    }
  }
  outColor = acc / float(uTaps * uTaps);
}
`;

const PREFILTER_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv; out vec4 outColor;
uniform sampler2D tScene; uniform vec2 uSrcTexel; uniform int uTaps;
uniform float uDepthScale; uniform float uFocus; uniform vec2 uTilt; uniform vec2 uTanHalf;
uniform float uAperture; uniform float uMaxCoc; uniform float uNear; uniform float uDofH;
float coc(vec2 uv, float a) {
  float z = a * uDepthScale;
  vec2 ndc = uv * 2.0 - 1.0;
  vec2 pxy = ndc * uTanHalf * z;
  float zf = uFocus + dot(pxy, uTilt);
  float c = uAperture * (z - zf) / max(z, 1e-3);
  if (c < 0.0) c *= uNear;
  return clamp(c, -uMaxCoc, uMaxCoc) * uDofH;  // in DoF-buffer pixels
}
void main() {
  // Key each half-res texel to its nearest tap and average only the taps at a
  // similar CoC, so bright in-focus edges never inherit a background CoC.
  float o = float(uTaps - 1);
  vec4 taps[16]; float cs[16]; int n = 0; float zmin = 1e9; float cref = 0.0;
  for (int j = 0; j < 4; j++) { if (j >= uTaps) break;
    for (int i = 0; i < 4; i++) { if (i >= uTaps) break;
      vec2 uv = vUv + (vec2(float(i), float(j)) * 2.0 - o) * uSrcTexel;
      vec4 s = texture(tScene, uv);
      float c = coc(uv, s.a);
      taps[n] = s; cs[n] = c;
      if (s.a < zmin) { zmin = s.a; cref = c; }
      n++;
    }
  }
  vec3 acc = vec3(0.0); float wsum = 0.0;
  for (int k = 0; k < 16; k++) { if (k >= n) break;
    float w = 1.0 - smoothstep(0.5, 1.5, abs(cs[k] - cref));
    acc += taps[k].rgb * w; wsum += w;
  }
  outColor = vec4(min(acc / max(wsum, 1e-4), vec3(60.0)), cref);
}
`;

const N_DOF = 72;
const GATHER_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv; out vec4 outColor;
uniform sampler2D tHalf; uniform vec2 uTexel; uniform float uMaxR;
uniform vec2 uKernel[${N_DOF}];
void main() {
  vec4 c0 = texture(tHalf, vUv);
  float cc = abs(c0.a);
  vec3 sum = c0.rgb; float tot = 1.0;
  float blur = cc;
  for (int i = 0; i < ${N_DOF}; i++) {
    vec2 off = uKernel[i] * uMaxR;
    float r = length(off);
    vec4 s = texture(tHalf, vUv + off * uTexel);
    float sc = abs(s.a);
    bool behind = s.a > c0.a;
    if (behind) sc = min(sc, cc * 2.0);   // background never bleeds over sharper foreground
    float m = smoothstep(r - 1.0, r + 1.0, sc);
    sum += mix(sum / tot, s.rgb, m); tot += 1.0;
    if (!behind) blur = max(blur, m * sc);
  }
  outColor = vec4(sum / tot, blur);
}
`;

const COMPOSITE_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv; out vec4 outColor;
uniform sampler2D tScene; uniform sampler2D tDof; uniform vec2 uDofTexel; uniform int uDebug;
void main() {
  vec3 sharp = texture(tScene, vUv).rgb;
  vec4 b = 0.25 * (texture(tDof, vUv + vec2( 0.5,  0.5) * uDofTexel)
                 + texture(tDof, vUv + vec2(-0.5,  0.5) * uDofTexel)
                 + texture(tDof, vUv + vec2( 0.5, -0.5) * uDofTexel)
                 + texture(tDof, vUv + vec2(-0.5, -0.5) * uDofTexel));
  float f = smoothstep(0.35, 1.6, b.a);
  outColor = vec4(mix(sharp, b.rgb, f), 1.0);
  if (uDebug == 1) outColor = vec4(vec3(texture(tScene, vUv).a * 10.0), 1.0);
  if (uDebug == 2) outColor = vec4(vec3(b.a / 10.0), 1.0);
  if (uDebug == 3) outColor = vec4(sharp, 1.0);
}
`;

const UP_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv; out vec4 outColor;
uniform sampler2D tLow; uniform sampler2D tHigh; uniform vec2 uLowTexel; uniform float uWeight;
void main() {
  vec2 d = uLowTexel;
  vec3 s = texture(tLow, vUv).rgb * 4.0
    + (texture(tLow, vUv + vec2(d.x, 0.0)).rgb + texture(tLow, vUv - vec2(d.x, 0.0)).rgb
     + texture(tLow, vUv + vec2(0.0, d.y)).rgb + texture(tLow, vUv - vec2(0.0, d.y)).rgb) * 2.0
    + texture(tLow, vUv + d).rgb + texture(tLow, vUv - d).rgb
    + texture(tLow, vUv + vec2(d.x, -d.y)).rgb + texture(tLow, vUv + vec2(-d.x, d.y)).rgb;
  outColor = vec4(texture(tHigh, vUv).rgb + s / 16.0 * uWeight, 1.0);
}
`;

const FINAL_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv; out vec4 outColor;
uniform sampler2D tComp; uniform sampler2D tBloom; uniform float uBloom;
uniform float uExposure; uniform vec3 uLift; uniform vec3 uGain; uniform vec3 uGamma;
uniform float uSat; uniform float uContrast; uniform float uVignette; uniform float uGrain;
uniform uint uFrame; uniform vec2 uRes;
${HASH_GLSL}
vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
vec3 toSrgb(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  vec3 c = texture(tComp, vUv).rgb + texture(tBloom, vUv).rgb * uBloom;
  c *= uExposure;
  vec2 q = vUv - 0.5; q.x *= uRes.x / uRes.y;
  c *= mix(1.0, smoothstep(1.25, 0.25, length(q)), uVignette);
  c = aces(c);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = max(mix(vec3(l), c, uSat), 0.0);
  c = pow(c, uGamma) * uGain + uLift * (1.0 - c);
  c = toSrgb(clamp(c, 0.0, 1.0));
  c = (c - 0.5) * uContrast + 0.5;
  // grain + dither: fixed functions of pixel position and loop frame
  uvec2 p = uvec2(gl_FragCoord.xy);
  float g = hash3(p.x, p.y, uFrame) + hash3(p.x + 7919u, p.y, uFrame + 613u) - 1.0;
  float d = hash3(p.x, p.y + 3571u, uFrame + 1931u) - hash3(p.x + 151u, p.y + 89u, uFrame + 4447u);
  c += g * uGrain + d / 255.0;
  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

// Vogel (golden-angle) disc, unit radius, ordered by radius. Fixed for all frames.
const vogel = (n: number) => {
  const out: THREE.Vector2[] = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const r = Math.sqrt((i + 0.5) / n);
    out.push(new THREE.Vector2(Math.cos(i * ga) * r, Math.sin(i * ga) * r));
  }
  return out;
};

export class PostPipeline {
  renderer: THREE.WebGLRenderer;
  w = 0;
  h = 0;
  scene!: THREE.WebGLRenderTarget;
  half!: THREE.WebGLRenderTarget;
  dof!: THREE.WebGLRenderTarget;
  comp!: THREE.WebGLRenderTarget;
  bloom: THREE.WebGLRenderTarget[] = [];
  bloomUp: THREE.WebGLRenderTarget[] = [];
  dofK = 2;
  bloomK = 2;
  quad: THREE.Mesh;
  qScene = new THREE.Scene();
  qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  mPre = pass(PREFILTER_FRAG, {
    tScene: { value: null }, uSrcTexel: { value: new THREE.Vector2() }, uTaps: { value: 1 },
    uDepthScale: { value: 1 }, uFocus: { value: 1 }, uTilt: { value: new THREE.Vector2() },
    uTanHalf: { value: new THREE.Vector2() }, uAperture: { value: 0 }, uMaxCoc: { value: 0 },
    uNear: { value: 1 }, uDofH: { value: 1 },
  });
  mGather = pass(GATHER_FRAG, {
    tHalf: { value: null }, uTexel: { value: new THREE.Vector2() }, uMaxR: { value: 1 },
    uKernel: { value: vogel(N_DOF) },
  });
  mComp = pass(COMPOSITE_FRAG, {
    tScene: { value: null }, tDof: { value: null }, uDofTexel: { value: new THREE.Vector2() }, uDebug: { value: 0 },
  });
  mDown = pass(DOWN_FRAG, {
    tSrc: { value: null }, uSrcTexel: { value: new THREE.Vector2() }, uTaps: { value: 1 },
    uThreshold: { value: 1 }, uKnee: { value: 0.5 }, uMode: { value: 0 },
  });
  mUp = pass(UP_FRAG, {
    tLow: { value: null }, tHigh: { value: null }, uLowTexel: { value: new THREE.Vector2() },
    uWeight: { value: 1 },
  });
  mFinal = pass(FINAL_FRAG, {
    tComp: { value: null }, tBloom: { value: null }, uBloom: { value: 0 }, uExposure: { value: 1 },
    uLift: { value: new THREE.Vector3() }, uGain: { value: new THREE.Vector3(1, 1, 1) },
    uGamma: { value: new THREE.Vector3(1, 1, 1) }, uSat: { value: 1 }, uContrast: { value: 1 },
    uVignette: { value: 0 }, uGrain: { value: 0.015 }, uFrame: { value: 0 },
    uRes: { value: new THREE.Vector2() },
  });

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mFinal);
    this.quad.frustumCulled = false;
    this.qScene.add(this.quad);
  }

  private disposeTargets() {
    [this.scene, this.half, this.dof, this.comp, ...this.bloom, ...this.bloomUp].forEach((t) => t?.dispose());
    this.bloom = [];
    this.bloomUp = [];
  }

  setSize(w: number, h: number) {
    if (w === this.w && h === this.h) return;
    this.disposeTargets();
    this.w = w;
    this.h = h;
    this.scene = makeRT(w, h, 4, true);
    this.dofK = Math.min(8, Math.max(2, Math.ceil(h / 540)));
    const dw = Math.ceil(w / this.dofK), dh = Math.ceil(h / this.dofK);
    this.half = makeRT(dw, dh);
    this.dof = makeRT(dw, dh);
    this.comp = makeRT(w, h);
    this.bloomK = Math.max(2, Math.round(h / 360));
    let bw = Math.ceil(w / this.bloomK), bh = Math.ceil(h / this.bloomK);
    for (let i = 0; i < 6; i++) {
      this.bloom.push(makeRT(bw, bh));
      this.bloomUp.push(makeRT(bw, bh));
      bw = Math.max(1, Math.ceil(bw / 2));
      bh = Math.max(1, Math.ceil(bh / 2));
    }
  }

  private run(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.qScene, this.qCam);
  }

  render(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    s: PostSettings,
    loopFrame: number,
    clearColor: THREE.Color,
  ) {
    const r = this.renderer;
    const { w, h } = this;
    r.setClearColor(clearColor, 1.0); // alpha 1 = far depth
    r.setRenderTarget(this.scene);
    r.clear(true, true, true);
    r.render(scene, camera);

    // DoF prefilter
    const dw = this.half.width, dh = this.half.height;
    const tanY = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const u = this.mPre.uniforms;
    u.tScene.value = this.scene.texture;
    u.uSrcTexel.value.set(1 / w, 1 / h);
    u.uTaps.value = Math.ceil(this.dofK / 2);
    u.uDepthScale.value = s.depthScale;
    u.uFocus.value = s.focusDist;
    u.uTilt.value.set(...(s.focusTilt ?? [0, 0]));
    u.uTanHalf.value.set(tanY * camera.aspect, tanY);
    u.uAperture.value = s.aperture;
    u.uMaxCoc.value = s.maxCoc;
    u.uNear.value = s.nearScale ?? 1;
    u.uDofH.value = dh;
    this.run(this.mPre, this.half);

    const g = this.mGather.uniforms;
    g.tHalf.value = this.half.texture;
    g.uTexel.value.set(1 / dw, 1 / dh);
    g.uMaxR.value = s.maxCoc * dh;
    this.run(this.mGather, this.dof);

    const c = this.mComp.uniforms;
    c.tScene.value = this.scene.texture;
    c.tDof.value = this.dof.texture;
    c.uDofTexel.value.set(1 / dw, 1 / dh);
    c.uDebug.value = s.debug ?? 0;
    this.run(this.mComp, this.comp);

    // bloom chain
    const d = this.mDown.uniforms;
    let src: THREE.Texture = this.comp.texture;
    let sw = w, sh = h;
    for (let i = 0; i < this.bloom.length; i++) {
      d.tSrc.value = src;
      d.uSrcTexel.value.set(1 / sw, 1 / sh);
      d.uTaps.value = i === 0 ? Math.ceil(this.bloomK / 2) : 1;
      d.uMode.value = i === 0 ? 1 : 0;
      d.uThreshold.value = s.bloomThreshold;
      d.uKnee.value = s.bloomKnee;
      this.run(this.mDown, this.bloom[i]);
      src = this.bloom[i].texture;
      sw = this.bloom[i].width;
      sh = this.bloom[i].height;
    }
    const up = this.mUp.uniforms;
    let low = this.bloom[this.bloom.length - 1];
    for (let i = this.bloom.length - 2; i >= 0; i--) {
      up.tLow.value = low.texture;
      up.tHigh.value = this.bloom[i].texture;
      up.uLowTexel.value.set(1 / low.width, 1 / low.height);
      up.uWeight.value = 1;
      this.run(this.mUp, this.bloomUp[i]);
      low = this.bloomUp[i];
    }

    const f = this.mFinal.uniforms;
    f.tComp.value = this.comp.texture;
    f.tBloom.value = this.bloomUp[0].texture;
    f.uBloom.value = s.bloomIntensity / this.bloom.length;
    f.uExposure.value = s.exposure;
    f.uLift.value.set(...s.lift);
    f.uGain.value.set(...s.gain);
    f.uGamma.value.set(...s.gamma);
    f.uSat.value = s.saturation;
    f.uContrast.value = s.contrast;
    f.uVignette.value = s.vignette;
    f.uGrain.value = s.grain;
    f.uFrame.value = loopFrame;
    f.uRes.value.set(w, h);
    this.run(this.mFinal, null);
  }

  dispose() {
    this.disposeTargets();
    [this.mPre, this.mGather, this.mComp, this.mDown, this.mUp, this.mFinal].forEach((m) => m.dispose());
  }
}
