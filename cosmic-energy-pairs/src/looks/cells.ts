import * as THREE from "three";
import { CellColours } from "../colourways";
import { lin } from "../lib/color";
import { NOISE } from "../lib/glsl";
import { FullScreenQuad, PostPipeline, PostSettings, rawMat } from "../lib/pipeline";
import { gauss, mulberry32 } from "../lib/random";
import { FrameInfo, Look } from "../lib/Stage";

/**
 * LOOK 4 — Glowing Cell Division (12 s, 360 frames, on pure black).
 *
 * Four "leaf" spheres A1 A2 B1 B2 are always present. Their centres/radii are a
 * pure function of the frame: they coincide at first (one cell), A/B separate
 * (split 1), then A1/A2 and B1/B2 separate (split 2, out of sync). The SDF is a
 * hierarchical smooth union, smin(smin(A1,A2,kA), smin(B1,B2,kB), k1); each k
 * shrinks to 0 as its split completes, so the shape stretches into a peanut,
 * pinches, and breaks into round cells.
 *
 * Raymarched at HALF resolution into an offscreen HDR buffer (the expensive
 * part), upsampled into the main HDR target; sparkles are drawn at full res.
 */

export const CELL_FRAMES_TOTAL = 360;
export const CELL_POST: PostSettings = {
  bloomStrength: 1.25,
  bloomRadius: 0.65,
  bloomThreshold: 0.12,
  exposure: 1.0,
  grain: 0,
  pureBlack: true,
};

/** Offscreen raymarch buffer scale (1 = full res). */
export const CELL_MARCH_SCALE = 1;
const SPARKLES_PER_LEAF = 1600;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

const R0 = 1.05;
const DIR1 = v3(1, 0.22, 0.28).normalize();
const DIR2A = v3(0.25, 1, -0.35).normalize();
const DIR2B = v3(-0.35, 0.95, 0.4).normalize();

type SplitState = { off: number; k: number; rScale: number; s: number };
const split = (f: number, start: number, end: number, r: number): SplitState => {
  const s = clamp01((f - start) / (end - start));
  const e = smooth(0, 1, s);
  const rScale = 1 - 0.2 * smooth(0, 1, s);
  const rr = r * rScale;
  const off = 1.14 * rr * e;
  // Smooth-union radius: large (one blob → peanut), then gone (pinched apart).
  const k = 0.5 * r * (1 - smooth(0.3, 0.88, s));
  return { off, k, rScale, s };
};

export type CellState = {
  centres: THREE.Vector3[]; // A1 A2 B1 B2
  radii: number[];
  k: [number, number, number]; // kA, kB, k1
  nucleusWeight: number[];
  flashes: THREE.Vector4[]; // xyz, intensity
  spin: number[];
};

export const cellStateAt = (f: number): CellState => {
  // Whole group drifts and turns slowly.
  const root = v3(0.15 * Math.sin(f * 0.006), 0.08 * Math.sin(f * 0.009 + 1), 0);
  const s1 = split(f, 60, 150, R0);
  const r1 = R0 * s1.rScale;
  const drift1 = 0.32 * smooth(130, 300, f);
  const A = root.clone().addScaledVector(DIR1, s1.off + drift1);
  const B = root.clone().addScaledVector(DIR1, -(s1.off + drift1));
  const sA = split(f, 150, 232, r1);
  const sB = split(f, 168, 250, r1);
  const rA = r1 * sA.rScale;
  const rB = r1 * sB.rScale;
  const dA = 0.22 * smooth(220, 360, f);
  const dB = 0.22 * smooth(238, 360, f);
  // Final loose group: the four cells settle into a gentle diamond.
  const settle = smooth(240, 360, f);
  const A1 = A.clone().addScaledVector(DIR2A, sA.off + dA).add(v3(0.1, 0.05, 0.1).multiplyScalar(settle));
  const A2 = A.clone().addScaledVector(DIR2A, -(sA.off + dA)).add(v3(-0.15, 0.1, -0.1).multiplyScalar(settle));
  const B1 = B.clone().addScaledVector(DIR2B, sB.off + dB).add(v3(0.12, -0.08, 0.05).multiplyScalar(settle));
  const B2 = B.clone().addScaledVector(DIR2B, -(sB.off + dB)).add(v3(-0.05, -0.1, -0.1).multiplyScalar(settle));
  const glow = 1 + 0.9 * smooth(240, 330, f);
  const w = 0.25 * (1 + s1.s) * glow;
  const flashAt = (s: number) => (s > 0.55 && s < 1 ? Math.exp(-Math.pow((s - 0.8) / 0.09, 2)) * smooth(0.55, 0.62, s) * (1 - smooth(0.95, 1, s)) : 0);
  return {
    centres: [A1, A2, B1, B2],
    radii: [rA, rA, rB, rB],
    k: [sA.k, sB.k, s1.k],
    nucleusWeight: [w * (1 + sA.s), w * (1 + sA.s), w * (1 + sB.s), w * (1 + sB.s)],
    flashes: [
      new THREE.Vector4(...A.clone().lerp(B, 0.5).toArray(), flashAt(s1.s) * 1.6),
      new THREE.Vector4(...A.toArray(), flashAt(sA.s)),
      new THREE.Vector4(...B.toArray(), flashAt(sB.s)),
    ],
    // Coincident leaves must share one rotation (else the interiors average
    // into smears); they diverge only as their split progresses.
    spin: [0, 1, 2, 3].map(
      (i) => f * 0.012 + (i < 2 ? 1 : -1) * 0.9 * s1.s + (i % 2 ? 1 : -1) * 0.7 * (i < 2 ? sA.s : sB.s),
    ),
  };
};

