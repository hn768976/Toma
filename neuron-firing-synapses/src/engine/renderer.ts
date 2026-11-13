import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { Pass, FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";

/**
 * Depth-of-field "capsule splat" renderer.
 *
 * Every piece of the scene (dendrite segments, hairs, soma lobes, myelin
 * sheaths, dust, synapse particles) is a 3D capsule. Each capsule is drawn as
 * one instanced screen-space quad; the fragment shader evaluates an analytic
 * capsule distance field, fake-lights it as a round tube and widens/fades it
 * by its circle of confusion. Instances are sorted back-to-front on the CPU
 * each frame and blended with premultiplied alpha, where a per-instance
 * "opacity" lets a capsule be anything between solid and purely additive.
 *
 * Everything is a pure function of the frame number, so renders are
 * deterministic and safe for Remotion's multi-tab rendering.
 */

export const FLOATS_PER_CAPSULE = 20;

// material ids (stored in misc.x)
export const MAT_LIT = 0; // plain lit tube
export const MAT_TISSUE = 1; // two-tone striped tissue (colour + colour2 uniform set)
export const MAT_GLOW = 2; // emissive tube that can "fire"
export const MAT_DUST = 3; // floating bokeh dust
export const MAT_MYELIN = 4; // myelin sheath, glows when the pulse passes
export const MAT_SYNAPSE = 5; // synapse particle, bursts with the firing phase

export type FrameState = {
  camPos: [number, number, number];
  camTarget: [number, number, number];
  camUp?: [number, number, number];
  fovDeg: number;
  focusDist: number; // world units from the camera
  aperture: number; // CoC scale (fraction of frame height per unit of relative defocus)
  time: number; // seconds
  pulse: number; // path-distance of the travelling pulse front
  pulseWidth: number;
  fire: number; // 0..1 overall firing intensity of the front
  burst: number; // 0..1 synapse particle burst amount
  exposure: number;
};

export type Look = {
  background: [number, number, number];
  fog: [number, number, number]; // faint centre haze colour
  tissueA: [number, number, number];
  tissueB: [number, number, number];
  fireColor: [number, number, number];
  pulseColor: [number, number, number];
  light: [number, number, number];
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  maxCoc: number; // fraction of frame height
  sway: number;
  vignette: number;
  grain: number;
  saturation: number;
};

const VERT = /* glsl */ `
precision highp float;
in vec2 position;
in vec4 iA;
in vec4 iB;
in vec4 iCol;
in vec4 iMisc;   // mat, seed, s0, s1
in vec4 iExtra;  // fireWeight, glow, unused, unused

uniform mat4 uView;
uniform mat4 uProj;
uniform vec2 uRes;
uniform float uFocus;
uniform float uAperture;
uniform float uMaxCoc;
uniform float uTime;
uniform float uSway;
uniform float uBurst;

flat out vec4 vAB;
flat out vec4 vRC;
flat out vec4 vCol;
flat out vec4 vMisc;
flat out vec4 vExtra;
flat out float vBoost;

vec3 swayOf(vec3 p, float amt) {
  return amt * vec3(
    sin(p.y * 0.61 + uTime * 0.83 + p.z * 0.37),
    sin(p.z * 0.53 + uTime * 0.71 + p.x * 0.41),
    sin(p.x * 0.47 + uTime * 0.77 + p.y * 0.43));
}

void main() {
  float mat = iMisc.x;
  float seed = iMisc.y;
  vec3 pa = iA.xyz;
  vec3 pb = iB.xyz;
  float ra = iA.w;
  float rb = iB.w;

  if (mat > 2.5 && mat < 3.5) {
    // dust: slow drift
    vec3 drift = vec3(sin(seed * 91.7), cos(seed * 37.1), sin(seed * 57.3)) * uTime * 0.05;
    drift += 0.06 * vec3(sin(uTime * 0.5 + seed * 40.0), cos(uTime * 0.4 + seed * 23.0), 0.0);
    pa += drift; pb += drift;
  } else {
    float sa = uSway * (0.25 + 0.12 * abs(iMisc.z));
    float sb = uSway * (0.25 + 0.12 * abs(iMisc.w));
    pa += swayOf(pa, sa);
    pb += swayOf(pb, sb);
  }
  if (mat > 4.5) {
    // synapse particle: pops in with the burst, per-particle threshold
    float th = fract(seed * 7.31) * 0.85;
    float g = smoothstep(th, th + 0.22, uBurst);
    float flick = 0.8 + 0.2 * sin(uTime * 23.0 + seed * 100.0);
    float s = g * (0.55 + 0.9 * uBurst) * flick;
    ra *= s; rb *= s;
  }

  vec4 va = uView * vec4(pa, 1.0);
  vec4 vb = uView * vec4(pb, 1.0);
  float za = -va.z;
  float zb = -vb.z;
  if (za < 0.15 || zb < 0.15 || max(ra, rb) <= 0.0) {
    gl_Position = vec4(3.0, 3.0, 3.0, 1.0);
    return;
  }
  vec4 ca = uProj * va;
  vec4 cb = uProj * vb;
  vec2 xa = (ca.xy / ca.w * 0.5 + 0.5) * uRes;
  vec2 xb = (cb.xy / cb.w * 0.5 + 0.5) * uRes;
  float k = uProj[1][1] * uRes.y * 0.5;
  float rpa = ra * k / za;
  float rpb = rb * k / zb;
  float cocA = min(uMaxCoc, uAperture * abs(za - uFocus) / za) * uRes.y;
  float cocB = min(uMaxCoc, uAperture * abs(zb - uFocus) / zb) * uRes.y;

  vec2 d = xb - xa;
  float len = length(d);
  vec2 dir = len > 1e-3 ? d / len : vec2(1.0, 0.0);
  vec2 perp = vec2(-dir.y, dir.x);
  float ext = max(rpa + max(cocA, 0.75), rpb + max(cocB, 0.75)) + 0.75;
  vec2 base = position.x < 0.0 ? xa : xb;
  vec2 px = base + dir * position.x * ext + perp * position.y * ext;

  // Blur LOD: once a thin fibre is strongly defocused, individual fibres can no longer be told
  // apart, so a (smoothly growing) share of them is dropped and the rest made proportionally
  // denser. This keeps the look and removes most of the overdraw of big soft splats.
  vBoost = 1.0;
  bool pointLike = (mat > 2.5 && mat < 3.5) || mat > 4.5;
  if (!pointLike) {
    float cocN = max(cocA, cocB) / (0.0055 * uRes.y);
    float keep = clamp(1.6 / max(cocN, 1e-3), 0.22, 1.0);
    keep = mix(keep, 1.0, smoothstep(0.002, 0.004, max(rpa, rpb) / uRes.y));
    if (keep < 0.999) {
      float u = fract(sin(dot(iA.xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      float wgt = 1.0 - smoothstep(keep - 0.06, keep + 0.06, u);
      if (wgt <= 0.0) {
        gl_Position = vec4(3.0, 3.0, 3.0, 1.0);
        return;
      }
      vBoost = wgt / keep;
    }
  }

  vAB = vec4(xa, xb);
  vRC = vec4(rpa, rpb, cocA, cocB);
  vCol = iCol;
  vMisc = iMisc;
  vExtra = iExtra;
  gl_Position = vec4(px / uRes * 2.0 - 1.0, 0.0, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
flat in vec4 vAB;
flat in vec4 vRC;
flat in vec4 vCol;
flat in vec4 vMisc;
flat in vec4 vExtra;
flat in float vBoost;

uniform float uTime;
uniform float uPulse;
uniform float uPulseWidth;
uniform float uFire;
uniform float uBurst;
uniform vec3 uTissueA;
uniform vec3 uTissueB;
uniform vec3 uFireColor;
uniform vec3 uPulseColor;
uniform vec3 uLight;

out vec4 outColor;

void main() {
  vec2 p = gl_FragCoord.xy;
  vec2 a = vAB.xy;
  vec2 b = vAB.zw;
  vec2 ab = b - a;
  float L2 = dot(ab, ab);
  float t = L2 > 1e-4 ? clamp(dot(p - a, ab) / L2, 0.0, 1.0) : 0.0;
  vec2 q = a + ab * t;
  vec2 dq = p - q;
  float d = length(dq);
  float r = mix(vRC.x, vRC.y, t);
  float c = mix(vRC.z, vRC.w, t);
  float w = max(c, 0.75);

  float mat = vMisc.x;
  float seed = vMisc.y;
  float s = mix(vMisc.z, vMisc.w, t);
  bool isPoint = (mat > 2.5 && mat < 3.5) || mat > 4.5;

  float cov;
  float amp;
  if (isPoint) {
    // bokeh disc with a fairly crisp rim
    float R = r + c;
    float e = max(1.0, 0.5 * R);
    cov = 1.0 - smoothstep(R - e, R + 0.75, d);
    amp = min(1.0, pow(r / max(R, 0.75), 1.45) * 1.25);
    amp *= min(1.0, r / 0.6 + 0.15);
  } else {
    cov = 1.0 - smoothstep(max(r - w, 0.0), r + w, d);
    amp = min(1.0, 1.15 * r / w);
  }
  float alpha = min(1.0, cov * amp * vBoost);
  if (alpha < 0.0015) discard;

  // fake tube normal
  float rr = max(r, 0.75);
  vec2 nxy = dq / rr;
  if (!isPoint && (mat < 3.5) && L2 > 1e-4) {
    // tubes use a pure cylinder normal so consecutive capsules join seamlessly
    vec2 pd = vec2(-ab.y, ab.x) / sqrt(L2);
    nxy = pd * dot(nxy, pd);
  }
  float nl = length(nxy);
  if (nl > 1.0) nxy /= nl;
  float nz = sqrt(max(0.0, 1.0 - dot(nxy, nxy)));
  vec3 n = vec3(nxy, nz);
  vec3 Ld = normalize(uLight);
  float diff = max(dot(n, Ld), 0.0);
  float wrap = dot(n, Ld) * 0.5 + 0.5;
  float sharp = clamp(1.0 - c / (rr * 1.5), 0.0, 1.0); // lighting detail fades as it defocuses
  float spec = 0.0;
  float rim = 0.0;
  if (sharp > 0.0) {
    spec = pow(max(dot(n, normalize(Ld + vec3(0.0, 0.0, 1.0))), 0.0), 28.0) * sharp;
    rim = pow(1.0 - nz, 2.5) * sharp;
  }
  diff = mix(0.45, diff, sharp);
  wrap = mix(0.6, wrap, sharp);

  vec3 base = vCol.rgb;
  vec3 col;
  float fireW = vExtra.x;
  float glow = vExtra.y;
  float pulse = fireW > 0.0 ? exp(-pow((s - uPulse) / uPulseWidth, 2.0)) : 0.0;

  if (mat < 0.5) {
    col = base * (0.22 + 0.95 * wrap * wrap + 0.25 * diff) + base * rim * 0.35 + spec * 0.35;
    col += base * glow;
  } else if (mat < 1.5) {
    // striped two-tone tissue, stripes run along the fibre
    // defocused tissue reads as soft patches of either tone rather than an averaged mix
    float m = smoothstep(0.35, 0.65, fract(seed * 7.7 + floor(s * 1.3) * 0.37));
    float edge = 0.0;
    if (sharp > 0.0 && vExtra.z < 1.0) {
      vec2 dirn = L2 > 1e-4 ? ab / sqrt(L2) : vec2(1.0, 0.0);
      float u = clamp(dot(dq, vec2(-dirn.y, dirn.x)) / rr, -1.0, 1.0);
      float ang = asin(u);
      float st = sin(ang * 2.6 + seed * 31.0 + 1.6 * sin(s * 1.7 + seed * 9.0) + s * 0.9);
      float st2 = sin(ang * 5.3 - seed * 17.0 + s * 2.3);
      m = mix(m, smoothstep(0.0, 0.5, st + 0.35 * st2), sharp);
      edge = 1.0 - smoothstep(0.0, 0.35, abs(st + 0.35 * st2 - 0.25));
    }
    vec3 tc = mix(uTissueA, uTissueB, m);
    tc = mix(tc, vec3(0.9, 0.88, 0.92), edge * 0.28 * sharp);
    tc = mix(tc, vec3(0.78, 0.6, 0.6), (1.0 - sharp) * 0.3);
    tc = mix(tc, base, vExtra.z);
    col = tc * (0.16 + 0.95 * wrap * wrap + 0.25 * diff) + tc * rim * 0.3 + spec * 0.3;
    col += uPulseColor * pulse * 0.45 * fireW;
  } else if (mat < 2.5) {
    // emissive glass-like tube
    col = base * (0.4 + 0.7 * wrap + 0.8 * rim) + base * spec * 1.0 + vec3(spec) * 0.12;
    col += mix(base, vec3(0.75, 0.85, 1.0), 0.5) * max(base.r, max(base.g, base.b)) * (0.55 * rim + 0.5 * spec);
    col += base * glow;
    float f = clamp(pulse * uFire * fireW, 0.0, 1.0);
    vec3 hot = uFireColor * (0.6 + 0.6 * nz) + vec3(1.0, 0.9, 0.7) * nz * nz * 0.22;
    col = mix(col, hot, f);
    col += uFireColor * vExtra.z * (0.5 + 0.7 * rim + 0.5 * spec); // permanently tinted parts
  } else if (mat < 3.5) {
    float tw = 0.75 + 0.25 * sin(uTime * 1.7 + seed * 50.0);
    col = base * tw;
  } else if (mat < 4.5) {
    // myelin: darker toward the rounded ends of each sheath
    float endk = smoothstep(0.0, 0.22, t) * smoothstep(1.0, 0.78, t);
    endk = mix(0.75, endk, sharp);
    col = base * (0.18 + 0.9 * wrap * wrap + 0.25 * diff) * (0.55 + 0.45 * endk) + spec * 0.3 + base * rim * 0.3;
    col += uPulseColor * pulse * (0.3 + 0.45 * nz) * fireW;
    col += uPulseColor * glow * (0.3 + 0.7 * nz);
  } else {
    float hotc = 1.0 - smoothstep(0.0, 1.0, d / max(r + c, 0.75));
    col = base * (0.75 + 0.6 * hotc);
  }

  float op = abs(vCol.a);
  outColor = vec4(col * alpha, alpha * op);
}
`;

const FINAL_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tDiffuse;
uniform vec2 uRes;
uniform float uExposure;
uniform float uVignette;
uniform float uGrain;
uniform float uSeed;
uniform float uSaturation;
in vec2 vUv;
out vec4 outColor;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec3 c = texture(tDiffuse, vUv).rgb * uExposure;
  // filmic-ish shoulder
  c = 1.0 - exp(-c * 1.25);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSaturation);
  vec2 q = vUv - 0.5;
  q.x *= uRes.x / uRes.y;
  float v = smoothstep(1.05, 0.25, length(q));
  c *= mix(1.0, v, uVignette);
  c = pow(max(c, 0.0), vec3(1.0 / 2.2));
  // grain is evaluated on a fixed 1080p grid so it looks the same at any render scale
  vec2 gp = floor(vUv * vec2(1920.0, 1080.0));
  float g = hash(gp + uSeed * 61.0) - 0.5;
  c += g * uGrain;
  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

