import { useFrame, useThree } from "@react-three/fiber";
import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

// Shared post-processing for every look.
//   scene -> half-float MSAA target (+ depth)
//   -> depth-of-field (half-res gather, CoC from depth)
//   -> bloom (6-level down/up chain)
//   -> final: exposure, filmic curve, vignette, sRGB encode,
//      grain (hash of pixel + frame index, faded out below ~3% luminance),
//      triangular +-1/255 dither.
// Every input is a prop computed from the Remotion frame; nothing reads a clock.

export type PostSettings = {
  /** Frame index already wrapped to the composition length (drives grain). */
  frame: number;
  exposure?: number;
  bloomStrength?: number;
  bloomThreshold?: number;
  bloomRadius?: number;
  /** World-space distance from the camera that is in focus. */
  focusDistance?: number;
  /** Depth range (world units) over which blur ramps to its maximum. */
  focusRange?: number;
  /** Half-width (world units) of the band that stays perfectly sharp. */
  focusBand?: number;
  /** Max blur radius as a fraction of frame height (0 disables DoF). */
  maxBlur?: number;
  /** Extra weight for the near (foreground) side of the blur. */
  nearBlurScale?: number;
  grain?: number;
  vignette?: number;
  /** Lift applied to blacks in linear space (0 = pure black). */
  blackLift?: [number, number, number];
  /** Saturation multiplier after tonemapping. */
  saturation?: number;
  /** Final colour multiplier in linear space. */
  tint?: [number, number, number];
  /** Background colour cleared behind the scene, linear. */
  clearColor?: [number, number, number];
  msaa?: number;
};

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const fsTriangle = () => {
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
  );
  return g;
};

class Pass {
  mesh: THREE.Mesh;
  scene = new THREE.Scene();
  cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  mat: THREE.ShaderMaterial;
  constructor(frag: string, uniforms: Record<string, THREE.IUniform>, geo: THREE.BufferGeometry) {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: frag,
      uniforms,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }
  render(gl: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget | null) {
    gl.setRenderTarget(target);
    gl.render(this.scene, this.cam);
  }
  dispose() {
    this.mat.dispose();
  }
}

const HASH = /* glsl */ `
uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float hash3(uvec3 p) {
  return float(pcg(p.x ^ pcg(p.y ^ pcg(p.z)))) / 4294967295.0;
}`;

const DOF_PREFILTER = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform float cameraNear, cameraFar, focusDistance, focusRange, focusBand, nearScale;
uniform vec2 texel; // full-res texel
varying vec2 vUv;
float linDepth(float d) {
  float z = d * 2.0 - 1.0;
  return 2.0 * cameraNear * cameraFar / (cameraFar + cameraNear - z * (cameraFar - cameraNear));
}
float coc(vec2 uv) {
  float z = linDepth(texture2D(tDepth, uv).r);
  float dz = z - focusDistance;
  float s = sign(dz) * clamp((abs(dz) - focusBand) / focusRange, 0.0, 1.0);
  return s < 0.0 ? s * nearScale : s;
}
void main() {
  // 4-tap box downsample of colour, CoC taken from the tap nearest the camera
  vec2 o = texel * 0.5;
  vec3 c = texture2D(tColor, vUv + vec2(-o.x, -o.y)).rgb + texture2D(tColor, vUv + vec2(o.x, -o.y)).rgb
         + texture2D(tColor, vUv + vec2(-o.x, o.y)).rgb + texture2D(tColor, vUv + vec2(o.x, o.y)).rgb;
  float c0 = coc(vUv + vec2(-o.x, -o.y)), c1 = coc(vUv + vec2(o.x, -o.y));
  float c2 = coc(vUv + vec2(-o.x, o.y)), c3 = coc(vUv + vec2(o.x, o.y));
  float cmin = min(min(c0, c1), min(c2, c3));
  float cmax = max(max(c0, c1), max(c2, c3));
  float cc = cmin < 0.0 ? cmin : cmax;
  gl_FragColor = vec4(c * 0.25, cc);
}`;

const DOF_GATHER = /* glsl */ `
uniform sampler2D tSrc; // rgb + signed coc (half res)
uniform vec2 texel;     // half-res texel
uniform float maxRadius; // pixels at half res
varying vec2 vUv;
#define TAPS 48
void main() {
  vec4 center = texture2D(tSrc, vUv);
  float cR = abs(center.a) * maxRadius;
  vec3 acc = center.rgb;
  float wsum = 1.0;
  const float GA = 2.39996323;
  for (int i = 1; i < TAPS; i++) {
    float fi = float(i);
    float r = sqrt(fi / float(TAPS)) * maxRadius;
    float a = fi * GA;
    vec2 off = vec2(cos(a), sin(a)) * r;
    vec4 s = texture2D(tSrc, vUv + off * texel);
    float sR = abs(s.a) * maxRadius;
    // a sample contributes if its own blur disc reaches this pixel
    float w = smoothstep(r - 1.5, r + 0.5, sR);
    // background samples may not bleed onto a sharper foreground pixel
    if (s.a > center.a + 0.02 && center.a >= 0.0) w *= smoothstep(r - 1.5, r + 0.5, cR);
    acc += s.rgb * w;
    wsum += w;
  }
  gl_FragColor = vec4(acc / wsum, center.a);
}`;

const DOF_COMBINE = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tBlur;
uniform float maxRadius;
varying vec2 vUv;
void main() {
  vec3 sharp = texture2D(tColor, vUv).rgb;
  vec4 b = texture2D(tBlur, vUv);
  float t = smoothstep(0.0, 1.0, abs(b.a) * maxRadius / 1.5);
  gl_FragColor = vec4(mix(sharp, b.rgb, t), 1.0);
}`;