const MARCH_FRAG = /* glsl */ `
precision highp float;
uniform mat4 uInvProj;
uniform mat4 uCamWorld;
uniform vec3 uCamPos;
uniform vec4 uLeaf[4];      // centre, radius
uniform float uSpin[4];
uniform float uNuc[4];
uniform vec3 uK;            // kA, kB, k1
uniform vec4 uFlash[3];
uniform vec3 uRim;
uniform vec3 uInner;
uniform vec3 uNucCol;
uniform float uTime;
in vec2 vUv;
out vec4 outColor;
${NOISE}

float smin(float a, float b, float k) {
  if (k <= 1e-4) return min(a, b);
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
float sdf(vec3 p) {
  float a1 = length(p - uLeaf[0].xyz) - uLeaf[0].w;
  float a2 = length(p - uLeaf[1].xyz) - uLeaf[1].w;
  float b1 = length(p - uLeaf[2].xyz) - uLeaf[2].w;
  float b2 = length(p - uLeaf[3].xyz) - uLeaf[3].w;
  return smin(smin(a1, a2, uK.x), smin(b1, b2, uK.y), uK.z);
}
vec3 sdfNormal(vec3 p) {
  const vec2 e = vec2(0.002, -0.002);
  return normalize(e.xyy * sdf(p + e.xyy) + e.yyx * sdf(p + e.yyx) + e.yxy * sdf(p + e.yxy) + e.xxx * sdf(p + e.xxx));
}
vec3 rotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }
vec3 rotX(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z); }

// Interior emission at p: swirling filaments + nucleus.
vec3 interior(vec3 p) {
  vec3 q = vec3(0.0);
  float wsum = 0.0;
  float nuc = 0.0;
  for (int i = 0; i < 4; i++) {
    vec3 d = (p - uLeaf[i].xyz) / uLeaf[i].w;
    float dd = dot(d, d);
    float w = exp(-dd * 3.0) + 1e-4;
    vec3 l = rotX(rotY(d, uSpin[i]), 0.35 * sin(uSpin[i] * 0.7));
    // Swirl: twist increases towards the centre.
    l = rotY(l, 1.4 * (1.0 - min(dd, 1.0)));
    q += l * w;
    wsum += w;
    nuc += uNuc[i] * (exp(-dd * 10.0) * 1.6 + exp(-dd * 3.0) * 0.12);
  }
  q /= wsum;
  float n1 = snoise(q * 2.3 + vec3(0.0, uTime * 0.25, 0.0));
  float n2 = snoise(q * 4.6 + vec3(5.2, 1.3, -uTime * 0.2));
  float fil = pow(1.0 - abs(n1), 16.0) * 2.2 + pow(1.0 - abs(n2), 22.0) * 1.4;
  return uInner * fil * 0.75 + uNucCol * nuc * 0.6;
}

bool hitBound(vec3 ro, vec3 rd) {
  for (int i = 0; i < 4; i++) {
    vec3 oc = ro - uLeaf[i].xyz;
    float r = uLeaf[i].w + max(uK.x, max(uK.y, uK.z)) * 0.5 + 0.05;
    float b = dot(oc, rd);
    float c = dot(oc, oc) - r * r;
    if (b * b - c > 0.0) return true;
  }
  return false;
}

void main() {
  vec4 ndc = vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec4 vp = uInvProj * ndc;
  vec3 rd = normalize((uCamWorld * vec4(vp.xyz / vp.w, 0.0)).xyz);
  vec3 ro = uCamPos;
  vec3 col = vec3(0.0);

  // Division flashes: glow around the pinch points (compact support).
  for (int i = 0; i < 3; i++) {
    if (uFlash[i].w < 0.002) continue;
    vec3 oc = uFlash[i].xyz - ro;
    float t = max(dot(oc, rd), 0.0);
    float d = length(oc - rd * t);
    col += uNucCol * uFlash[i].w * (exp(-d * d * 60.0) * 3.0 + exp(-d * d * 8.0) * 0.5) * (1.0 - smoothstep(0.6, 0.9, d));
  }

  if (hitBound(ro, rd)) {
    float t = 0.0;
    bool hit = false;
    for (int i = 0; i < 64; i++) {
      float d = sdf(ro + rd * t);
      if (d < 0.0015) { hit = true; break; }
      t += d;
      if (t > 40.0) break;
    }
    if (hit) {
      vec3 p = ro + rd * t;
      vec3 n = sdfNormal(p);
      float ndv = clamp(dot(n, -rd), 0.0, 1.0);
      float fres = pow(1.0 - ndv, 3.2);
      // Interior: fixed-count march through the volume.
      vec3 acc = vec3(0.0);
      const int STEPS = 18;
      float stepLen = 2.2 * uLeaf[0].w / float(STEPS);
      float tt = stepLen * 0.5;
      for (int i = 0; i < STEPS; i++) {
        vec3 q = p + rd * tt;
        float sd = sdf(q);
        if (sd > 0.0) break;
        float depthIn = clamp(-sd / 0.25, 0.0, 1.0);
        acc += interior(q) * depthIn * stepLen;
        tt += stepLen;
      }
      // Fake glass: bright Fresnel rim, faint body, a soft specular streak.
      vec3 L = normalize(vec3(-0.5, 0.75, 0.45));
      float spec = pow(max(dot(reflect(rd, n), L), 0.0), 36.0);
      float body = 0.012 + 0.03 * ndv;
      col += uRim * (fres * 3.0 + body) + vec3(1.0) * spec * 1.4 * (0.3 + fres) + acc * 2.0;
    }
  }
  outColor = vec4(col, 1.0);
}
`;

