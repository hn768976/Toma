import { useFrame, useThree } from "@react-three/fiber";
import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

// Deterministic post pipeline (no TAA, no history buffers, no random kernels):
//   scene (HDR, 4x MSAA, depth) -> SSAO (fixed spiral) -> CoC prep
//   -> DoF gather (fixed golden-angle pattern) -> bloom mip chain
//   -> ACES tonemap, vignette, grain (pixel, frame%period), ±1/255 dither.
// All pixel radii are fractions of the frame height, so 720p and 4K match.

export type PostSettings = {
  focus: number; // world distance to the focal plane
  focusRange: number; // in-focus depth band (world units)
  nearRamp: number; // depth over which near blur reaches max
  farRamp: number; // depth over which far blur reaches max
  maxBlur: number; // max CoC radius, fraction of frame height
  aoStrength: number;
  aoRadius: number; // world units
  bloomStrength: number;
  bloomThreshold: number;
  bloomRadius: number; // 0..1, upsample spread
  exposure: number;
  vignette: number;
  grain: number; // amplitude, e.g. 0.015
  period: number; // grain loop period in frames
  contrast?: number;
  saturation?: number;
  lift?: [number, number, number]; // added after tonemap (linear-ish) to tint blacks
};

export type PreRenderHook = (gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) => void;
export const PostHooks = React.createContext<{ add: (h: PreRenderHook) => () => void }>({
  add: () => () => undefined,
});

const FS_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const COMMON = /* glsl */ `
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
float linearDepth(float d, float n, float f) {
  float z = d * 2.0 - 1.0;
  return (2.0 * n * f) / (f + n - z * (f - n));
}
`;

const AO_FRAG = /* glsl */ `
${COMMON}
uniform sampler2D tDepth;
uniform mat4 projInv;
uniform mat4 proj;
uniform vec2 res;
uniform float radius;
uniform float strength;
varying vec2 vUv;
vec3 viewPos(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  vec4 p = projInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  return p.xyz / p.w;
}
void main() {
  float d = texture2D(tDepth, vUv).x;
  if (d >= 1.0) { gl_FragColor = vec4(1.0); return; }
  vec3 P = viewPos(vUv);
  vec2 px = 1.0 / res;
  vec3 dx = viewPos(vUv + vec2(px.x, 0.0)) - P;
  vec3 dy = viewPos(vUv + vec2(0.0, px.y)) - P;
  vec3 N = normalize(cross(dx, dy));
  if (dot(N, P) > 0.0) N = -N;
  // projected radius in uv
  vec4 pr = proj * vec4(radius, radius, P.z, 1.0);
  float rUv = clamp(abs(pr.x / pr.w) * 0.5, 0.002, 0.12);
  float rot = ign(gl_FragCoord.xy) * 6.2831853;
  float occ = 0.0;
  const int N_S = 16;
  for (int i = 0; i < N_S; i++) {
    float fi = float(i);
    float r = sqrt((fi + 0.5) / float(N_S));
    float a = fi * 2.39996323 + rot;
    vec2 o = vec2(cos(a), sin(a)) * r * rUv;
    o.x *= res.y / res.x;
    vec3 S = viewPos(vUv + o);
    vec3 v = S - P;
    float vv = dot(v, v);
    float vn = dot(v, N);
    float fall = max(0.0, 1.0 - vv / (radius * radius));
    occ += max(0.0, vn - 0.01 * radius) / (vv + 0.02 * radius * radius) * fall * radius;
  }
  occ = clamp(occ / float(N_S) * 2.0, 0.0, 1.0);
  gl_FragColor = vec4(vec3(1.0 - strength * occ), 1.0);
}`;

const PREP_FRAG = /* glsl */ `
${COMMON}
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tAO;
uniform vec2 aoRes;
uniform float cNear, cFar, focus, focusRange, nearRamp, farRamp;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tColor, vUv);
  float dc = linearDepth(texture2D(tDepth, vUv).x, cNear, cFar);
  // depth-aware 4x4 blur of the AO
  float ao = 0.0, w = 0.0;
  for (int y = -2; y < 2; y++) for (int x = -2; x < 2; x++) {
    vec2 uv = vUv + (vec2(float(x), float(y)) + 0.5) / aoRes;
    float ds = linearDepth(texture2D(tDepth, uv).x, cNear, cFar);
    float ww = 1.0 / (1.0 + 40.0 * abs(ds - dc) / max(dc, 0.01));
    ao += texture2D(tAO, uv).x * ww; w += ww;
  }
  ao /= w;
  float dd = dc - focus;
  float half_ = focusRange * 0.5;
  float coc = dd > 0.0 ? clamp((dd - half_) / farRamp, 0.0, 1.0) : -clamp((-dd - half_) / nearRamp, 0.0, 1.0);
  gl_FragColor = vec4(c.rgb * ao, coc);
}`;

