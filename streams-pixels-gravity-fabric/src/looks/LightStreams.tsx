import * as THREE from "three";
import { LINE_PROFILE } from "../gl/glsl";
import { Post, fullscreenMaterial } from "../gl/post";
import type { LookFactory } from "../gl/Stage";
import { mulberry32, phaseOf } from "../rng";

export type LightStreamsPalette = {
  lineA: string; // deep line colour
  lineB: string; // bright line colour
  packets: [string, string, string]; // white, tint, accent
  background: string;
};

const LINES = 400;
const POINTS = 180; // samples along each line
const PACKETS = 3000;
const CAM_Z = 10;
const FOV = 30;
const HALF_H = CAM_Z * Math.tan(((FOV / 2) * Math.PI) / 180);
const HALF_W = (HALF_H * 16) / 9;

// The flow field. One family of S-curves (left-low -> right-high) that slowly
// morphs. Time enters only as the loop angle th = 2*pi*phase, with integer
// multiples, so the shape at phase 1 equals phase 0.
// L = (s, depthJitter, seed, waveK): s in [-1,1] is the lateral position in the bundle.
const FLOW = /* glsl */ `
const float TAU = 6.28318530718;
uniform float uTh;
uniform vec2 uHalf;     // half width / height of the view at z = 0
uniform float uCamZ;
float sig(float x) { return 1.0 / (1.0 + exp(-x)); }
// Upper ribbon: steep S rising to the upper right.
float upperY(float X) {
  return -0.4 + 1.38 * sig(3.0 * (X + 0.2)) + 0.06 * sin(1.3 * X + uTh) + 0.03 * sin(2.1 * X - 2.0 * uTh + 1.0);
}
float upperW(float X) { return (0.2 + 0.42 * sig(2.0 * X)) * (1.0 + 0.1 * sin(uTh + 1.7 * X + 0.5)); }
// Lower band: flatter, across the bottom third, running off the bottom edge.
float lowerY(float X) {
  return -0.8 + 0.42 * sig(2.0 * (X + 0.2)) + 0.04 * sin(1.1 * X - uTh + 2.0);
}
float lowerW(float X) { return (0.32 + 0.1 * sig(2.0 * X)) * (1.0 + 0.08 * sin(uTh - 1.3 * X)); }
// kept for the background glow
float flowCenter(float X) { return 0.5 * (upperY(X) + lowerY(X)); }
float flowSpread(float X) { return 0.5 * (upperY(X) - lowerY(X)) + 0.3; }
float lineDepth(vec4 L, float X) { return -1.0 * L.x - 1.0 * X + L.y; }
float lineY(float X, float s) {
  float yl = lowerY(X) + (s + 0.55) / 0.45 * lowerW(X);
  float yu = upperY(X) + (s - 0.6) / 0.4 * upperW(X);
  // one continuous sheet: the two families blend through the middle
  return mix(yl, yu, smoothstep(-0.6, 0.7, s));
}
vec3 streamPos(float u, vec4 L) {
  float X = mix(-1.35, 1.35, u);
  float Y = lineY(X, L.x)
          + 0.022 * sin(2.7 * X + TAU * L.z + L.w * uTh)
          + 0.012 * sin(5.3 * X + TAU * fract(L.z * 7.0) - L.w * uTh);
  float z = lineDepth(L, X);
  float k = (uCamZ - z) / uCamZ;   // keep screen placement, vary depth only
  return vec3(X * uHalf.x * k, Y * uHalf.y * k, z);
}
`;

const DOF = /* glsl */ `
uniform float uFocusZ;
uniform float uCocK;     // CoC per unit depth, as fraction of height
uniform vec2 uRes;
float cocPx(float z) { return uCocK * uRes.y * abs(z - uFocusZ); }
`;

