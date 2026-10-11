import * as THREE from "three";
import { mulberry32 } from "../lib/random";
import { Bloom, COMMON, FullscreenPass, makeDofGather, makeRT, makeTent, shader } from "../gl/post";
import type { Stage, StageFactory } from "../gl/GLStage";
import { buildNetwork, finalFrame, type Network } from "./network";

// ------------------------------------------------------------ constants --
const NAVY0 = new THREE.Color("#020818");
const NAVY1 = new THREE.Color("#0A1A40");
const STRAND = new THREE.Color("#8AD8F0");
const CUBE = new THREE.Color("#3A8AFF");
const CHIP = new THREE.Color("#6AC8FF");
const BAR = new THREE.Color("#8AB8F0");
const VIOLET0 = new THREE.Color("#8A5AFF");
const VIOLET1 = new THREE.Color("#C8A8FF");
const TEXT = "Ask Me Anything";

export type AIMode = "story" | "loop";

const NET = buildNetwork(4711); // module level: identical in every tab

// --------------------------------------------------------- camera paths --
interface Key { f: number; pos: THREE.Vector3; tgt: THREE.Vector3; focus: THREE.Vector3 }

// Cubic Hermite through keys with time-based tangents (C1 in time); zero
// velocity at the first and last key.
const hermite = (keys: Key[], f: number, pick: (k: Key) => THREE.Vector3) => {
  if (f <= keys[0].f) return pick(keys[0]).clone();
  const last = keys[keys.length - 1];
  if (f >= last.f) return pick(last).clone();
  let i = 0;
  while (keys[i + 1].f < f) i++;
  const k0 = keys[i], k1 = keys[i + 1];
  const tan = (j: number) => {
    if (j === 0 || j === keys.length - 1) return new THREE.Vector3();
    return pick(keys[j + 1]).clone().sub(pick(keys[j - 1])).divideScalar(keys[j + 1].f - keys[j - 1].f);
  };
  const dt = k1.f - k0.f;
  const t = (f - k0.f) / dt;
  const t2 = t * t, t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
  return pick(k0).clone().multiplyScalar(h00)
    .add(tan(i).multiplyScalar(h10 * dt))
    .add(pick(k1).clone().multiplyScalar(h01))
    .add(tan(i + 1).multiplyScalar(h11 * dt));
};

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

const storyKeys = (n: Network): Key[] => {
  const p0 = n.path[0], p1 = n.path[1], p2 = n.path[2];
  const fin = n.final;
  // the hold looks across the last segment so the violet beam runs left to
  // right into the answer; the target sits right of it -> answer left of centre
  const { r, v } = finalFrame(p2.v0, fin);
  const holdPos = (d: number) => fin.clone().addScaledVector(v, -d).add(V(0, 0.25, 0)).addScaledVector(r, -0.3);
  const holdTgt = fin.clone().addScaledVector(r, 0.75);
  return [
    { f: 0, pos: V(0, 0.55, 7.2), tgt: V(0, 0.45, 0), focus: V(0, 0.6, 0) },
    { f: 75, pos: V(0, 0.45, 6.0), tgt: V(0, 0.35, 0), focus: V(0, 0.5, 0) },
    { f: 122, pos: V(0.05, 0.08, 2.4), tgt: V(0, 0, 0), focus: V(0, 0, 0) },
    { f: 168, pos: V(-2.6, 0.9, 2.6), tgt: V(5, 0, -0.5), focus: p0.getPoint(0.25) },
    { f: 240, pos: p0.getPoint(0.75).add(V(-2.2, 1.0, 2.6)), tgt: p1.getPoint(0.3), focus: p0.getPoint(0.95) },
    { f: 300, pos: p1.getPoint(0.55).add(V(-1.8, 0.7, 2.0)), tgt: p2.getPoint(0.2), focus: p1.getPoint(0.9) },
    { f: 360, pos: holdPos(4.6).addScaledVector(r, -1.2).add(V(0, 0.3, 0)), tgt: holdTgt, focus: fin },
    { f: 405, pos: holdPos(3.9), tgt: holdTgt, focus: fin },
    { f: 449, pos: holdPos(3.75), tgt: holdTgt, focus: fin },
  ];
};

// 2B: one closed lap through the middle branches.
const loopPose = (n: Network, f: number) => {
  const th = (f / 600) * Math.PI * 2;
  // drift on a closed loop beside the hub the violet route passes through:
  // the route arrives from the left, the hub's fans burst out to the right
  const hub = n.path[0].v3;
  const pos = hub.clone().add(V(-1.6 + 0.9 * Math.cos(th), 0.3 + 0.5 * Math.sin(th), 3.8 + 0.6 * Math.sin(th)));
  const tgt = hub.clone().add(V(0.25 + 0.3 * Math.sin(th), 0.15 * Math.cos(th), 0));
  return { pos, tgt, focus: hub.clone() };
};