const DOF_FRAG = /* glsl */ `
${COMMON}
uniform sampler2D tPrep;
uniform vec2 res;
uniform float maxBlurPx;
varying vec2 vUv;
void main() {
  vec4 C = texture2D(tPrep, vUv);
  float cocC = C.a;
  float rC = abs(cocC) * maxBlurPx;
  if (maxBlurPx < 0.5) { gl_FragColor = vec4(C.rgb, 1.0); return; }
  float rot = ign(gl_FragCoord.xy) * 6.2831853;
  vec3 acc = C.rgb / max(rC * rC, 1.0);
  float wsum = 1.0 / max(rC * rC, 1.0);
  const int N_S = 64;
  for (int i = 0; i < N_S; i++) {
    float fi = float(i);
    float r = sqrt((fi + 0.5) / float(N_S));
    float a = fi * 2.39996323 + rot;
    vec2 o = vec2(cos(a), sin(a)) * r * maxBlurPx;
    vec4 S = texture2D(tPrep, vUv + o / res);
    float rs = abs(S.a) * maxBlurPx;
    // a farther sample may not blur over a nearer, sharper centre
    if (S.a > cocC && cocC >= 0.0) rs = min(rs, max(rC, 0.0));
    float dist = r * maxBlurPx;
    float cover = clamp(rs - dist + 1.0, 0.0, 1.0);
    float w = cover / max(rs * rs, 1.0);
    acc += S.rgb * w; wsum += w;
  }
  gl_FragColor = vec4(acc / wsum, 1.0);
}`;

const BRIGHT_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 texel;
uniform float threshold;
varying vec2 vUv;
void main() {
  vec3 c = vec3(0.0);
  c += texture2D(tSrc, vUv + texel * vec2(-1.0, -1.0)).rgb;
  c += texture2D(tSrc, vUv + texel * vec2(1.0, -1.0)).rgb;
  c += texture2D(tSrc, vUv + texel * vec2(-1.0, 1.0)).rgb;
  c += texture2D(tSrc, vUv + texel * vec2(1.0, 1.0)).rgb;
  c *= 0.25;
  float l = max(c.r, max(c.g, c.b));
  float knee = threshold * 0.5;
  float s = clamp(l - threshold + knee, 0.0, 2.0 * knee);
  s = s * s / (4.0 * knee + 1e-5);
  float m = max(s, l - threshold) / max(l, 1e-5);
  gl_FragColor = vec4(min(c * m, vec3(64.0)), 1.0);
}`;

const DOWN_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 texel;
varying vec2 vUv;
void main() {
  vec3 a = texture2D(tSrc, vUv + texel * vec2(-2.0, -2.0)).rgb;
  vec3 b = texture2D(tSrc, vUv + texel * vec2(0.0, -2.0)).rgb;
  vec3 c = texture2D(tSrc, vUv + texel * vec2(2.0, -2.0)).rgb;
  vec3 d = texture2D(tSrc, vUv + texel * vec2(-2.0, 0.0)).rgb;
  vec3 e = texture2D(tSrc, vUv).rgb;
  vec3 f = texture2D(tSrc, vUv + texel * vec2(2.0, 0.0)).rgb;
  vec3 g = texture2D(tSrc, vUv + texel * vec2(-2.0, 2.0)).rgb;
  vec3 h = texture2D(tSrc, vUv + texel * vec2(0.0, 2.0)).rgb;
  vec3 i = texture2D(tSrc, vUv + texel * vec2(2.0, 2.0)).rgb;
  vec3 j = texture2D(tSrc, vUv + texel * vec2(-1.0, -1.0)).rgb;
  vec3 k = texture2D(tSrc, vUv + texel * vec2(1.0, -1.0)).rgb;
  vec3 l = texture2D(tSrc, vUv + texel * vec2(-1.0, 1.0)).rgb;
  vec3 m = texture2D(tSrc, vUv + texel * vec2(1.0, 1.0)).rgb;
  vec3 o = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  gl_FragColor = vec4(o, 1.0);
}`;