const LINE_VERT = /* glsl */ `
${LINE_PROFILE}
${FLOW}
${DOF}
attribute float aU;
attribute float aSide;
attribute vec4 aL0;   // flow params
attribute vec4 aL1;   // widthFrac, intensity, colourMix, lead
attribute vec4 aL2;   // segment: enabled, centre, halfLen, speedK
uniform vec3 uColA, uColB;
varying float vD;      // signed distance from centre, px
varying float vCore;
varying float vSigma;
varying vec3 vCol;

vec2 toScreen(vec4 c) { return (c.xy / c.w * 0.5 + 0.5) * uRes; }

void main() {
  float du = 1.0 / ${POINTS - 1}.0;
  vec3 p = streamPos(aU, aL0);
  vec3 pa = streamPos(aU - du, aL0);
  vec3 pb = streamPos(aU + du, aL0);
  mat4 pv = projectionMatrix * viewMatrix;
  vec4 c = pv * vec4(p, 1.0);
  vec2 s = toScreen(c);
  vec2 dir = normalize(toScreen(pv * vec4(pb, 1.0)) - toScreen(pv * vec4(pa, 1.0)));
  vec2 n = vec2(-dir.y, dir.x);

  float core = aL1.x * uRes.y * uCamZ / (uCamZ - p.z);
  float blur = cocPx(p.z);
  float sigma = lineSigma(core, blur);
  float halfW = 3.2 * sigma + 1.0;
  vec2 sp = s + n * aSide * halfW;
  gl_Position = vec4((sp / uRes * 2.0 - 1.0) * c.w, c.z, c.w);

  vD = aSide * halfW;
  vCore = core;
  vSigma = sigma;

  // brightness: denser/brighter mid-bundle, far lines dimmer
  float X = mix(-1.35, 1.35, aU);
  float inten = aL1.y * mix(0.6, 1.0, smoothstep(-2.4, 0.4, p.z));
  inten *= aL0.x < 0.1 ? 0.85 * mix(1.0, 0.6, smoothstep(0.2, 1.2, X)) : 1.0;
  // some lines are only partial streaks that slide along
  if (aL2.x > 0.5) {
    float cx = aL2.y + 0.25 * sin(aL2.w * uTh + TAU * aL0.z);
    inten *= smoothstep(cx - aL2.z, cx - aL2.z + 0.35, X) * smoothstep(cx + aL2.z, cx + aL2.z - 0.35, X);
  }
  vec3 col = mix(uColA, uColB, aL1.z);
  col = mix(col, vec3(0.85, 0.97, 1.0) * uColB, aL1.w * 0.6);
  vCol = col * inten;
}
`;

const LINE_FRAG = /* glsl */ `
${LINE_PROFILE}
varying float vD;
varying float vCore;
varying float vSigma;
varying vec3 vCol;
void main() {
  float a = lineProfile(vD, vCore, vSigma);
  gl_FragColor = vec4(vCol * a, 1.0);
}
`;

const PACKET_VERT = /* glsl */ `
${FLOW}
${DOF}
attribute vec2 aCorner;   // quad corner in [-1,1]
attribute vec4 aL0;       // flow params of the host line
attribute vec4 aP1;       // u0, laps, type, sizeFrac
attribute vec4 aP2;       // rgb, intensity
uniform float uT;
varying vec2 vLocal;      // px, in the packet's own frame
varying float vSize;
varying float vBlur;
varying float vType;
varying vec3 vCol;
vec2 toScreen(vec4 c) { return (c.xy / c.w * 0.5 + 0.5) * uRes; }
void main() {
  float u = fract(aP1.x + aP1.y * uT);       // whole laps per loop, wraps off-screen
  vec3 p = streamPos(u, aL0);
  vec3 pb = streamPos(u + 0.002, aL0);
  mat4 pv = projectionMatrix * viewMatrix;
  vec4 c = pv * vec4(p, 1.0);
  vec2 s = toScreen(c);
  vec2 dir = normalize(toScreen(pv * vec4(pb, 1.0)) - s);
  float size = aP1.w * uRes.y;
  float blur = cocPx(p.z);
  float ext = size * (aP1.z > 0.5 && aP1.z < 1.5 ? 2.6 : 1.0) + blur + 2.0;
  vec2 ax = aP1.z > 0.5 && aP1.z < 1.5 ? dir : vec2(1.0, 0.0);
  vec2 ay = vec2(-ax.y, ax.x);
  vec2 local = aCorner * ext;
  vec2 sp = s + ax * local.x + ay * local.y;
  gl_Position = vec4((sp / uRes * 2.0 - 1.0) * c.w, c.z, c.w);
  vLocal = local;
  vSize = size;
  vBlur = blur;
  vType = aP1.z;
  float fade = smoothstep(0.0, 0.06, u) * smoothstep(1.0, 0.94, u);
  vCol = aP2.rgb * aP2.a * fade * mix(0.6, 1.0, smoothstep(-2.4, 0.4, p.z));
}
`;