// ------------------------------------------------------------- textures --
const canvasTex = (c: HTMLCanvasElement) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
};

// Search bar outline/fill and the text on separate textures; the text is
// revealed character by character in the shader (x-cut from measured widths).
const makeBarTextures = () => {
  const W = 2048, H = 256;
  const bar = document.createElement("canvas");
  bar.width = W; bar.height = H;
  const b = bar.getContext("2d")!;
  const r = 100, x0 = 40, y0 = 28, w = W - 80, h = H - 56;
  const rr = () => {
    b.beginPath();
    b.moveTo(x0 + r, y0);
    b.arcTo(x0 + w, y0, x0 + w, y0 + h, r);
    b.arcTo(x0 + w, y0 + h, x0, y0 + h, r);
    b.arcTo(x0, y0 + h, x0, y0, r);
    b.arcTo(x0, y0, x0 + w, y0, r);
    b.closePath();
  };
  rr();
  b.fillStyle = "rgba(138,184,240,0.10)";
  b.fill();
  b.lineWidth = 10;
  b.strokeStyle = "rgba(138,184,240,1)";
  b.stroke();
  const text = document.createElement("canvas");
  text.width = W; text.height = H;
  const t = text.getContext("2d")!;
  t.font = "600 120px Inter";
  t.textBaseline = "middle";
  t.fillStyle = "#ffffff";
  const tx = 150;
  t.fillText(TEXT, tx, H / 2 + 6);
  // x position (in uv) after each character
  const cuts: number[] = [];
  for (let i = 0; i <= TEXT.length; i++) cuts.push((tx + t.measureText(TEXT.slice(0, i)).width) / W);
  return { bar: canvasTex(bar), text: canvasTex(text), cuts, aspect: W / H };
};

const makeChipTexture = () => {
  const S = 1024;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  g.strokeStyle = "#ffffff";
  g.lineCap = "round";
  const q = S * 0.26; // half size of the chip body
  g.lineWidth = 14;
  g.strokeRect(S / 2 - q, S / 2 - q, 2 * q, 2 * q);
  g.lineWidth = 10;
  g.strokeRect(S / 2 - q * 0.42, S / 2 - q * 0.42, q * 0.84, q * 0.84);
  // ~40 pins: 10 per side, radiating outward
  g.lineWidth = 9;
  for (let side = 0; side < 4; side++) {
    for (let i = 0; i < 10; i++) {
      const a = -q + (2 * q * (i + 0.5)) / 10;
      const len = S * 0.1 + (i % 3) * S * 0.012;
      const pts: Array<[number, number, number, number]> = [
        [S / 2 + a, S / 2 - q, S / 2 + a, S / 2 - q - len],
        [S / 2 + q, S / 2 + a, S / 2 + q + len, S / 2 + a],
        [S / 2 + a, S / 2 + q, S / 2 + a, S / 2 + q + len],
        [S / 2 - q, S / 2 + a, S / 2 - q - len, S / 2 + a],
      ];
      const [x1, y1, x2, y2] = pts[side];
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.stroke();
      g.beginPath();
      g.arc(x2, y2, 9, 0, Math.PI * 2);
      g.fillStyle = "#ffffff";
      g.fill();
    }
  }
  return canvasTex(c);
};

// --------------------------------------------------------------- shaders --
const STRAND_VERT = /* glsl */ `
  attribute vec4 iP0; attribute vec4 iP1; attribute vec4 iP2; attribute vec4 iP3; // xyz + spare
  attribute vec4 iA; // birth, dur, alpha, pulse trips
  attribute vec4 iB; // phase, width mult, colour mix, unused
  uniform float uTime; uniform float uLoop; uniform vec2 uRes; uniform float uWidth; uniform float uFocus; uniform float uCocK;
  varying float vSide; varying float vAlpha; varying float vT; varying float vBead; varying float vMix;
  vec3 bez(float t){ float u = 1.0 - t; return u*u*u*iP0.xyz + 3.0*u*u*t*iP1.xyz + 3.0*u*t*t*iP2.xyz + t*t*t*iP3.xyz; }
  void main(){
    float grow = clamp((uTime - iA.x) / iA.y, 0.0, 1.0);
    float gu = 1.0 - grow;
    grow = 1.0 - gu * gu; // ease out (no pow: pow(0, y) is NaN on some drivers)
    float t = position.x * grow;
    vec3 p = bez(t);
    vec3 q = bez(min(t + 0.01, 1.0)) - bez(max(t - 0.01, 0.0));
    vec4 c0 = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    vec4 c1 = projectionMatrix * modelViewMatrix * vec4(p + normalize(q) * 0.05, 1.0);
    vec2 s0 = c0.xy / c0.w * uRes * 0.5, s1 = c1.xy / c1.w * uRes * 0.5;
    vec2 dir = normalize(s1 - s0 + vec2(1e-5, 0.0));
    vec2 nrm = vec2(-dir.y, dir.x);
    // depth of field for a thin line: it widens and dims by its blur
    float z = -(modelViewMatrix * vec4(p, 1.0)).z;
    float coc = abs(1.0 - uFocus / max(z, 0.01)) * uCocK;
    float w = uWidth * iB.y;
    float wd = max(w + 2.0 * coc, 1.0);
    vAlpha = iA.z * w / wd * step(0.0001, grow);
    vSide = position.y;
    vT = t;
    vMix = iB.z;
    // bead: whole trips per loop (uLoop frames)
    float tp = fract(mod(uTime, uLoop) / uLoop * iA.w + iB.x);
    float bd = (t - tp) / 0.0035;
    vBead = iA.w > 0.0 ? exp(-bd * bd) * step(0.0001, grow) : 0.0;
    vec2 off = nrm * position.y * wd * 0.5 * (1.0 + vBead * 0.6);
    gl_Position = c0 + vec4(off / (uRes * 0.5) * c0.w, 0.0, 0.0);
  }`;
