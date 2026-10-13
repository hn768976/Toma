/**
 * Deterministic post pipeline, rendered by hand from a priority-1 useFrame
 * callback (that only takes over rendering — the r3f clock is never read).
 *
 *   scene → HDR target (MSAA, depth texture)
 *         → [SSAO, half res, fixed kernel + fixed 4x4 rotation pattern]
 *         → [DoF, half res gather with MRT blend factor]
 *         → combine (full res)
 *         → bloom mip chain
 *         → final: tonemap, vignette, grain, dither, key composite → screen
 *
 * Everything that varies per frame (grain, dither) is a pure integer hash of
 * pixel position and (frame % loop). No TAA, no accumulation, no history.
 *
 * Chroma-key mode: the scene is rendered over transparent black and the key
 * colour is composited last, with every post term (bloom, grain, dither,
 * vignette) multiplied by the foreground coverage, so the background pixels
 * come out exactly equal to the key colour.
 */
import { useFrame, useThree } from "@react-three/fiber";
import React, { useEffect, useMemo, useRef } from "react";
import { useCurrentFrame } from "remotion";
import * as THREE from "three";

export type PostSettings = {
  exposure: number;
  toneMap: "aces" | "linear";
  /** Bloom on the combined HDR image. */
  bloom?: { strength: number; threshold: number; knee: number; radius: number };
  /** Depth of field. focus = view depth (world units); aperture scales CoC; maxBlur = fraction of frame height. */
  dof?: { focus: number; aperture: number; maxBlur: number; nearScale?: number };
  /** Screen-space AO, fixed pattern. radius in world units. */
  ssao?: { radius: number; intensity: number; power: number };
  /** Grain amplitude (fraction of full scale, e.g. 0.015). */
  grain: number;
  /** Grain fades to zero below this display luminance (e.g. 0.03 keeps pure black black). */
  grainFloor?: number;
  dither: boolean;
  /** Soft brightness gradient: full brightness at `origin` (uv, y up), falling to `low` at `radius` (in frame heights). */
  gradient?: { origin: [number, number]; radius: number; low: number };
  /** Vignette strength (0 = none). */
  vignette?: number;
  /** Chroma key colour (display sRGB, 0..1). Scene must render on a transparent clear. */
  key?: [number, number, number];
  /** Clear colour of the HDR target (linear). Ignored in key mode. */
  clear?: [number, number, number];
  /** Grain/dither pattern period in frames (600 for loops, 300 for stories). */
  noisePeriod: number;
};