const SPARK_VERT = /* glsl */ `
precision highp float;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform vec4 uLeaf[4];
uniform float uSpin[4];
uniform float uPx;
uniform float uFrame;
uniform float uFocus;
in vec3 position;     // offset inside the unit ball
in vec4 aSpark;       // x: leaf index, y: size, z: brightness, w: twinkle phase
out float vI;
vec3 rotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }
void main() {
  int li = int(aSpark.x + 0.5);
  vec4 leaf = uLeaf[li];
  float r = length(position);
  // Inner sparkles orbit faster: a swirl.
  vec3 o = rotY(position, uSpin[li] * (1.8 - r));
  vec3 p = leaf.xyz + o * leaf.w * 0.88;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = -mv.z;
  float coc = abs(1.0 / depth - 1.0 / uFocus) * 260.0;
  float base = aSpark.y * uPx * (9.0 / depth);
  float size = sqrt(base * base + coc * coc * uPx * uPx);
  gl_PointSize = max(size, uPx);
  float tw = 0.6 + 0.4 * sin(uFrame * 0.21 + aSpark.w * 6.283);
  vI = aSpark.z * tw * pow(base / max(size, 1e-3), 1.6);
}
`;

const SPARK_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uSpark;
in float vI;
out vec4 outColor;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  if (r2 > 1.0) discard;
  outColor = vec4(uSpark * vI * exp(-r2 * 5.0), 1.0);
}
`;

const UPSAMPLE_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tSrc;
in vec2 vUv;
out vec4 outColor;
void main() { outColor = vec4(texture(tSrc, vUv).rgb, 1.0); }
`;