const STRAND_FRAG = /* glsl */ `
  uniform vec3 uColA; uniform vec3 uColB; uniform float uGain; uniform float uBead;
  varying float vSide; varying float vAlpha; varying float vT; varying float vBead; varying float vMix;
  void main(){
    float prof = exp(-vSide * vSide * 2.2);
    // a touch brighter near both ends (where fans gather)
    float ends = 1.0 + 0.6 * exp(-vT * 18.0) + 0.3 * exp(-(1.0 - vT) * 14.0);
    vec3 col = mix(uColA, uColB, clamp(vT * vMix, 0.0, 1.0));
    vec3 c = col * vAlpha * prof * ends * uGain + vec3(0.35, 0.8, 1.0) * vBead * 1.6 * uBead * prof;
    gl_FragColor = vec4(c, 1.0);
  }`;

const CUBE_VERT = /* glsl */ `
  attribute vec4 iC; // birth, bright, flick cycles, phase
  attribute float iFinal;
  uniform float uTime; uniform float uLoop;
  varying vec3 vLocal; varying float vBright; varying float vFinal; varying vec3 vN;
  varying float vNear;
  void main(){
    float appear = clamp((uTime - iC.x) / 12.0, 0.0, 1.0);
    appear = appear * appear * (3.0 - 2.0 * appear);
    vLocal = position;
    vN = normal;
    float fl = 1.0 + 0.18 * sin(6.2831853 * (mod(uTime, uLoop) / uLoop * iC.z + iC.w));
    vBright = iC.y * fl * appear;
    vFinal = iFinal;
    vec4 wp = instanceMatrix * vec4(position * appear, 1.0);
    vec4 mv = modelViewMatrix * wp;
    // cubes brushing past the lens would become huge white blurs: fade them
    vNear = smoothstep(1.2, 3.5, -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;
const CUBE_FRAG = /* glsl */ `
  uniform vec3 uCol; uniform float uFlare;
  varying vec3 vLocal; varying float vBright; varying float vFinal; varying vec3 vN;
  varying float vNear;
  void main(){
    vec3 a = abs(vLocal) * 2.0;
    float mx = max(a.x, max(a.y, a.z)), mn = min(a.x, min(a.y, a.z));
    float mid = a.x + a.y + a.z - mx - mn;
    float edge = smoothstep(0.78, 0.94, mid);
    // solid shaded blue blocks: lit faces brighter, side faces darker,
    // a soft cyan rim on the edges
    float lit = max(dot(normalize(vN), normalize(vec3(-0.35, 0.55, 0.75))), 0.0);
    float face = 0.3 + 0.6 * lit;
    vec3 c = uCol * face + vec3(0.15, 0.55, 1.0) * lit * lit * 0.25 + vec3(0.2, 0.5, 1.0) * edge * 0.1;
    c *= vBright;
    // the answer: glassy blue with a glowing mosaic inside and a bright rim
    if (vFinal > 0.5) {
      vec2 g = fract((vLocal.xy + vLocal.z) * 5.0);
      float cellv = step(0.12, g.x) * step(0.12, g.y);
      float mosaic = cellv * (0.5 + 0.5 * fract(sin(dot(floor((vLocal.xy + vLocal.z) * 5.0), vec2(12.9898, 78.233))) * 43758.5453));
      c = uCol * (0.35 + 0.35 * lit) + mix(vec3(0.05, 0.3, 1.0), vec3(0.25, 0.7, 1.0), mosaic) * mosaic * 0.7 + vec3(0.4, 0.8, 1.0) * edge * 0.6;
      c *= 1.0 + uFlare * 0.3;
    }
    gl_FragColor = vec4(c * vNear, 1.0);
  }`;

const DUST_VERT = /* glsl */ `
  attribute vec4 iD; // phase, cycles, size, bright
  uniform float uTime; uniform float uLoop; uniform float uFocus; uniform float uCocK; uniform float uPx;
  varying float vA; varying float vSize;
  void main(){
    float a = 6.2831853 * (mod(uTime, uLoop) / uLoop * iD.y + iD.x);
    vec3 p = position + vec3(sin(a), cos(a * 1.0), sin(a + 1.3)) * 0.25;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float z = -mv.z;
    float coc = abs(1.0 - uFocus / max(z, 0.01)) * uCocK;
    float s = iD.z * uPx;
    float size = s + 2.0 * coc;
    gl_PointSize = max(size, 1.0);
    vSize = gl_PointSize;
    vA = iD.w * (s * s) / (gl_PointSize * gl_PointSize) * smoothstep(0.2, 1.2, z);
    gl_Position = projectionMatrix * mv;
  }`;
const DUST_FRAG = /* glsl */ `
  varying float vA; varying float vSize;
  void main(){
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d) * 2.0;
    // tiny square motes (sharp) that round off into bokeh discs when blurred
    vec2 ad = abs(d) * 2.0;
    float sq = 1.0 - smoothstep(0.75, 1.0, max(ad.x, ad.y));
    float disc = mix(sq, 1.0 - smoothstep(0.8, 1.0, r), smoothstep(3.0, 8.0, vSize));
    gl_FragColor = vec4(vec3(0.55, 0.75, 1.0) * vA * disc * 2.0, 1.0);
  }`;

// ----------------------------------------------------------------- stage --
export class AIStage implements Stage {
  private scene = new THREE.Scene(); // additive glow layer
  private cubeScene = new THREE.Scene(); // opaque cubes (gets the DoF gather)
  private camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 200);
  private strandMat: THREE.ShaderMaterial;
  private violetMat: THREE.ShaderMaterial;
  private cubeMat: THREE.ShaderMaterial;
  private dustMat: THREE.ShaderMaterial;
  private bar: { group: THREE.Group; barMat: THREE.ShaderMaterial; textMat: THREE.ShaderMaterial; cuts: number[] } | null = null;
  private chip: { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; cube: THREE.Mesh; cubeMat: THREE.ShaderMaterial } | null = null;
  private keys: Key[];
  private loopLen: number;
  // post
  private fs = new FullscreenPass();
  private glowRT: THREE.WebGLRenderTarget;
  private cubeRT: THREE.WebGLRenderTarget;
  private cocRT: THREE.WebGLRenderTarget;
  private dofA: THREE.WebGLRenderTarget;
  private dofB: THREE.WebGLRenderTarget;
  private sumRT: THREE.WebGLRenderTarget;
  private bloom: Bloom;
  private bg: THREE.ShaderMaterial;
  private coc: THREE.ShaderMaterial;
  private gather = makeDofGather();
  private tent = makeTent();
  private sum: THREE.ShaderMaterial;
  private final: THREE.ShaderMaterial;
  private dofScale: number;

  constructor(gl: THREE.WebGLRenderer, private W: number, private H: number, private mode: AIMode) {
    gl.toneMapping = THREE.NoToneMapping;
    gl.outputColorSpace = THREE.LinearSRGBColorSpace;
    gl.shadowMap.enabled = false;
    this.loopLen = mode === "story" ? 450 : 600;
    this.keys = storyKeys(NET);
    const res = new THREE.Vector2(W, H);
    const px = H / 2160; // 1 px at 4K, in output pixels

    // ---- strands (instanced ribbons)
    const SEG = 64;
    const strip = new THREE.BufferGeometry();
    const pos: number[] = [];
    const idx: number[] = [];
    for (let i = 0; i <= SEG; i++) {
      pos.push(i / SEG, -1, 0, i / SEG, 1, 0);
      if (i < SEG) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    strip.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    strip.setIndex(idx);
    // Per-strand data rides on an InstancedMesh as extra instanced
    // attributes (the shader ignores instanceMatrix).
    const mkInst = (list: Array<{ p: THREE.Vector3[]; a: number[]; b: number[] }>, mat: THREE.Material) => {
      const g = new THREE.BufferGeometry();
      g.setIndex(strip.index);
      g.setAttribute("position", strip.getAttribute("position"));
      const P = [0, 1, 2, 3].map(() => new Float32Array(list.length * 4));
      const A = new Float32Array(list.length * 4), B = new Float32Array(list.length * 4);
      list.forEach((s, i) => {
        for (let k = 0; k < 4; k++) P[k].set([s.p[k].x, s.p[k].y, s.p[k].z, 1], i * 4);
        A.set(s.a, i * 4);
        B.set(s.b, i * 4);
      });
      ["iP0", "iP1", "iP2", "iP3"].forEach((n, k) => g.setAttribute(n, new THREE.InstancedBufferAttribute(P[k], 4)));
      g.setAttribute("iA", new THREE.InstancedBufferAttribute(A, 4));
      g.setAttribute("iB", new THREE.InstancedBufferAttribute(B, 4));
      const m = new THREE.InstancedMesh(g, mat, list.length);
      m.frustumCulled = false;
      return m;
    };
    const strandUniforms = () => ({
      uTime: { value: 0 }, uLoop: { value: 600 }, uRes: { value: res }, uWidth: { value: 1.5 * px }, uFocus: { value: 5 }, uCocK: { value: (mode === "story" ? 0.012 : 0.006) * H },
      uColA: { value: STRAND.clone().multiply(new THREE.Color(0.72, 0.9, 1.25)) }, uColB: { value: STRAND.clone().multiply(new THREE.Color(0.72, 0.9, 1.25)) }, uGain: { value: mode === "story" ? 1.0 : 0.4 }, uBead: { value: mode === "story" ? 0.25 : 0.65 },
    });
    // DoubleSide: a screen-space ribbon's winding flips with its direction
    const additive = { blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true, side: THREE.DoubleSide };
    this.strandMat = new THREE.ShaderMaterial({ vertexShader: STRAND_VERT, fragmentShader: STRAND_FRAG, uniforms: strandUniforms(), ...additive });
    const strands = mkInst(NET.strands.map((s) => ({ p: s.p, a: [s.birth, s.dur, s.alpha, s.pulse], b: [s.phase, s.width ?? 1, 0, 0] })), this.strandMat);
    strands.frustumCulled = false;
    this.scene.add(strands);
    // violet route: thicker ribbon, draws on segment by segment
    this.violetMat = new THREE.ShaderMaterial({ vertexShader: STRAND_VERT, fragmentShader: STRAND_FRAG, uniforms: strandUniforms(), ...additive });
    this.violetMat.uniforms.uWidth.value = 9 * px;
    this.violetMat.uniforms.uColA.value = VIOLET0.clone();
    this.violetMat.uniforms.uColB.value = VIOLET1.clone();
    this.violetMat.uniforms.uGain.value = 4.5;
    // 2B: the violet route ends at the hub; a blue-white continuation runs on
    // to a glowing point a little past it
    const route = mode === "story" ? NET.path : NET.path.slice(0, 1);
    const vio = mkInst(route.map((c, i) => ({ p: [c.v0, c.v1, c.v2, c.v3], a: [NET.pathTimes[i][0], NET.pathTimes[i][1] - NET.pathTimes[i][0], 1, 0], b: [0, 1, 1, 0] })), this.violetMat);
    if (mode === "loop") {
      const p1 = NET.path[1];
      const end = p1.getPoint(0.3);
      const sub = new THREE.CubicBezierCurve3(p1.v0, p1.v0.clone().lerp(p1.v1, 0.3), p1.getPoint(0.18), end);
      const cont = mkInst([{ p: [sub.v0, sub.v1, sub.v2, sub.v3], a: [0, 1, 1, 0], b: [0, 2.2, 0, 0] }], this.strandMat);
      cont.renderOrder = 1;
      this.scene.add(cont);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.8, 1.0).multiplyScalar(6) }));
      dot.position.copy(end);
      this.cubeScene.add(dot);
    }
    vio.frustumCulled = false;
    this.scene.add(vio);

    // ---- cubes
    const cubeGeo = new THREE.BoxGeometry(1, 1, 1);
    this.cubeMat = new THREE.ShaderMaterial({ vertexShader: CUBE_VERT, fragmentShader: CUBE_FRAG, uniforms: { uTime: { value: 0 }, uLoop: { value: 600 }, uCol: { value: CUBE.clone() }, uFlare: { value: 0 } } });
    const cubes = new THREE.InstancedMesh(cubeGeo, this.cubeMat, NET.cubes.length);
    const ic = new Float32Array(NET.cubes.length * 4), fin = new Float32Array(NET.cubes.length);
    const rq = mulberry32(99);
    NET.cubes.forEach((c, i) => {
      const e = new THREE.Euler((rq() - 0.5) * 0.7, (rq() - 0.5) * 1.1, (rq() - 0.5) * 0.3);
      // the answer faces the final camera squarely
      const q = c.final ? new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), finalFrame(NET.path[2].v0, NET.final).v.clone().negate()) : new THREE.Quaternion().setFromEuler(e);
      const m = new THREE.Matrix4().compose(c.pos, q, new THREE.Vector3(c.size, c.size, c.size));
      cubes.setMatrixAt(i, m);
      ic.set([c.birth, c.bright, c.flick, c.phase], i * 4);
      fin[i] = c.final ? 1 : 0;
    });
    cubeGeo.setAttribute("iC", new THREE.InstancedBufferAttribute(ic, 4));
    cubeGeo.setAttribute("iFinal", new THREE.InstancedBufferAttribute(fin, 1));
    cubes.frustumCulled = false;
    this.cubeScene.add(cubes);

    // ---- dust (3000 points, bokeh by CoC)
    const rd = mulberry32(31337);
    const N = 3000;
    const dp = new Float32Array(N * 3), dd = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      dp.set([-8 + rd() * 44, -9 + rd() * 18, -9 + rd() * 18], i * 3);
      dd.set([rd(), 1 + Math.floor(rd() * 2), 1.5 + rd() * 3.5, 0.15 + rd() * 0.5], i * 4);
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute("position", new THREE.BufferAttribute(dp, 3));
    dg.setAttribute("iD", new THREE.BufferAttribute(dd, 4));
    this.dustMat = new THREE.ShaderMaterial({ vertexShader: DUST_VERT, fragmentShader: DUST_FRAG, uniforms: { uTime: { value: 0 }, uLoop: { value: 600 }, uFocus: { value: 5 }, uCocK: { value: 0.02 * H }, uPx: { value: px * 1.0 } }, ...additive });
    const dust = new THREE.Points(dg, this.dustMat);
    dust.frustumCulled = false;
    this.scene.add(dust);

    // ---- bar + chip (story only)
    if (mode === "story") {
      const bt = makeBarTextures();
      const barW = 2.6, barH = barW / bt.aspect;
      const flat = (map: THREE.Texture, color: THREE.Color) => new THREE.ShaderMaterial({
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform sampler2D map; uniform vec3 color; uniform float opacity; uniform float cut; uniform float gain; varying vec2 vUv;
          void main(){ vec4 t = texture2D(map, vUv); float m = step(vUv.x, cut); gl_FragColor = vec4(color * t.a * opacity * gain * m, 1.0); }`,
        uniforms: { map: { value: map }, color: { value: color.clone() }, opacity: { value: 0 }, cut: { value: 1 }, gain: { value: 1.6 } },
        ...additive,
      });
      const barMat = flat(bt.bar, BAR), textMat = flat(bt.text, new THREE.Color("#E8F2FF"));
      const group = new THREE.Group();
      const plane = new THREE.PlaneGeometry(barW, barH);
      group.add(new THREE.Mesh(plane, barMat), new THREE.Mesh(plane, textMat));
      group.position.set(0, 0.95, 0);
      this.scene.add(group);
      this.bar = { group, barMat, textMat, cuts: bt.cuts };
      const chipMat = flat(makeChipTexture(), CHIP);
      const chipMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), chipMat);
      this.scene.add(chipMesh);
      // the root cube the chip turns into (white-hot core, blue edges)
      const rcMat = new THREE.ShaderMaterial({
        vertexShader: `varying vec3 vL; void main(){ vL = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform float heat; uniform float op; varying vec3 vL;
          void main(){ vec3 a = abs(vL) * 2.0; float mx = max(a.x, max(a.y, a.z)), mn = min(a.x, min(a.y, a.z)); float mid = a.x + a.y + a.z - mx - mn;
            float edge = smoothstep(0.8, 0.95, mid);
            vec3 c = vec3(0.25, 0.6, 1.0) * (0.5 + edge * 2.5) + vec3(1.0, 0.97, 0.92) * heat;
            gl_FragColor = vec4(c * op, 1.0); }`,
        uniforms: { heat: { value: 0 }, op: { value: 0 } },
      });
      const rc = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), rcMat);
      this.cubeScene.add(rc);
      this.chip = { mesh: chipMesh, mat: chipMat, cube: rc, cubeMat: rcMat };
    }

    // ---- post
    this.glowRT = makeRT(W, H);
    this.cubeRT = makeRT(W, H, { samples: 4, depth: true });
    this.cocRT = makeRT(W, H);
    this.dofScale = Math.min(0.5, 960 / W);
    this.dofA = makeRT(W * this.dofScale, H * this.dofScale);
    this.dofB = makeRT(W * this.dofScale, H * this.dofScale);
    this.sumRT = makeRT(W, H);
    this.bloom = new Bloom(W, H, 6, 0.55, 0.5);
    this.bg = shader(`
      ${COMMON}
      uniform vec3 c0; uniform vec3 c1; uniform vec2 glow; uniform float glowK; uniform vec2 res; varying vec2 vUv;
      void main(){
        vec3 c = mix(c0, c1, smoothstep(0.0, 1.2, vUv.y * 0.6 + (1.0 - abs(vUv.x - 0.5)) * 0.5));
        vec2 d = (vUv - glow) * vec2(res.x / res.y, 1.0);
        c += vec3(0.008, 0.03, 0.1) * glowK * exp(-dot(d, d) * 1.4);
        c += vec3(0.004, 0.014, 0.05) * smoothstep(0.55, 1.0, vUv.y);
        gl_FragColor = vec4(c, 1.0);
      }`, { c0: { value: NAVY0.clone().convertSRGBToLinear() }, c1: { value: NAVY1.clone().convertSRGBToLinear().multiplyScalar(mode === "story" ? 1.2 : 0.5) }, glow: { value: new THREE.Vector2(0.5, 0.5) }, glowK: { value: mode === "story" ? 1 : 0.3 }, res: { value: res } });
    this.coc = shader(`
      uniform sampler2D tColor; uniform sampler2D tDepth; uniform float near; uniform float far; uniform float focus; uniform float cocInf; varying vec2 vUv;
      float lin(float d){ float z = d * 2.0 - 1.0; return 2.0 * near * far / (far + near - z * (far - near)); }
      void main(){
        float z = lin(texture2D(tDepth, vUv).x);
        float coc = clamp(cocInf * (1.0 - focus / z), -cocInf, cocInf);
        gl_FragColor = vec4(texture2D(tColor, vUv).rgb, coc);
      }`, { tColor: { value: this.cubeRT.texture }, tDepth: { value: this.cubeRT.depthTexture }, near: { value: 0.05 }, far: { value: 200 }, focus: { value: 5 }, cocInf: { value: 20 } });
    this.sum = shader(`
      uniform sampler2D tGlow; uniform sampler2D tSharp; uniform sampler2D tBlur; uniform float invScale; varying vec2 vUv;
      void main(){
        vec4 s = texture2D(tSharp, vUv); vec4 b = texture2D(tBlur, vUv);
        float t = smoothstep(0.7, 2.4, max(abs(s.a), b.a * invScale));
        gl_FragColor = vec4(texture2D(tGlow, vUv).rgb + mix(s.rgb, b.rgb, t), 1.0);
      }`, { tGlow: { value: this.glowRT.texture }, tSharp: { value: this.cocRT.texture }, tBlur: { value: this.dofB.texture }, invScale: { value: 1 / this.dofScale } });
    this.final = shader(`
      ${COMMON}
      uniform sampler2D tSrc; uniform sampler2D tBloom; uniform float bloomK; uniform float exposure; uniform float frame; uniform float loopLen; uniform vec2 res; varying vec2 vUv;
      void main(){
        vec3 c = (texture2D(tSrc, vUv).rgb + texture2D(tBloom, vUv).rgb * bloomK) * exposure;
        vec3 t = acesFilm(c);
        vec2 q = vUv - 0.5; q.x *= res.x / res.y;
        t *= 1.0 - 0.38 * smoothstep(0.3, 1.0, length(q));
        vec3 o = toSRGB(t);
        float f = mod(frame, loopLen);
        float g = hash12(gl_FragCoord.xy + vec2(f * 37.0, f * 91.0)) + hash12(gl_FragCoord.yx * 1.31 + f * 17.0) - 1.0;
        o += g * 0.015;
        o += (ign(gl_FragCoord.xy + f * 5.588238) - 0.5) * (2.0 / 255.0);
        gl_FragColor = vec4(o, 1.0);
      }`, { tSrc: { value: this.sumRT.texture }, tBloom: { value: null }, bloomK: { value: 0.38 }, exposure: { value: 1.25 }, frame: { value: 0 }, loopLen: { value: this.loopLen }, res: { value: res } });
  }

  render(gl: THREE.WebGLRenderer, frame: number) {
    const story = this.mode === "story";
    // 2B uses the raw frame: every periodic term is a whole number of cycles
    // per 600 frames (shaders take mod(t, 600)), so frame 600 == frame 0.
    const f = story ? Math.min(Math.max(frame, 0), 449) : frame;
    let pos: THREE.Vector3, tgt: THREE.Vector3, focusP: THREE.Vector3;
    if (story) {
      pos = hermite(this.keys, f, (k) => k.pos);
      tgt = hermite(this.keys, f, (k) => k.tgt);
      focusP = hermite(this.keys, f, (k) => k.focus);
    } else {
      ({ pos, tgt, focus: focusP } = loopPose(NET, f));
    }
    const cam = this.camera;
    cam.position.copy(pos);
    cam.fov = story ? 38 : 40;
    cam.aspect = this.W / this.H;
    cam.lookAt(tgt);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    const focus = Math.max(0.3, pos.distanceTo(focusP));

    // time uniforms: growth uses growT, periodic terms use f (whole cycles)
    for (const m of [this.strandMat, this.violetMat]) {
      m.uniforms.uFocus.value = focus;
      m.uniforms.uLoop.value = 600;
    }
    // 2B: clock = f + 6000 -> every strand/cube is long since born, and
    // beads/flicker (whole cycles per 600 frames) stay periodic in f.
    this.strandMat.uniforms.uTime.value = story ? f : f + 6000;
    this.violetMat.uniforms.uTime.value = story ? f : f + 6000;
    this.cubeMat.uniforms.uTime.value = story ? f : f + 6000;
    this.cubeMat.uniforms.uLoop.value = 600;
    this.dustMat.uniforms.uTime.value = f;
    this.dustMat.uniforms.uFocus.value = focus;

    if (story && this.bar && this.chip) {
      const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
      // bar fades in, text types on (15 chars, frames 14..66), cursor blinks
      const barOp = sm(0, 16, f) * (1 - sm(112, 135, f));
      this.bar.barMat.uniforms.opacity.value = barOp;
      const nChars = Math.max(0, Math.min(TEXT.length, Math.floor((f - 14) / 3.5)));
      const cut = this.bar.cuts[nChars];
      const cursorOn = Math.floor(f / 8) % 2 === 0 || (f > 14 && f < 70);
      this.bar.textMat.uniforms.opacity.value = barOp;
      // cursor = a thin slice of the bar texture drawn just after the cut
      this.bar.textMat.uniforms.cut.value = cut;
      this.bar.group.children[1].visible = true;
      this.setCursor(cut, barOp * (cursorOn ? 1 : 0));
      // chip: appears, lights up, then extrudes into the root cube
      const chipOp = sm(55, 80, f) * (1 - sm(104, 122, f));
      this.chip.mat.uniforms.opacity.value = chipOp;
      this.chip.mat.uniforms.gain.value = 1.2 + 2.5 * sm(80, 100, f);
      const ext = sm(100, 122, f);
      this.chip.cube.scale.set(1, 1, Math.max(0.02, ext));
      this.chip.cubeMat.uniforms.op.value = sm(96, 110, f);
      this.chip.cubeMat.uniforms.heat.value = 1.6 * sm(100, 125, f) * (1 - 0.6 * sm(150, 210, f)) + 0.3;
    }
    // final cube flare (2A: 345..380 then settle; 2B: gentle steady glow)
    this.cubeMat.uniforms.uFlare.value = story ? 5 * Math.exp(-(((f - 355) / 14) ** 2)) + 0.6 * Math.min(1, Math.max(0, (f - 340) / 20)) : 0.6;

    // 1. background + additive glow layer (strands, path, dust, bar, chip)
    const proj = tgt.clone().project(cam);
    this.bg.uniforms.glow.value.set(proj.x * 0.5 + 0.5, proj.y * 0.5 + 0.5);
    this.fs.run(gl, this.bg, this.glowRT);
    gl.setRenderTarget(this.glowRT);
    gl.autoClear = false;
    gl.render(this.scene, cam);
    gl.autoClear = true;
    // 2. cubes (opaque, depth) + DoF gather
    gl.setRenderTarget(this.cubeRT);
    gl.setClearColor(0x000000, 1);
    gl.clear();
    gl.render(this.cubeScene, cam);
    const cocPx = 0.02 * this.H;
    this.coc.uniforms.focus.value = focus;
    this.coc.uniforms.cocInf.value = cocPx;
    this.fs.run(gl, this.coc, this.cocRT);
    const ds = this.dofScale;
    this.gather.uniforms.tSrc.value = this.cocRT.texture;
    this.gather.uniforms.texel.value.set(1 / this.dofA.width, 1 / this.dofA.height);
    this.gather.uniforms.cocScale.value = ds;
    this.gather.uniforms.maxCoc.value = Math.max(2, cocPx * ds);
    this.fs.run(gl, this.gather, this.dofA);
    this.tent.uniforms.tSrc.value = this.dofA.texture;
    this.tent.uniforms.texel.value.set(1 / this.dofA.width, 1 / this.dofA.height);
    this.fs.run(gl, this.tent, this.dofB);
    this.fs.run(gl, this.sum, this.sumRT);
    // 3. bloom + final
    this.final.uniforms.tBloom.value = this.bloom.run(gl, this.fs, this.sumRT.texture, this.W, this.H);
    this.final.uniforms.frame.value = f;
    this.fs.run(gl, this.final, null);
  }

  private cursor: THREE.Mesh | null = null;
  private setCursor(cut: number, op: number) {
    if (!this.bar) return;
    if (!this.cursor) {
      const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.95, 1.0).multiplyScalar(1.6), blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false });
      this.cursor = new THREE.Mesh(new THREE.PlaneGeometry(0.012, 0.13), m);
      this.bar.group.add(this.cursor);
    }
    const barW = 2.6;
    this.cursor.position.set((cut - 0.5) * barW + 0.02, 0.0, 0.001);
    (this.cursor.material as THREE.MeshBasicMaterial).opacity = op;
    this.cursor.visible = op > 0.001;
  }
}

export const aiFactory = (mode: AIMode): StageFactory => (gl, w, h) => new AIStage(gl, w, h, mode);