const COPY = /* glsl */ `
uniform sampler2D tSrc;
varying vec2 vUv;
void main() { gl_FragColor = vec4(texture2D(tSrc, vUv).rgb, 1.0); }`;

// 13-tap downsample (Jimenez 2014) with optional soft threshold on the first level.
const BLOOM_DOWN = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 texel; // source texel
uniform float threshold;
uniform float useThreshold;
varying vec2 vUv;
vec3 s(vec2 o) { return texture2D(tSrc, vUv + o * texel).rgb; }
void main() {
  vec3 a = s(vec2(-2,-2)), b = s(vec2(0,-2)), c = s(vec2(2,-2));
  vec3 d = s(vec2(-1,-1)), e = s(vec2(1,-1));
  vec3 f = s(vec2(-2,0)), g = s(vec2(0,0)), h = s(vec2(2,0));
  vec3 i = s(vec2(-1,1)), j = s(vec2(1,1));
  vec3 k = s(vec2(-2,2)), l = s(vec2(0,2)), m = s(vec2(2,2));
  vec3 col = (d+e+i+j)*0.125 + (a+b+f+g)*0.03125 + (b+c+g+h)*0.03125 + (f+g+k+l)*0.03125 + (g+h+l+m)*0.03125;
  if (useThreshold > 0.5) {
    float br = max(col.r, max(col.g, col.b));
    float knee = threshold * 0.5;
    float soft = clamp(br - threshold + knee, 0.0, 2.0 * knee);
    soft = soft * soft / (4.0 * knee + 1e-5);
    float contrib = max(soft, br - threshold) / max(br, 1e-5);
    col *= contrib;
  }
  gl_FragColor = vec4(col, 1.0);
}`;

const BLOOM_UP = /* glsl */ `
uniform sampler2D tSrc;   // lower (smaller) level
uniform sampler2D tBase;  // current level downsample
uniform vec2 texel;       // texel of tSrc
uniform float radius;
varying vec2 vUv;
vec3 s(vec2 o) { return texture2D(tSrc, vUv + o * texel * radius).rgb; }
void main() {
  vec3 col = s(vec2(-1,-1)) + 2.0*s(vec2(0,-1)) + s(vec2(1,-1))
           + 2.0*s(vec2(-1,0)) + 4.0*s(vec2(0,0)) + 2.0*s(vec2(1,0))
           + s(vec2(-1,1)) + 2.0*s(vec2(0,1)) + s(vec2(1,1));
  gl_FragColor = vec4(col / 16.0 + texture2D(tBase, vUv).rgb, 1.0);
}`;

const FINAL = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tBloom;
uniform float bloomStrength, exposure, grainAmt, vignette, saturation;
uniform vec3 blackLift, tint;
uniform float frameIdx;
uniform vec2 resolution;
varying vec2 vUv;
${HASH}
vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  vec3 col = texture2D(tColor, vUv).rgb + texture2D(tBloom, vUv).rgb * bloomStrength;
  col = col * tint + blackLift;
  vec2 q = vUv - 0.5;
  q.x *= resolution.x / resolution.y;
  col *= mix(1.0, smoothstep(1.25, 0.25, length(q)), vignette);
  col = aces(col * exposure);
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = max(mix(vec3(l), col, saturation), 0.0);
  vec3 srgb = toSRGB(col);
  uvec3 p = uvec3(uint(gl_FragCoord.x), uint(gl_FragCoord.y), uint(frameIdx));
  float lum = dot(srgb, vec3(0.2126, 0.7152, 0.0722));
  // grain: fixed function of pixel and frame, faded to zero below ~3% luminance
  float g = (hash3(p) + hash3(p + uvec3(1013u, 7919u, 31u)) - 1.0) * grainAmt;
  srgb += g * smoothstep(0.012, 0.03, lum);
  // triangular dither of +-1/255
  float d = (hash3(p + uvec3(17u, 23u, 977u)) + hash3(p + uvec3(5u, 3001u, 4409u)) - 1.0) / 255.0;
  srgb += d;
  gl_FragColor = vec4(clamp(srgb, 0.0, 1.0), 1.0);
}`;