const FS_VERT = /* glsl */ `
in vec3 position;
in vec2 uv;
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

class BackgroundPass extends Pass {
  fsq: FullScreenQuad;
  mat: THREE.RawShaderMaterial;
  constructor(look: Look) {
    super();
    this.mat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: FS_VERT,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform vec3 uBg; uniform vec3 uFog; uniform float uAspect;
        in vec2 vUv; out vec4 outColor;
        void main() {
          vec2 q = vUv - 0.5; q.x *= uAspect;
          float f = exp(-dot(q, q) * 3.5);
          outColor = vec4(uBg + uFog * f, 1.0);
        }`,
      uniforms: {
        uBg: { value: new THREE.Vector3(...look.background) },
        uFog: { value: new THREE.Vector3(...look.fog) },
        uAspect: { value: 16 / 9 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.fsq = new FullScreenQuad(this.mat);
    this.needsSwap = false;
  }
  render(renderer: THREE.WebGLRenderer, _w: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget) {
    renderer.setRenderTarget(readBuffer);
    this.fsq.render(renderer);
  }
}

/** Soft (defocused) layers are rendered at 1/LOWRES of the frame size - they have no fine detail. */
const LOWRES = 4;
/** Circle of confusion (fraction of frame height) from which a capsule goes to a soft layer. */
const SOFT_SPLIT = 0.0075;