const UP_FRAG = /* glsl */ `
uniform sampler2D tSrc;   // lower (smaller) level
uniform sampler2D tBase;  // current level
uniform vec2 texel;       // of tSrc
uniform float radius;
varying vec2 vUv;
void main() {
  vec3 s = vec3(0.0);
  s += texture2D(tSrc, vUv + texel * vec2(-1.0, -1.0)).rgb;
  s += texture2D(tSrc, vUv + texel * vec2(0.0, -1.0)).rgb * 2.0;
  s += texture2D(tSrc, vUv + texel * vec2(1.0, -1.0)).rgb;
  s += texture2D(tSrc, vUv + texel * vec2(-1.0, 0.0)).rgb * 2.0;
  s += texture2D(tSrc, vUv).rgb * 4.0;
  s += texture2D(tSrc, vUv + texel * vec2(1.0, 0.0)).rgb * 2.0;
  s += texture2D(tSrc, vUv + texel * vec2(-1.0, 1.0)).rgb;
  s += texture2D(tSrc, vUv + texel * vec2(0.0, 1.0)).rgb * 2.0;
  s += texture2D(tSrc, vUv + texel * vec2(1.0, 1.0)).rgb;
  s /= 16.0;
  gl_FragColor = vec4(texture2D(tBase, vUv).rgb + s * radius, 1.0);
}`;

const FINAL_FRAG = /* glsl */ `
${COMMON}
uniform sampler2D tDof;
uniform sampler2D tBloom;
uniform float bloomStrength, exposure, vignette, grain, frameMod, contrast, saturation;
uniform vec3 lift;
uniform vec2 res;
varying vec2 vUv;
vec3 aces(vec3 x) {
  const mat3 m1 = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
  const mat3 m2 = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
  vec3 v = m1 * x;
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return clamp(m2 * (a / b), 0.0, 1.0);
}
vec3 toSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  vec3 c = texture2D(tDof, vUv).rgb + texture2D(tBloom, vUv).rgb * bloomStrength;
  c *= exposure;
  vec2 q = vUv - 0.5;
  q.x *= res.x / res.y;
  c *= mix(1.0, smoothstep(1.25, 0.2, length(q)), vignette);
  c = aces(c);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, saturation);
  c = toSRGB(clamp(c, 0.0, 1.0));
  c = clamp((c - 0.5) * contrast + 0.5, 0.0, 1.0);
  c += lift * (1.0 - c);
  // grain: fixed formula of (pixel at 720p-equivalent scale, frame % period)
  vec2 gp = floor(gl_FragCoord.xy * (720.0 / res.y) * 1.0);
  float g = hash13(vec3(gp, frameMod + 1.0)) + hash13(vec3(gp.yx + 17.0, frameMod * 1.37 + 3.0)) - 1.0;
  c += g * grain * (0.35 + 0.65 * sqrt(max(l, 0.0)));
  // ±1/255 triangular dither, per output pixel
  float dth = hash13(vec3(gl_FragCoord.xy, frameMod + 91.0)) + hash13(vec3(gl_FragCoord.yx + 5.0, frameMod + 37.0)) - 1.0;
  c += dth / 255.0;
  gl_FragColor = vec4(c, 1.0);
}`;

function rt(w: number, h: number, opts: Partial<THREE.RenderTargetOptions> = {}) {
  return new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    generateMipmaps: false,
    colorSpace: THREE.LinearSRGBColorSpace,
    ...opts,
  });
}

function mat(frag: string, uniforms: Record<string, THREE.IUniform>) {
  return new THREE.ShaderMaterial({
    vertexShader: FS_VERT,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });
}