const LEVELS = 6;

const makeRT = (w: number, h: number, opts: Partial<THREE.RenderTargetOptions> = {}) =>
  new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    generateMipmaps: false,
    colorSpace: THREE.NoColorSpace,
    ...opts,
  });

export const PostStage: React.FC<PostSettings> = (props) => {
  const { gl, size } = useThree();
  const propsRef = useRef(props);
  propsRef.current = props;

  const dpr = gl.getPixelRatio();
  const W = Math.round(size.width * dpr);
  const H = Math.round(size.height * dpr);
  const msaa = props.msaa ?? 4;

  const res = useMemo(() => {
    const geo = fsTriangle();
    const depthTex = new THREE.DepthTexture(W, H);
    depthTex.type = THREE.FloatType;
    const sceneRT = makeRT(W, H, { depthBuffer: true, depthTexture: depthTex, samples: msaa });
    const hw = Math.ceil(W / 2);
    const hh = Math.ceil(H / 2);
    const dofPre = makeRT(hw, hh);
    const dofBlur = makeRT(hw, hh);
    const comb = makeRT(W, H);
    const down: THREE.WebGLRenderTarget[] = [];
    const up: THREE.WebGLRenderTarget[] = [];
    for (let i = 0; i < LEVELS; i++) {
      const w = Math.ceil(W / Math.pow(2, i + 1));
      const h = Math.ceil(H / Math.pow(2, i + 1));
      down.push(makeRT(w, h));
      up.push(makeRT(w, h));
    }
    const pre = new Pass(DOF_PREFILTER, {
      tColor: { value: null },
      tDepth: { value: null },
      cameraNear: { value: 0.1 },
      cameraFar: { value: 100 },
      focusDistance: { value: 10 },
      focusRange: { value: 10 },
      focusBand: { value: 0 },
      nearScale: { value: 1 },
      texel: { value: new THREE.Vector2(1 / W, 1 / H) },
    }, geo);
    const gather = new Pass(DOF_GATHER, {
      tSrc: { value: null },
      texel: { value: new THREE.Vector2(1 / hw, 1 / hh) },
      maxRadius: { value: 0 },
    }, geo);
    const combine = new Pass(DOF_COMBINE, {
      tColor: { value: null },
      tBlur: { value: null },
      maxRadius: { value: 0 },
    }, geo);
    const copy = new Pass(COPY, { tSrc: { value: null } }, geo);
    const bDown = new Pass(BLOOM_DOWN, {
      tSrc: { value: null },
      texel: { value: new THREE.Vector2() },
      threshold: { value: 1 },
      useThreshold: { value: 0 },
    }, geo);
    const bUp = new Pass(BLOOM_UP, {
      tSrc: { value: null },
      tBase: { value: null },
      texel: { value: new THREE.Vector2() },
      radius: { value: 1 },
    }, geo);
    const final = new Pass(FINAL, {
      tColor: { value: null },
      tBloom: { value: null },
      bloomStrength: { value: 0 },
      exposure: { value: 1 },
      grainAmt: { value: 0.015 },
      vignette: { value: 0 },
      saturation: { value: 1 },
      blackLift: { value: new THREE.Vector3() },
      tint: { value: new THREE.Vector3(1, 1, 1) },
      frameIdx: { value: 0 },
      resolution: { value: new THREE.Vector2(W, H) },
    }, geo);
    return { geo, depthTex, sceneRT, dofPre, dofBlur, comb, down, up, pre, gather, combine, copy, bDown, bUp, final };
  }, [W, H, msaa]);

  useEffect(() => {
    return () => {
      const r = res;
      [r.sceneRT, r.dofPre, r.dofBlur, r.comb, ...r.down, ...r.up].forEach((t) => t.dispose());
      [r.pre, r.gather, r.combine, r.copy, r.bDown, r.bUp, r.final].forEach((p) => p.dispose());
      r.depthTex.dispose();
      r.geo.dispose();
    };
  }, [res]);

  // Priority 1 takes over rendering from R3F. The callback ignores R3F's clock and
  // delta entirely; it only reads the props of the current Remotion frame.
  useFrame((state) => {
    const { scene, camera } = state;
    const p = propsRef.current;
    const r = res;
    const cc = p.clearColor ?? [0, 0, 0];
    gl.setClearColor(new THREE.Color(cc[0], cc[1], cc[2]), 1);
    gl.autoClear = true;
    gl.setRenderTarget(r.sceneRT);
    gl.clear(true, true, true);
    gl.render(scene, camera);

    const maxBlurPx = (p.maxBlur ?? 0) * (H / 2); // in half-res pixels
    let colorTex: THREE.Texture = r.sceneRT.texture;
    if (maxBlurPx > 0.5) {
      const cam = camera as THREE.PerspectiveCamera;
      const u = r.pre.mat.uniforms;
      u.tColor.value = r.sceneRT.texture;
      u.tDepth.value = r.depthTex;
      u.cameraNear.value = cam.near;
      u.cameraFar.value = cam.far;
      u.focusDistance.value = p.focusDistance ?? 10;
      u.focusRange.value = p.focusRange ?? 10;
      u.focusBand.value = p.focusBand ?? 0;
      u.nearScale.value = p.nearBlurScale ?? 1;
      r.pre.render(gl, r.dofPre);
      r.gather.mat.uniforms.tSrc.value = r.dofPre.texture;
      r.gather.mat.uniforms.maxRadius.value = maxBlurPx;
      r.gather.render(gl, r.dofBlur);
      r.combine.mat.uniforms.tColor.value = r.sceneRT.texture;
      r.combine.mat.uniforms.tBlur.value = r.dofBlur.texture;
      r.combine.mat.uniforms.maxRadius.value = maxBlurPx;
      r.combine.render(gl, r.comb);
      colorTex = r.comb.texture;
    } else {
      r.copy.mat.uniforms.tSrc.value = r.sceneRT.texture;
      r.copy.render(gl, r.comb);
      colorTex = r.comb.texture;
    }

    // bloom chain
    let src: THREE.Texture = colorTex;
    let sw = W;
    let sh = H;
    for (let i = 0; i < LEVELS; i++) {
      const u = r.bDown.mat.uniforms;
      u.tSrc.value = src;
      u.texel.value.set(1 / sw, 1 / sh);
      u.threshold.value = p.bloomThreshold ?? 0.8;
      u.useThreshold.value = i === 0 ? 1 : 0;
      r.bDown.render(gl, r.down[i]);
      src = r.down[i].texture;
      sw = r.down[i].width;
      sh = r.down[i].height;
    }
    let low: THREE.WebGLRenderTarget = r.down[LEVELS - 1];
    for (let i = LEVELS - 2; i >= 0; i--) {
      const u = r.bUp.mat.uniforms;
      u.tSrc.value = low.texture;
      u.tBase.value = r.down[i].texture;
      u.texel.value.set(1 / low.width, 1 / low.height);
      u.radius.value = p.bloomRadius ?? 1;
      r.bUp.render(gl, r.up[i]);
      low = r.up[i];
    }

    const f = r.final.mat.uniforms;
    f.tColor.value = colorTex;
    f.tBloom.value = low.texture;
    f.bloomStrength.value = p.bloomStrength ?? 0.6;
    f.exposure.value = p.exposure ?? 1;
    f.grainAmt.value = p.grain ?? 0.015;
    f.vignette.value = p.vignette ?? 0.3;
    f.saturation.value = p.saturation ?? 1;
    const bl = p.blackLift ?? [0, 0, 0];
    f.blackLift.value.set(bl[0], bl[1], bl[2]);
    const tn = p.tint ?? [1, 1, 1];
    f.tint.value.set(tn[0], tn[1], tn[2]);
    f.frameIdx.value = p.frame;
    r.final.render(gl, null);
  }, 1);

  return null;
};