const FULLSCREEN_VS = /* glsl */ `
precision highp float;
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const COMMON = /* glsl */ `
precision highp float;
precision highp int;
precision highp sampler2D;
float viewZFromDepth(float d, float near, float far) {
  // perspective depth [0,1] -> positive view distance
  float z = d * 2.0 - 1.0;
  return (2.0 * near * far) / (far + near - z * (far - near));
}
uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float hash3(uvec3 p) {
  return float(pcg(p.x + pcg(p.y + pcg(p.z)))) / 4294967295.0;
}
`;

const mat = (fs: string, uniforms: Record<string, THREE.IUniform>, defines: Record<string, string | number> = {}) =>
  new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: FULLSCREEN_VS,
    fragmentShader: COMMON + fs,
    uniforms,
    defines,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending,
  });

// ---------- SSAO ----------
const SSAO_FS = /* glsl */ `
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tDepth;
uniform vec2 resolution;      // of the AO target
uniform float near, far;
uniform mat4 projInv;
uniform mat4 proj;
uniform float radius, intensity, power;
vec3 viewPos(vec2 uv) {
  float d = texture(tDepth, uv).r;
  vec4 clip = vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  vec4 v = projInv * clip;
  return v.xyz / v.w;
}
void main() {
  float d = texture(tDepth, vUv).r;
  if (d >= 1.0) { outColor = vec4(1.0); return; }
  vec3 P = viewPos(vUv);
  vec2 px = 1.0 / resolution;
  // one-sided differences, picking the side with the smaller depth step
  // (robust at silhouettes and at the frame border)
  vec3 dx1 = viewPos(vUv + vec2(px.x, 0.0)) - P, dx2 = P - viewPos(vUv - vec2(px.x, 0.0));
  vec3 dy1 = viewPos(vUv + vec2(0.0, px.y)) - P, dy2 = P - viewPos(vUv - vec2(0.0, px.y));
  vec3 dx = abs(dx1.z) < abs(dx2.z) ? dx1 : dx2;
  vec3 dy = abs(dy1.z) < abs(dy2.z) ? dy1 : dy2;
  if (vUv.x + px.x > 1.0) dx = dx2;
  if (vUv.x - px.x < 0.0) dx = dx1;
  if (vUv.y + px.y > 1.0) dy = dy2;
  if (vUv.y - px.y < 0.0) dy = dy1;
  vec3 N = normalize(cross(dx, dy));
  // fixed 4x4 rotation pattern (no randomness)
  ivec2 ip = ivec2(gl_FragCoord.xy) & 3;
  int bayer[16] = int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5);
  float ang = float(bayer[ip.y * 4 + ip.x]) / 16.0 * 6.2831853;
  vec3 T = normalize(abs(N.z) < 0.9 ? cross(N, vec3(0,0,1)) : cross(N, vec3(1,0,0)));
  vec3 B = cross(N, T);
  float ca = cos(ang), sa = sin(ang);
  vec3 T2 = ca * T + sa * B;
  vec3 B2 = -sa * T + ca * B;
  float occ = 0.0;
  const int S = 16;
  for (int i = 0; i < S; i++) {
    float fi = float(i);
    // fixed hemisphere kernel (golden spiral), denser near the centre
    float r = (fi + 0.5) / float(S);
    float phi = fi * 2.3999632;
    // keep every sample at least ~20° above the tangent plane: near-in-plane
    // samples self-occlude a far, grazing plane in stripes
    vec3 k = normalize(vec3(cos(phi) * sqrt(r), sin(phi) * sqrt(r), max(sqrt(1.0 - r), 0.35))) * mix(0.15, 1.0, r * r);
    vec3 sp = P + (T2 * k.x + B2 * k.y + N * k.z) * radius;
    vec4 c = proj * vec4(sp, 1.0);
    vec2 suv = c.xy / c.w * 0.5 + 0.5;
    if (suv.x < 0.0 || suv.y < 0.0 || suv.x > 1.0 || suv.y > 1.0) continue;
    vec3 Q = viewPos(suv);
    float rangeOk = smoothstep(0.0, 1.0, radius / max(abs(P.z - Q.z), 1e-4));
    // depth-relative bias: no self-occlusion stripes on far, grazing planes
    float bias = 0.05 * radius + 0.004 * abs(P.z);
    occ += (Q.z >= sp.z + bias ? 1.0 : 0.0) * rangeOk;
  }
  float ao = 1.0 - occ / float(S) * intensity;
  outColor = vec4(vec3(pow(clamp(ao, 0.0, 1.0), power)), 1.0);
}`;

// ---------- DoF ----------
const COC_FS = /* glsl */ `
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 srcTexel;
uniform float near, far, focus, aperture, maxCoc, nearScale;
float coc(vec2 uv) {
  float d = texture(tDepth, uv).r;
  float z = viewZFromDepth(d, near, far);
  float c = aperture * (z - focus) / z;   // signed: <0 near, >0 far
  c = c < 0.0 ? c * nearScale : c;
  return clamp(c, -1.0, 1.0) * maxCoc;
}
void main() {
  // 2x2 downsample of colour; signed CoC of the NEAREST footprint sample, so
  // silhouette texels never inherit the blur of what lies behind them
  vec2 o = srcTexel * 0.5;
  vec4 c = texture(tColor, vUv + vec2(-o.x, -o.y)) + texture(tColor, vUv + vec2(o.x, -o.y))
         + texture(tColor, vUv + vec2(-o.x, o.y)) + texture(tColor, vUv + vec2(o.x, o.y));
  float k0 = coc(vUv + vec2(-o.x, -o.y)), k1 = coc(vUv + vec2(o.x, -o.y));
  float k2 = coc(vUv + vec2(-o.x, o.y)), k3 = coc(vUv + vec2(o.x, o.y));
  float k = min(min(k0, k1), min(k2, k3));
  outColor = vec4(c.rgb * 0.25, k);
  coverage = vec4(c.a * 0.25);
}`;

const GATHER_FS = /* glsl */ `
in vec2 vUv;
layout(location = 0) out vec4 outColor;
layout(location = 1) out vec4 outBlend;
uniform sampler2D tCoc;   // rgb colour, a = coc (half-res pixels)
uniform sampler2D tCov;   // coverage
uniform vec2 texel;
uniform float maxCoc;
void main() {
  vec4 c0 = texture(tCoc, vUv);
  float center = c0.a;                 // signed CoC (half-res px), <0 = near
  vec4 acc = vec4(c0.rgb, texture(tCov, vUv).r);
  float wsum = 1.0;
  float spread = abs(center);
  const int N = SAMPLES;
  for (int i = 1; i < N; i++) {
    float fi = float(i);
    float r = sqrt(fi / float(N)) * maxCoc;
    float a = fi * 2.3999632;
    vec2 uv = vUv + vec2(cos(a), sin(a)) * r * texel;
    vec4 s = texture(tCoc, uv);
    // samples behind this pixel may not spread further than this pixel's own blur
    float eff = s.a > center ? min(abs(s.a), abs(center)) : abs(s.a);
    float w = smoothstep(r - 1.0, r + 0.5, eff);
    acc += vec4(s.rgb, texture(tCov, uv).r) * w;
    wsum += w;
    spread = max(spread, eff * w);
  }
  outColor = acc / wsum;
  outBlend = vec4(clamp((spread - 0.5) / 1.5, 0.0, 1.0));
}`;

// ---------- combine ----------
const COMBINE_FS = /* glsl */ `
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tColor;
uniform sampler2D tAO;
uniform sampler2D tDof;
uniform sampler2D tBlend;
uniform vec2 aoTexel;
uniform float useAO, useDof;
void main() {
  vec4 c = texture(tColor, vUv);
  if (useAO > 0.5) {
    float ao = 0.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      ao += texture(tAO, vUv + vec2(x, y) * aoTexel).r;
    }
    ao /= 9.0;
    c.rgb *= ao;
  }
  if (useDof > 0.5) {
    float b = texture(tBlend, vUv).r;
    vec4 d = texture(tDof, vUv);
    c = mix(c, d, b);
  }
  outColor = c;
}`;

// ---------- bloom ----------
const PREFILTER_FS = /* glsl */ `
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tSrc;
uniform vec2 srcTexel;
uniform float threshold, knee;
vec3 pf(vec3 c) {
  float br = max(c.r, max(c.g, c.b));
  float rq = clamp(br - threshold + knee, 0.0, 2.0 * knee);
  rq = (rq * rq) / (4.0 * knee + 1e-5);
  float w = max(rq, br - threshold) / max(br, 1e-5);
  return c * w;
}
void main() {
  vec2 o = srcTexel;
  vec3 c = pf(texture(tSrc, vUv + vec2(-o.x, -o.y)).rgb) + pf(texture(tSrc, vUv + vec2(o.x, -o.y)).rgb)
         + pf(texture(tSrc, vUv + vec2(-o.x, o.y)).rgb) + pf(texture(tSrc, vUv + vec2(o.x, o.y)).rgb);
  outColor = vec4(min(c * 0.25, vec3(64.0)), 1.0);
}`;

const DOWN_FS = /* glsl */ `
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tSrc;
uniform vec2 srcTexel;
void main() {
  vec2 o = srcTexel;
  vec3 a = texture(tSrc, vUv).rgb * 4.0;
  a += texture(tSrc, vUv + vec2(-o.x, -o.y)).rgb + texture(tSrc, vUv + vec2(o.x, -o.y)).rgb
     + texture(tSrc, vUv + vec2(-o.x, o.y)).rgb + texture(tSrc, vUv + vec2(o.x, o.y)).rgb;
  outColor = vec4(a / 8.0, 1.0);
}`;

const UP_FS = /* glsl */ `
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tLow;
uniform sampler2D tHigh;
uniform vec2 lowTexel;
uniform float radius;
void main() {
  vec2 o = lowTexel;
  vec3 s = texture(tLow, vUv).rgb * 4.0;
  s += (texture(tLow, vUv + vec2(-o.x, 0.0)).rgb + texture(tLow, vUv + vec2(o.x, 0.0)).rgb
      + texture(tLow, vUv + vec2(0.0, -o.y)).rgb + texture(tLow, vUv + vec2(0.0, o.y)).rgb) * 2.0;
  s += texture(tLow, vUv + vec2(-o.x, -o.y)).rgb + texture(tLow, vUv + vec2(o.x, -o.y)).rgb
     + texture(tLow, vUv + vec2(-o.x, o.y)).rgb + texture(tLow, vUv + vec2(o.x, o.y)).rgb;
  outColor = vec4(texture(tHigh, vUv).rgb + s / 16.0 * radius, 1.0);
}`;

// ---------- final ----------
const FINAL_FS = /* glsl */ `
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tColor;
uniform sampler2D tBloom;
uniform float useBloom, bloomStrength;
uniform float exposure, toneMap;
uniform float grain, grainFloor, dither, vignette;
uniform float useKey;
uniform vec3 keyColor;
uniform vec4 gradient; // origin.xy, radius, low (radius 0 = off)
uniform int noiseFrame;
uniform vec2 resolution;
vec3 RRTAndODTFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 aces(vec3 color) {
  const mat3 ACESInputMat = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 ACESOutputMat = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  color *= exposure / 0.6;
  color = ACESInputMat * color;
  color = RRTAndODTFit(color);
  color = ACESOutputMat * color;
  return clamp(color, 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  vec4 src = texture(tColor, vUv);
  vec3 c = src.rgb;
  float cov = 1.0;
  if (useKey > 0.5) {
    // Un-premultiply and cut the coverage at 50%: every pixel is either the
    // card's own colour or the exact key colour. A plain chroma keyer (no
    // despill) then leaves no green fringe on any edge, sharp or defocused.
    float a = clamp(src.a, 0.0, 1.0);
    c = a > 1e-4 ? c / a : vec3(0.0);
    cov = step(0.5, a);
  }
  if (useBloom > 0.5) c += texture(tBloom, vUv).rgb * bloomStrength * cov;
  if (gradient.z > 0.0) {
    vec2 q = (vUv - gradient.xy) * vec2(resolution.x / resolution.y, 1.0);
    float g = smoothstep(0.0, gradient.z, length(q));
    c *= mix(1.0, gradient.w, g);
  }
  vec3 mapped = toneMap > 0.5 ? aces(c) : clamp(c * exposure, 0.0, 1.0);
  vec3 disp = toSRGB(mapped);
  if (vignette > 0.0) {
    vec2 q = vUv - 0.5;
    q.x *= resolution.x / resolution.y;
    float v = 1.0 - vignette * smoothstep(0.35, 1.15, length(q));
    disp *= mix(1.0, v, cov);
  }
  uvec2 ip = uvec2(gl_FragCoord.xy);
  uint f = uint(noiseFrame);
  if (grain > 0.0) {
    // pixel-position x frame hash, two taps summed -> soft triangular grain
    float g = hash3(uvec3(ip, f)) + hash3(uvec3(ip.yx + 7919u, f + 1013u)) - 1.0;
    float l = dot(disp, vec3(0.2126, 0.7152, 0.0722));
    float fade = grainFloor > 0.0 ? smoothstep(grainFloor, grainFloor * 2.0, l) : 1.0;
    disp += g * grain * fade * cov;
  }
  if (dither > 0.5) {
    float dd = hash3(uvec3(ip, f + 50077u)) - hash3(uvec3(ip + 3571u, f + 9973u));
    disp += dd / 255.0 * cov;
  }
  if (useKey > 0.5) {
    // foreground over the exact key colour, composited in display space
    disp = mix(keyColor, disp, cov);
    if (cov <= 0.0) disp = keyColor;
  }
  outColor = vec4(clamp(disp, 0.0, 1.0), 1.0);
}`;

type Targets = ReturnType<typeof makeTargets>;

const makeTargets = (w: number, h: number, s: PostSettings) => {
  const hf = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false } as const;
  const depthTexture = new THREE.DepthTexture(w, h, THREE.FloatType);
  const scene = new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    samples: 4,
    depthBuffer: true,
    depthTexture,
  });
  const hw = Math.max(1, Math.round(w / 2));
  const hh = Math.max(1, Math.round(h / 2));
  const lin = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
  const ao = s.ssao ? new THREE.WebGLRenderTarget(hw, hh, { ...hf, ...lin }) : null;
  const coc = s.dof ? new THREE.WebGLRenderTarget(hw, hh, { ...hf, ...lin, count: 2 }) : null;
  const gather = s.dof ? new THREE.WebGLRenderTarget(hw, hh, { ...hf, ...lin, count: 2 }) : null;
  const combined = new THREE.WebGLRenderTarget(w, h, { ...hf, ...lin });
  const bloomDown: THREE.WebGLRenderTarget[] = [];
  const bloomUp: THREE.WebGLRenderTarget[] = [];
  if (s.bloom) {
    let bw = hw;
    let bh = hh;
    for (let i = 0; i < 7 && bw >= 4 && bh >= 4; i++) {
      bloomDown.push(new THREE.WebGLRenderTarget(bw, bh, { ...hf, ...lin }));
      bloomUp.push(new THREE.WebGLRenderTarget(bw, bh, { ...hf, ...lin }));
      bw = Math.max(1, Math.round(bw / 2));
      bh = Math.max(1, Math.round(bh / 2));
    }
  }
  return { w, h, hw, hh, scene, ao, coc, gather, combined, bloomDown, bloomUp };
};

const disposeTargets = (t: Targets) => {
  [t.scene, t.ao, t.coc, t.gather, t.combined, ...t.bloomDown, ...t.bloomUp].forEach((x) => x?.dispose());
  t.scene.depthTexture?.dispose();
};

export const PostRenderer: React.FC<{ settings: PostSettings }> = ({ settings }) => {
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const { gl } = useThree();
  const size = useThree((st) => st.size);
  const viewport = useThree((st) => st.viewport);
  const w = Math.max(1, Math.round(size.width * viewport.dpr));
  const h = Math.max(1, Math.round(size.height * viewport.dpr));

  const fs = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const mesh = new THREE.Mesh(geo);
    mesh.frustumCulled = false;
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    return { geo, mesh, cam };
  }, []);

  const mats = useMemo(() => {
    return {
      ssao: mat(SSAO_FS, {
        tDepth: { value: null },
        resolution: { value: new THREE.Vector2() },
        near: { value: 0.1 },
        far: { value: 100 },
        projInv: { value: new THREE.Matrix4() },
        proj: { value: new THREE.Matrix4() },
        radius: { value: 1 },
        intensity: { value: 1 },
        power: { value: 1 },
      }),
      coc: mat(
        COC_FS.replace("out vec4 outColor;", "layout(location = 0) out vec4 outColor;\nlayout(location = 1) out vec4 coverage;"),
        {
          tColor: { value: null },
          tDepth: { value: null },
          srcTexel: { value: new THREE.Vector2() },
          near: { value: 0.1 },
          far: { value: 100 },
          focus: { value: 10 },
          aperture: { value: 1 },
          maxCoc: { value: 10 },
          nearScale: { value: 1 },
        },
      ),
      combine: mat(COMBINE_FS, {
        tColor: { value: null },
        tAO: { value: null },
        tDof: { value: null },
        tBlend: { value: null },
        aoTexel: { value: new THREE.Vector2() },
        useAO: { value: 0 },
        useDof: { value: 0 },
      }),
      prefilter: mat(PREFILTER_FS, {
        tSrc: { value: null },
        srcTexel: { value: new THREE.Vector2() },
        threshold: { value: 1 },
        knee: { value: 0.5 },
      }),
      down: mat(DOWN_FS, { tSrc: { value: null }, srcTexel: { value: new THREE.Vector2() } }),
      up: mat(UP_FS, {
        tLow: { value: null },
        tHigh: { value: null },
        lowTexel: { value: new THREE.Vector2() },
        radius: { value: 1 },
      }),
      final: mat(FINAL_FS, {
        tColor: { value: null },
        tBloom: { value: null },
        useBloom: { value: 0 },
        bloomStrength: { value: 0 },
        exposure: { value: 1 },
        toneMap: { value: 1 },
        grain: { value: 0 },
        grainFloor: { value: 0 },
        dither: { value: 1 },
        vignette: { value: 0 },
        useKey: { value: 0 },
        keyColor: { value: new THREE.Vector3() },
        gradient: { value: new THREE.Vector4() },
        noiseFrame: { value: 0 },
        resolution: { value: new THREE.Vector2() },
      }),
    };
  }, []);

  // DoF gather density scales with the blur radius in pixels, so 4K keeps
  // the same smoothness as 720p (fixed spiral pattern, no noise).
  const maxCocPx = settings.dof ? settings.dof.maxBlur * (h / 2) : 0;
  const dofSamples = Math.round(Math.min(320, Math.max(40, maxCocPx * maxCocPx * 1.1)));
  const gatherMat = useMemo(
    () =>
      mat(
        GATHER_FS,
        { tCoc: { value: null }, tCov: { value: null }, texel: { value: new THREE.Vector2() }, maxCoc: { value: 10 } },
        { SAMPLES: dofSamples },
      ),
    [dofSamples],
  );
  useEffect(() => () => gatherMat.dispose(), [gatherMat]);

  const hasBloom = Boolean(settings.bloom);
  const hasDof = Boolean(settings.dof);
  const hasAo = Boolean(settings.ssao);
  const targets = useMemo(
    () => makeTargets(w, h, settingsRef.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [w, h, hasBloom, hasDof, hasAo],
  );
  useEffect(() => () => disposeTargets(targets), [targets]);
  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose());
      fs.geo.dispose();
    },
    [mats, fs],
  );

  useFrame(({ scene, camera }) => {
    const s = settingsRef.current;
    const t = targets;
    const pass = (m: THREE.Material, target: THREE.WebGLRenderTarget | null) => {
      fs.mesh.material = m;
      gl.setRenderTarget(target);
      gl.render(fs.mesh, fs.cam);
    };
    const cam = camera as THREE.PerspectiveCamera;
    gl.autoClear = false;

    // 1. scene
    gl.setRenderTarget(t.scene);
    if (s.key) gl.setClearColor(0x000000, 0);
    else {
      const c = s.clear ?? [0, 0, 0];
      gl.setClearColor(new THREE.Color(c[0], c[1], c[2]), 1);
    }
    gl.clear(true, true, true);
    gl.render(scene, cam);

    // 2. SSAO
    if (s.ssao && t.ao) {
      const u = mats.ssao.uniforms;
      u.tDepth.value = t.scene.depthTexture;
      u.resolution.value.set(t.hw, t.hh);
      u.near.value = cam.near;
      u.far.value = cam.far;
      u.proj.value.copy(cam.projectionMatrix);
      u.projInv.value.copy(cam.projectionMatrixInverse);
      u.radius.value = s.ssao.radius;
      u.intensity.value = s.ssao.intensity;
      u.power.value = s.ssao.power;
      pass(mats.ssao, t.ao);
    }

    // 3. DoF
    if (s.dof && t.coc && t.gather) {
      const maxCoc = s.dof.maxBlur * t.hh; // in half-res pixels
      const u = mats.coc.uniforms;
      u.tColor.value = t.scene.texture;
      u.tDepth.value = t.scene.depthTexture;
      u.srcTexel.value.set(1 / t.w, 1 / t.h);
      u.near.value = cam.near;
      u.far.value = cam.far;
      u.focus.value = s.dof.focus;
      u.aperture.value = s.dof.aperture;
      u.maxCoc.value = maxCoc;
      u.nearScale.value = s.dof.nearScale ?? 1;
      pass(mats.coc, t.coc);
      const g = gatherMat.uniforms;
      g.tCoc.value = t.coc.textures[0];
      g.tCov.value = t.coc.textures[1];
      g.texel.value.set(1 / t.hw, 1 / t.hh);
      g.maxCoc.value = maxCoc;
      pass(gatherMat, t.gather);
    }

    // 4. combine
    {
      const u = mats.combine.uniforms;
      u.tColor.value = t.scene.texture;
      u.tAO.value = t.ao?.texture ?? null;
      u.aoTexel.value.set(1 / t.hw, 1 / t.hh);
      u.useAO.value = s.ssao ? 1 : 0;
      u.tDof.value = t.gather?.textures[0] ?? null;
      u.tBlend.value = t.gather?.textures[1] ?? null;
      u.useDof.value = s.dof ? 1 : 0;
      pass(mats.combine, t.combined);
    }

    // 5. bloom
    if (s.bloom && t.bloomDown.length) {
      const p = mats.prefilter.uniforms;
      p.tSrc.value = t.combined.texture;
      p.srcTexel.value.set(1 / t.w, 1 / t.h);
      p.threshold.value = s.bloom.threshold;
      p.knee.value = s.bloom.knee;
      pass(mats.prefilter, t.bloomDown[0]);
      for (let i = 1; i < t.bloomDown.length; i++) {
        const d = mats.down.uniforms;
        const src = t.bloomDown[i - 1];
        d.tSrc.value = src.texture;
        d.srcTexel.value.set(1 / src.width, 1 / src.height);
        pass(mats.down, t.bloomDown[i]);
      }
      const n = t.bloomDown.length;
      // last up level = last down level (copy via up pass with zero radius trick)
      let low = t.bloomDown[n - 1];
      for (let i = n - 2; i >= 0; i--) {
        const uu = mats.up.uniforms;
        uu.tLow.value = low.texture;
        uu.tHigh.value = t.bloomDown[i].texture;
        uu.lowTexel.value.set(1 / low.width, 1 / low.height);
        uu.radius.value = s.bloom.radius;
        pass(mats.up, t.bloomUp[i]);
        low = t.bloomUp[i];
      }
    }

    // 6. final
    {
      const u = mats.final.uniforms;
      u.tColor.value = t.combined.texture;
      u.tBloom.value = s.bloom && t.bloomUp.length > 1 ? t.bloomUp[0].texture : null;
      u.useBloom.value = s.bloom && t.bloomUp.length > 1 ? 1 : 0;
      u.bloomStrength.value = s.bloom?.strength ?? 0;
      u.exposure.value = s.exposure;
      u.toneMap.value = s.toneMap === "aces" ? 1 : 0;
      u.grain.value = s.grain;
      u.grainFloor.value = s.grainFloor ?? 0;
      u.dither.value = s.dither ? 1 : 0;
      u.vignette.value = s.vignette ?? 0;
      u.useKey.value = s.key ? 1 : 0;
      if (s.key) u.keyColor.value.set(s.key[0], s.key[1], s.key[2]);
      if (s.gradient) u.gradient.value.set(s.gradient.origin[0], s.gradient.origin[1], s.gradient.radius, s.gradient.low);
      else u.gradient.value.set(0, 0, 0, 1);
      u.noiseFrame.value = ((frameRef.current % s.noisePeriod) + s.noisePeriod) % s.noisePeriod;
      u.resolution.value.set(t.w, t.h);
      gl.setRenderTarget(null);
      pass(mats.final, null);
    }
  }, 1);

  return null;
};