const PACKET_FRAG = /* glsl */ `
varying vec2 vLocal;
varying float vSize;
varying float vBlur;
varying float vType;
varying vec3 vCol;
float sdBox(vec2 p, vec2 b) { vec2 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0); }
float sdTri(vec2 p, float r) {
  const float k = 1.7320508;
  p.x = abs(p.x) - r;
  p.y = p.y + r / k;
  if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
  p.x -= clamp(p.x, -2.0 * r, 0.0);
  return -length(p) * sign(p.y);
}
void main() {
  float r = vSize * 0.5;
  float d;
  if (vType < 0.5) d = length(vLocal) - r;
  else if (vType < 1.5) d = sdBox(vLocal, vec2(r * 2.6, r * 0.55));
  else d = sdTri(vLocal, r * 1.1);
  float e = 0.6 + 0.5 * vBlur + 0.18 * vSize;
  float a = 1.0 - smoothstep(-e, e, d);
  float area = (vSize * vSize) / ((vSize + vBlur) * (vSize + vBlur));
  gl_FragColor = vec4(vCol * a * area, 1.0);
}
`;

const BG_FRAG = /* glsl */ `
${FLOW}
uniform vec3 uBg, uGlow;
varying vec2 vUv;
void main() {
  float X = (vUv.x * 2.0 - 1.0);
  float Y = (vUv.y * 2.0 - 1.0);
  float c = flowCenter(X);
  float sp = flowSpread(X);
  float d = (Y - (c - 0.25 * sp)) / (sp * 0.95);
  float g = exp(-d * d * 1.3);
  float g2 = exp(-pow((Y - (c - 0.55 * sp)) / (sp * 0.6), 2.0));
  float g3 = exp(-pow((Y - (c - 0.6 * sp)) / (sp * 0.45), 2.0)) * smoothstep(-0.6, 1.0, X);
  vec3 col = uBg + uGlow * (0.025 * g + 0.05 * g2 * smoothstep(-1.4, 0.4, X) + 0.08 * g3);
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------- geometry (seeded, built once) ----------
type LineParams = { L0: number[]; L1: number[]; L2: number[] };

const buildLines = (): LineParams[] => {
  const rnd = mulberry32(1445997510);
  const gauss = () => {
    const u = Math.max(rnd(), 1e-6);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
  };
  const out: LineParams[] = [];
  const waveKs = [-2, -1, 1, 2];
  for (let i = 0; i < LINES; i++) {
    // an upper ribbon, a flatter lower band, a sparse gap, and a few faint
    // defocused streaks out in the dark area above the ribbon
    const pick = rnd();
    const faint = pick < 0.05;
    const s = faint
      ? 1.15 + rnd() * 0.6
      : pick < 0.13
        ? rnd() * 1.6 - 0.8
        : pick < 0.58
          ? Math.min(1.05, 0.6 + gauss() * 0.17)
          : Math.max(-1.1, Math.min(0.0, -0.55 + gauss() * 0.22));
    const kind = rnd();
    const lead = kind < 0.04 ? 1 : 0; // bright cyan-white lead lines
    const streak = !lead && kind < 0.12; // a few thick, soft light streaks
    const width = lead
      ? 0.0016 + rnd() * 0.0012
      : streak
        ? 0.003 + rnd() * 0.003
        : 0.00035 + Math.pow(rnd(), 3) * 0.0011;
    const inten = faint
      ? 0.05 + rnd() * 0.08
      : lead
        ? 1.8 + rnd() * 1.6
        : streak
          ? 0.12 + rnd() * 0.2
          : 0.03 + Math.pow(rnd(), 3.0) * 0.85;
    const colourMix = lead ? 0.75 : streak ? 0.15 + rnd() * 0.5 : Math.pow(rnd(), 3.6);
    const seg = rnd() < 0.3 ? 1 : 0;
    out.push({
      L0: [s, faint ? -1.5 : (rnd() - 0.5) * 0.5, rnd(), waveKs[Math.floor(rnd() * 4)]],
      L1: [width, inten, colourMix, lead],
      L2: [seg, -1 + rnd() * 2.4, 0.35 + rnd() * 0.6, rnd() < 0.5 ? 1 : -1],
    });
  }
  return out;
};

const LINE_DATA = buildLines();

const buildLineGeometry = () => {
  const n = LINES * POINTS * 2;
  const aU = new Float32Array(n);
  const aSide = new Float32Array(n);
  const aL0 = new Float32Array(n * 4);
  const aL1 = new Float32Array(n * 4);
  const aL2 = new Float32Array(n * 4);
  const idx: number[] = [];
  let v = 0;
  LINE_DATA.forEach((l) => {
    const base = v;
    for (let j = 0; j < POINTS; j++) {
      for (const side of [-1, 1]) {
        aU[v] = j / (POINTS - 1);
        aSide[v] = side;
        aL0.set(l.L0, v * 4);
        aL1.set(l.L1, v * 4);
        aL2.set(l.L2, v * 4);
        v++;
      }
      if (j < POINTS - 1) {
        const a = base + j * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute("aU", new THREE.BufferAttribute(aU, 1));
  g.setAttribute("aSide", new THREE.BufferAttribute(aSide, 1));
  g.setAttribute("aL0", new THREE.BufferAttribute(aL0, 4));
  g.setAttribute("aL1", new THREE.BufferAttribute(aL1, 4));
  g.setAttribute("aL2", new THREE.BufferAttribute(aL2, 4));
  g.setIndex(idx);
  return g;
};

const buildPacketGeometry = (pal: LightStreamsPalette) => {
  const rnd = mulberry32(31337);
  const cols = pal.packets.map((h) => new THREE.Color(h));
  const aL0: number[] = [];
  const aP1: number[] = [];
  const aP2: number[] = [];
  // dotted runs on the lower band and the upper strand; triangles float in the gap
  const pickHost = (pred: (sv: number) => boolean) => {
    for (;;) {
      const i = Math.floor(rnd() * LINE_DATA.length);
      if (pred(LINE_DATA[i].L0[0])) return LINE_DATA[i];
    }
  };
  let count = 0;
  while (count < PACKETS) {
    const tr = rnd();
    const type = tr < 0.9 ? 0 : tr < 0.98 ? 1 : 2;
    const host =
      type === 2
        ? pickHost((sv) => sv > -0.5 && sv < 1.0)
        : pickHost((sv) => sv < 1.1 && (rnd() < 0.55 ? sv < -0.2 : sv > 0.35));
    const group = type === 2 ? (rnd() < 0.7 ? 1 : 3 + Math.floor(rnd() * 2)) : type === 1 ? 2 + Math.floor(rnd() * 3) : 4 + Math.floor(rnd() * 5);
    const laps = 1 + Math.floor(rnd() * 3);
    const u0 = rnd();
    const size = type === 2 ? 0.008 + rnd() * 0.004 : type === 1 ? 0.0032 + rnd() * 0.001 : 0.0055 + rnd() * 0.004;
    const cr = rnd();
    const col = type === 2 ? (rnd() < 0.3 ? cols[2] : cr < 0.5 ? cols[0] : cols[1]) : cr < 0.45 ? cols[0] : cr < 0.97 ? cols[1] : cols[2];
    const bright = type === 2 || rnd() < 0.25;
    const inten = (type === 2 ? 2.4 : 1.6) * (0.35 + rnd() * 0.8) * (bright ? 1 : 0.18);
    for (let k = 0; k < group && count < PACKETS; k++, count++) {
      aL0.push(...host.L0);
      aP1.push((u0 + k * (type === 2 ? 0.011 : 0.0085)) % 1, laps, type, size);
      aP2.push(col.r, col.g, col.b, inten);
    }
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(12), 3));
  g.setAttribute("aCorner", new THREE.BufferAttribute(new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.setAttribute("aL0", new THREE.InstancedBufferAttribute(new Float32Array(aL0), 4));
  g.setAttribute("aP1", new THREE.InstancedBufferAttribute(new Float32Array(aP1), 4));
  g.setAttribute("aP2", new THREE.InstancedBufferAttribute(new Float32Array(aP2), 4));
  g.instanceCount = PACKETS;
  return g;
};

export const createLightStreams =
  (pal: LightStreamsPalette): LookFactory =>
  (gl) => {
    const post = new Post(gl, { msaa: 4, depth: false, dof: false });
    const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.1, 100);
    camera.position.set(0, 0, CAM_Z);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    const shared = {
      uTh: { value: 0 },
      uT: { value: 0 },
      uHalf: { value: new THREE.Vector2(HALF_W, HALF_H) },
      uCamZ: { value: CAM_Z },
      uFocusZ: { value: 0.0 },
      uCocK: { value: 0.0042 },
      uRes: { value: new THREE.Vector2(post.width, post.height) },
    };
    const additive = {
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    };
    const lineMat = new THREE.ShaderMaterial({
      vertexShader: LINE_VERT,
      fragmentShader: LINE_FRAG,
      uniforms: {
        ...shared,
        uColA: { value: new THREE.Color(pal.lineA) },
        uColB: { value: new THREE.Color(pal.lineB) },
      },
      ...additive,
    });
    const packetMat = new THREE.ShaderMaterial({
      vertexShader: PACKET_VERT,
      fragmentShader: PACKET_FRAG,
      uniforms: shared,
      ...additive,
    });
    const bgMat = fullscreenMaterial(BG_FRAG, {
      ...shared,
      uBg: { value: new THREE.Color(pal.background) },
      uGlow: { value: new THREE.Color(pal.lineA) },
    });
    const scene = new THREE.Scene();
    const bgGeo = new THREE.BufferGeometry();
    bgGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const bg = new THREE.Mesh(bgGeo, bgMat);
    const lines = new THREE.Mesh(buildLineGeometry(), lineMat);
    const packets = new THREE.Mesh(buildPacketGeometry(pal), packetMat);
    [bg, lines, packets].forEach((m, i) => {
      m.frustumCulled = false;
      m.renderOrder = i;
      scene.add(m);
    });

    return {
      render(frame) {
        const t = phaseOf(frame);
        shared.uT.value = t;
        shared.uTh.value = t * Math.PI * 2;
        post.render(scene, camera, frame, {
          bloom: 1.5,
          threshold: 0.25,
          knee: 0.4,
          exposure: 0.72,
          saturation: 1.3,
          grain: 0.02,
          bloomWeights: [1, 1, 1, 0.9, 0.8, 0.7, 0.6],
        });
      },
      dispose() {
        post.dispose();
        lines.geometry.dispose();
        packets.geometry.dispose();
        bgGeo.dispose();
        lineMat.dispose();
        packetMat.dispose();
        bgMat.dispose();
      },
    };
  };