export const Post: React.FC<{ settings: PostSettings; frame: number; children?: React.ReactNode }> = ({
  settings,
  frame,
  children,
}) => {
  const { gl, scene, camera } = useThree();
  const hooks = useRef<PreRenderHook[]>([]);
  const hookApi = useMemo(
    () => ({
      add: (h: PreRenderHook) => {
        hooks.current.push(h);
        return () => {
          hooks.current = hooks.current.filter((x) => x !== h);
        };
      },
    }),
    [],
  );

  const size = gl.getDrawingBufferSize(new THREE.Vector2());
  const W = size.x;
  const H = size.y;

  const p = useMemo(() => {
    const depthTexture = new THREE.DepthTexture(W, H, THREE.UnsignedIntType);
    const sceneRT = rt(W, H, { depthBuffer: true, samples: 4, depthTexture });
    const aoW = Math.ceil(W / 2);
    const aoH = Math.ceil(H / 2);
    const aoRT = rt(aoW, aoH, { type: THREE.UnsignedByteType });
    const prepRT = rt(W, H);
    const dofRT = rt(W, H);
    // bloom chain: enough levels that the largest blur is a similar fraction of H at any size
    const levels = Math.max(4, Math.round(Math.log2(H / 720)) + 6);
    const down: THREE.WebGLRenderTarget[] = [];
    const up: THREE.WebGLRenderTarget[] = [];
    let w = Math.ceil(W / 2);
    let h = Math.ceil(H / 2);
    for (let i = 0; i < levels; i++) {
      down.push(rt(w, h));
      up.push(rt(w, h));
      w = Math.max(1, Math.ceil(w / 2));
      h = Math.max(1, Math.ceil(h / 2));
    }
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    quad.frustumCulled = false;
    const fsScene = new THREE.Scene();
    fsScene.add(quad);
    const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const m = {
      ao: mat(AO_FRAG, {
        tDepth: { value: depthTexture },
        projInv: { value: new THREE.Matrix4() },
        proj: { value: new THREE.Matrix4() },
        res: { value: new THREE.Vector2(aoW, aoH) },
        radius: { value: 0.2 },
        strength: { value: 0.5 },
      }),
      prep: mat(PREP_FRAG, {
        tColor: { value: sceneRT.texture },
        tDepth: { value: depthTexture },
        tAO: { value: aoRT.texture },
        aoRes: { value: new THREE.Vector2(aoW, aoH) },
        cNear: { value: 0.1 },
        cFar: { value: 100 },
        focus: { value: 5 },
        focusRange: { value: 1 },
        nearRamp: { value: 1 },
        farRamp: { value: 1 },
      }),
      dof: mat(DOF_FRAG, {
        tPrep: { value: prepRT.texture },
        res: { value: new THREE.Vector2(W, H) },
        maxBlurPx: { value: 4 },
      }),
      bright: mat(BRIGHT_FRAG, {
        tSrc: { value: dofRT.texture },
        texel: { value: new THREE.Vector2(1 / W, 1 / H) },
        threshold: { value: 1 },
      }),
      down: mat(DOWN_FRAG, { tSrc: { value: null }, texel: { value: new THREE.Vector2() } }),
      up: mat(UP_FRAG, {
        tSrc: { value: null },
        tBase: { value: null },
        texel: { value: new THREE.Vector2() },
        radius: { value: 1 },
      }),
      final: mat(FINAL_FRAG, {
        tDof: { value: dofRT.texture },
        tBloom: { value: up[0].texture },
        bloomStrength: { value: 0.5 },
        exposure: { value: 1 },
        vignette: { value: 0.3 },
        grain: { value: 0.015 },
        frameMod: { value: 0 },
        contrast: { value: 1 },
        saturation: { value: 1 },
        lift: { value: new THREE.Vector3() },
        res: { value: new THREE.Vector2(W, H) },
      }),
    };
    return { sceneRT, aoRT, prepRT, dofRT, down, up, quad, fsScene, fsCam, m, depthTexture };
  }, [W, H]);

  useEffect(() => {
    return () => {
      [p.sceneRT, p.aoRT, p.prepRT, p.dofRT, ...p.down, ...p.up].forEach((r) => r.dispose());
      Object.values(p.m).forEach((x) => x.dispose());
    };
  }, [p]);

  // Uniforms derived from the current frame are written during render, so they
  // are in place before @remotion/three advances the canvas for this frame.
  const s = settings;
  p.m.ao.uniforms.radius.value = s.aoRadius;
  p.m.ao.uniforms.strength.value = s.aoStrength;
  Object.assign(p.m.prep.uniforms.focus, { value: s.focus });
  p.m.prep.uniforms.focusRange.value = s.focusRange;
  p.m.prep.uniforms.nearRamp.value = s.nearRamp;
  p.m.prep.uniforms.farRamp.value = s.farRamp;
  p.m.dof.uniforms.maxBlurPx.value = s.maxBlur * H;
  p.m.bright.uniforms.threshold.value = s.bloomThreshold;
  p.m.up.uniforms.radius.value = s.bloomRadius;
  p.m.final.uniforms.bloomStrength.value = s.bloomStrength;
  p.m.final.uniforms.exposure.value = s.exposure;
  p.m.final.uniforms.vignette.value = s.vignette;
  p.m.final.uniforms.grain.value = s.grain;
  p.m.final.uniforms.frameMod.value = ((frame % s.period) + s.period) % s.period;
  p.m.final.uniforms.contrast.value = s.contrast ?? 1;
  p.m.final.uniforms.saturation.value = s.saturation ?? 1;
  const lift = s.lift ?? [0, 0, 0];
  (p.m.final.uniforms.lift.value as THREE.Vector3).set(lift[0], lift[1], lift[2]);

  const DBG = process.env.REMOTION_DEBUG ?? "";
  if (DBG.includes("nobloom")) p.m.final.uniforms.bloomStrength.value = 0;
  useFrame(() => {
    const cam = camera as THREE.PerspectiveCamera;
    if (DBG.includes("noscene")) scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.visible = false; });
    if (DBG.includes("noreflect")) scene.traverse((o) => { if ((o as unknown as { isReflector?: boolean }).isReflector) o.visible = false; });
    if (DBG.includes("nofloor")) scene.traverse((o) => { const g = (o as THREE.Mesh).geometry as THREE.PlaneGeometry; if (g?.parameters?.width === 30 && !(o as unknown as { isReflector?: boolean }).isReflector) o.visible = false; });
    cam.updateMatrixWorld();
    gl.autoClear = true;
    gl.toneMapping = THREE.NoToneMapping;
    // Bind the studio env to every standard/physical material explicitly.
    // (With scene.environment, three r180 ignores material.envMapIntensity.)
    const env = scene.userData.env as THREE.Texture | undefined;
    if (env) {
      scene.traverse((o) => {
        const mats = (o as THREE.Mesh).material;
        if (!mats) return;
        for (const m of Array.isArray(mats) ? mats : [mats]) {
          const sm = m as THREE.MeshStandardMaterial;
          if (sm.isMeshStandardMaterial) {
            if (sm.envMap !== env) {
              sm.envMap = env;
              sm.needsUpdate = true;
            }
            sm.envMapRotation.copy(scene.environmentRotation);
          }
        }
      });
    }
    for (const h of hooks.current) h(gl, scene, cam);

    gl.setRenderTarget(p.sceneRT);
    gl.clear(true, true, true);
    gl.render(scene, cam);

    const pass = (m: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) => {
      p.quad.material = m;
      gl.setRenderTarget(target);
      gl.render(p.fsScene, p.fsCam);
    };

    p.m.ao.uniforms.projInv.value.copy(cam.projectionMatrixInverse);
    p.m.ao.uniforms.proj.value.copy(cam.projectionMatrix);
    pass(p.m.ao, p.aoRT);

    p.m.prep.uniforms.cNear.value = cam.near;
    p.m.prep.uniforms.cFar.value = cam.far;
    pass(p.m.prep, p.prepRT);
    pass(p.m.dof, p.dofRT);

    pass(p.m.bright, p.down[0]);
    for (let i = 1; i < p.down.length; i++) {
      p.m.down.uniforms.tSrc.value = p.down[i - 1].texture;
      p.m.down.uniforms.texel.value.set(1 / p.down[i - 1].width, 1 / p.down[i - 1].height);
      pass(p.m.down, p.down[i]);
    }
    // upsample: up[last] = down[last]; up[i] = down[i] + blur(up[i+1])
    const last = p.down.length - 1;
    p.m.up.uniforms.tSrc.value = p.down[last].texture;
    p.m.up.uniforms.tBase.value = p.down[last - 1].texture;
    p.m.up.uniforms.texel.value.set(1 / p.down[last].width, 1 / p.down[last].height);
    pass(p.m.up, p.up[last - 1]);
    for (let i = last - 2; i >= 0; i--) {
      p.m.up.uniforms.tSrc.value = p.up[i + 1].texture;
      p.m.up.uniforms.tBase.value = p.down[i].texture;
      p.m.up.uniforms.texel.value.set(1 / p.up[i + 1].width, 1 / p.up[i + 1].height);
      pass(p.m.up, p.up[i]);
    }
    pass(p.m.final, null);
  }, 1);

  return <PostHooks.Provider value={hookApi}>{children}</PostHooks.Provider>;
};