export class CellLook implements Look {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 100);
  quad = new FullScreenQuad();
  march: THREE.RawShaderMaterial;
  up: THREE.RawShaderMaterial;
  rt: THREE.WebGLRenderTarget;
  sparkMat: THREE.RawShaderMaterial;

  constructor(c: CellColours) {
    this.camera.position.set(0, 0.25, 9.2);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld();
    const leafArr = () => [0, 1, 2, 3].map(() => new THREE.Vector4());
    this.march = rawMat(MARCH_FRAG, {
      uInvProj: { value: new THREE.Matrix4() },
      uCamWorld: { value: new THREE.Matrix4() },
      uCamPos: { value: new THREE.Vector3() },
      uLeaf: { value: leafArr() },
      uSpin: { value: [0, 0, 0, 0] },
      uNuc: { value: [0, 0, 0, 0] },
      uK: { value: new THREE.Vector3() },
      uFlash: { value: [0, 1, 2].map(() => new THREE.Vector4()) },
      uRim: { value: lin(c.rim) },
      uInner: { value: lin(c.inner) },
      uNucCol: { value: lin(c.nucleus) },
      uTime: { value: 0 },
    });
    this.up = rawMat(UPSAMPLE_FRAG, { tSrc: { value: null } }, { blending: THREE.AdditiveBlending, transparent: true });
    this.rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });

    const rng = mulberry32(0xce11);
    const n = SPARKLES_PER_LEAF * 4;
    const pos = new Float32Array(n * 3);
    const data = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const dir = v3(gauss(rng), gauss(rng), gauss(rng)).normalize();
      const r = Math.pow(rng(), 0.6);
      pos.set(dir.multiplyScalar(r).toArray(), i * 3);
      const big = rng() < 0.04;
      data.set([i % 4, (big ? 3.0 : 1.6) * (0.6 + rng() * 0.8), (big ? 12.0 : 4.5) * (0.4 + rng()), rng()], i * 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSpark", new THREE.BufferAttribute(data, 4));
    this.sparkMat = rawMat(
      SPARK_FRAG,
      {
        uLeaf: this.march.uniforms.uLeaf,
        uSpin: this.march.uniforms.uSpin,
        uPx: { value: 1 },
        uFrame: { value: 0 },
        uFocus: { value: 9.2 },
        uSpark: { value: lin(c.sparkle) },
      },
      { blending: THREE.AdditiveBlending, transparent: true },
      SPARK_VERT,
    );
    const pts = new THREE.Points(g, this.sparkMat);
    pts.frustumCulled = false;
    this.scene.add(pts);
  }

  render(gl: THREE.WebGLRenderer, pipe: PostPipeline, f: FrameInfo) {
    this.camera.aspect = f.width / f.height;
    this.camera.updateProjectionMatrix();
    const st = cellStateAt(f.frame);
    const u = this.march.uniforms;
    u.uInvProj.value.copy(this.camera.projectionMatrixInverse);
    u.uCamWorld.value.copy(this.camera.matrixWorld);
    u.uCamPos.value.copy(this.camera.position);
    st.centres.forEach((cc, i) => u.uLeaf.value[i].set(cc.x, cc.y, cc.z, st.radii[i]));
    u.uSpin.value = st.spin;
    u.uNuc.value = st.nucleusWeight;
    u.uK.value.set(...st.k);
    st.flashes.forEach((fl, i) => u.uFlash.value[i].copy(fl));
    u.uTime.value = f.frame / 30;
    this.sparkMat.uniforms.uPx.value = f.px;
    this.sparkMat.uniforms.uFrame.value = f.frame;

    const w = Math.round(f.width * CELL_MARCH_SCALE);
    const h = Math.round(f.height * CELL_MARCH_SCALE);
    if (this.rt.width !== w || this.rt.height !== h) this.rt.setSize(w, h);
    gl.setRenderTarget(this.rt);
    gl.setClearColor(0x000000, 1);
    gl.clear(true, false, false);
    this.quad.render(gl, this.march);

    gl.setRenderTarget(pipe.hdr);
    this.up.uniforms.tSrc.value = this.rt.texture;
    this.quad.render(gl, this.up);
    gl.render(this.scene, this.camera);
  }

  dispose() {
    this.quad.dispose();
    this.march.dispose();
    this.up.dispose();
    this.rt.dispose();
    this.sparkMat.dispose();
  }
}