class CapsulePass extends Pass {
  private rtFar: THREE.WebGLRenderTarget;
  private rtNear: THREE.WebGLRenderTarget;
  private blit: FullScreenQuad;
  private blitMat: THREE.RawShaderMaterial;
  private lw: number;
  private lh: number;
  constructor(
    private scene: THREE.Scene,
    private camera: THREE.Camera,
    private material: THREE.RawShaderMaterial,
    private meshes: THREE.Mesh[],
    private bufW: number,
    private bufH: number,
  ) {
    super();
    this.needsSwap = false;
    this.lw = Math.ceil(bufW / LOWRES);
    this.lh = Math.ceil(bufH / LOWRES);
    const mk = () =>
      new THREE.WebGLRenderTarget(this.lw, this.lh, {
        type: THREE.HalfFloatType,
        depthBuffer: false,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
      });
    this.rtFar = mk();
    this.rtNear = mk();
    this.blitMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: FS_VERT,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D tLayer; uniform vec2 uTexel;
        in vec2 vUv; out vec4 outColor;
        void main() {
          // small tent filter on top of the bilinear upsample keeps the soft layers smooth
          vec4 c = texture(tLayer, vUv) * 0.4;
          c += texture(tLayer, vUv + uTexel * vec2(0.6, 0.6)) * 0.15;
          c += texture(tLayer, vUv + uTexel * vec2(-0.6, 0.6)) * 0.15;
          c += texture(tLayer, vUv + uTexel * vec2(0.6, -0.6)) * 0.15;
          c += texture(tLayer, vUv + uTexel * vec2(-0.6, -0.6)) * 0.15;
          outColor = c;
        }`,
      uniforms: { tLayer: { value: null }, uTexel: { value: new THREE.Vector2(1 / this.lw, 1 / this.lh) } },
      depthTest: false,
      depthWrite: false,
      transparent: true,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    this.blit = new FullScreenQuad(this.blitMat);
  }
  private drawLayer(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget, layer: number, w: number, h: number) {
    const u = this.material.uniforms;
    this.meshes.forEach((m, i) => (m.visible = i === layer && (m.geometry as THREE.InstancedBufferGeometry).instanceCount > 0));
    u.uRes.value.set(w, h);
    renderer.setRenderTarget(target);
    if (layer > 0) {
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, false, false);
    }
    renderer.render(this.scene, this.camera);
  }
  private composite(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget, layer: THREE.WebGLRenderTarget) {
    this.blitMat.uniforms.tLayer.value = layer.texture;
    renderer.setRenderTarget(target);
    this.blit.render(renderer);
  }
  render(renderer: THREE.WebGLRenderer, _w: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget) {
    const old = renderer.autoClear;
    renderer.autoClear = false;
    this.drawLayer(renderer, this.rtFar, 1, this.lw, this.lh);
    this.drawLayer(renderer, this.rtNear, 2, this.lw, this.lh);
    // back to front: far soft layer, sharp layer, near soft layer
    this.composite(renderer, readBuffer, this.rtFar);
    this.drawLayer(renderer, readBuffer, 0, this.bufW, this.bufH);
    this.composite(renderer, readBuffer, this.rtNear);
    renderer.autoClear = old;
  }
  dispose() {
    this.rtFar.dispose();
    this.rtNear.dispose();
    this.blitMat.dispose();
  }
}

export class NeuronRenderer {
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer;
  material: THREE.RawShaderMaterial;
  finalPass: ShaderPass;
  bgPass: BackgroundPass;
  camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 500);
  private src: Float32Array;
  private count: number;
  private keys: Float32Array;
  /** 0 = sharp (full-res), 1 = soft behind the focal plane, 2 = soft in front of it */
  private layers: {
    list: Uint32Array;
    data: Float32Array;
    buffer: THREE.InstancedInterleavedBuffer;
    geo: THREE.InstancedBufferGeometry;
    mesh: THREE.Mesh;
  }[] = [];
  private bufW: number;
  private bufH: number;

  constructor(
    canvas: HTMLCanvasElement,
    capsules: Float32Array,
    private look: Look,
    width: number,
    height: number,
    pixelRatio: number,
  ) {
    this.src = capsules;
    this.count = capsules.length / FLOATS_PER_CAPSULE;
    this.keys = new Float32Array(this.count);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.bufW = Math.round(width * pixelRatio);
    this.bufH = Math.round(height * pixelRatio);
    this.camera.aspect = width / height;

    this.material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      uniforms: {
        uView: { value: new THREE.Matrix4() },
        uProj: { value: new THREE.Matrix4() },
        uRes: { value: new THREE.Vector2(this.bufW, this.bufH) },
        uFocus: { value: 10 },
        uAperture: { value: 0.05 },
        uMaxCoc: { value: look.maxCoc },
        uTime: { value: 0 },
        uSway: { value: look.sway },
        uBurst: { value: 0 },
        uPulse: { value: 0 },
        uPulseWidth: { value: 1 },
        uFire: { value: 0 },
        uTissueA: { value: new THREE.Vector3(...look.tissueA) },
        uTissueB: { value: new THREE.Vector3(...look.tissueB) },
        uFireColor: { value: new THREE.Vector3(...look.fireColor) },
        uPulseColor: { value: new THREE.Vector3(...look.pulseColor) },
        uLight: { value: new THREE.Vector3(...look.light) },
      },
    });
    const scene = new THREE.Scene();
    const corners = new THREE.BufferAttribute(new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), 2);
    for (let l = 0; l < 3; l++) {
      const data = new Float32Array(capsules.length);
      const geo = new THREE.InstancedBufferGeometry();
      geo.setAttribute("position", corners);
      geo.setIndex([0, 1, 2, 0, 2, 3]);
      const buffer = new THREE.InstancedInterleavedBuffer(data, FLOATS_PER_CAPSULE);
      buffer.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute("iA", new THREE.InterleavedBufferAttribute(buffer, 4, 0));
      geo.setAttribute("iB", new THREE.InterleavedBufferAttribute(buffer, 4, 4));
      geo.setAttribute("iCol", new THREE.InterleavedBufferAttribute(buffer, 4, 8));
      geo.setAttribute("iMisc", new THREE.InterleavedBufferAttribute(buffer, 4, 12));
      geo.setAttribute("iExtra", new THREE.InterleavedBufferAttribute(buffer, 4, 16));
      geo.instanceCount = 0;
      // the quad corners are 2D and positioned in the shader, so give three.js explicit bounds
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
      geo.boundingBox = new THREE.Box3(new THREE.Vector3(-1e9, -1e9, -1e9), new THREE.Vector3(1e9, 1e9, 1e9));
      const mesh = new THREE.Mesh(geo, this.material);
      mesh.frustumCulled = false;
      scene.add(mesh);
      this.layers.push({ list: new Uint32Array(this.count), data, buffer, geo, mesh });
    }

    const target = new THREE.WebGLRenderTarget(this.bufW, this.bufH, {
      type: THREE.HalfFloatType,
      depthBuffer: false,
    });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
    this.bgPass = new BackgroundPass(look);
    this.composer.addPass(this.bgPass);
    this.composer.addPass(new CapsulePass(scene, this.camera, this.material, this.layers.map((l) => l.mesh), this.bufW, this.bufH));
    if (look.bloomStrength > 0) {
      this.composer.addPass(
        new UnrealBloomPass(
          new THREE.Vector2(this.bufW, this.bufH),
          look.bloomStrength,
          look.bloomRadius,
          look.bloomThreshold,
        ),
      );
    }
    this.finalPass = new ShaderPass(
      new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: FS_VERT,
        fragmentShader: FINAL_FRAG,
        uniforms: {
          tDiffuse: { value: null },
          uRes: { value: new THREE.Vector2(this.bufW, this.bufH) },
          uExposure: { value: 1 },
          uVignette: { value: look.vignette },
          uGrain: { value: look.grain },
          uSeed: { value: 0 },
          uSaturation: { value: look.saturation },
        },
      }),
    );
    this.composer.addPass(this.finalPass);
  }

  render(state: FrameState, frame: number) {
    const cam = this.camera;
    cam.fov = state.fovDeg;
    cam.position.set(...state.camPos);
    cam.up.set(...(state.camUp ?? [0, 1, 0]));
    cam.lookAt(...state.camTarget);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);

    // CPU pre-pass: frustum-cull, assign each capsule to a layer (sharp / soft-far / soft-near)
    // and sort every layer back-to-front along the view direction.
    const fwd = new THREE.Vector3();
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    cam.matrixWorld.extractBasis(right, up, fwd);
    fwd.negate();
    const cx = cam.position.x, cy = cam.position.y, cz = cam.position.z;
    const tanY = Math.tan((state.fovDeg * Math.PI) / 360);
    const tanX = tanY * cam.aspect;
    const { src, keys, count } = this;
    const F = FLOATS_PER_CAPSULE;
    const maxCoc = this.look.maxCoc;
    const split = SOFT_SPLIT;
    const n = [0, 0, 0];
    for (let i = 0; i < count; i++) {
      const o = i * F;
      const ax = src[o] - cx, ay = src[o + 1] - cy, az = src[o + 2] - cz;
      const bx = src[o + 4] - cx, by = src[o + 5] - cy, bz = src[o + 6] - cz;
      const za = ax * fwd.x + ay * fwd.y + az * fwd.z;
      const zb = bx * fwd.x + by * fwd.y + bz * fwd.z;
      const zmax = Math.max(za, zb);
      if (zmax < 0.15) continue;
      const cocA = za > 0.15 ? Math.min(maxCoc, (state.aperture * Math.abs(za - state.focusDist)) / za) : maxCoc;
      const cocB = zb > 0.15 ? Math.min(maxCoc, (state.aperture * Math.abs(zb - state.focusDist)) / zb) : maxCoc;
      const coc = Math.max(cocA, cocB);
      // conservative frustum test (margin covers radius, blur, sway and dust drift)
      const margin = Math.max(src[o + 3], src[o + 7]) + coc * 2 * zmax * tanY + (src[o + 12] === 3 ? 1.2 : 0.2);
      const xa = ax * right.x + ay * right.y + az * right.z;
      const xb = bx * right.x + by * right.y + bz * right.z;
      const limX = zmax * tanX + margin;
      if ((xa > limX && xb > limX) || (xa < -limX && xb < -limX)) continue;
      const ya = ax * up.x + ay * up.y + az * up.z;
      const yb = bx * up.x + by * up.y + bz * up.z;
      const limY = zmax * tanY + margin;
      if ((ya > limY && yb > limY) || (ya < -limY && yb < -limY)) continue;
      const zc = (za + zb) * 0.5;
      keys[i] = zc;
      const layer = coc >= split ? (zc < state.focusDist ? 2 : 1) : 0;
      this.layers[layer].list[n[layer]++] = i;
    }
    for (let l = 0; l < 3; l++) {
      const L = this.layers[l];
      const list = L.list.subarray(0, n[l]);
      // index tie-break keeps the order fully deterministic
      list.sort((a, b) => keys[b] - keys[a] || a - b);
      for (let i = 0; i < n[l]; i++) {
        const o = list[i] * F;
        L.data.set(src.subarray(o, o + F), i * F);
      }
      L.geo.instanceCount = n[l];
      if (n[l] > 0) {
        L.buffer.clearUpdateRanges();
        L.buffer.addUpdateRange(0, n[l] * F);
        L.buffer.needsUpdate = true;
      }
    }

    const u = this.material.uniforms;
    u.uView.value.copy(cam.matrixWorldInverse);
    u.uProj.value.copy(cam.projectionMatrix);
    u.uFocus.value = state.focusDist;
    u.uAperture.value = state.aperture;
    u.uTime.value = state.time;
    u.uBurst.value = state.burst;
    u.uPulse.value = state.pulse;
    u.uPulseWidth.value = state.pulseWidth;
    u.uFire.value = state.fire;
    const fu = this.finalPass.uniforms;
    fu.uExposure.value = state.exposure;
    fu.uSeed.value = frame;
    this.composer.render();
    this.renderer.getContext().finish();
  }

  dispose() {
    this.composer.dispose();
    this.renderer.dispose();
  }
}
