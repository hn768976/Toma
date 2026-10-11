import * as THREE from "three";
import { TAU } from "../lib/ease";
import { Look } from "../lib/LookCanvas";
import { Pipeline } from "../lib/post";
import { mulberry32 } from "../lib/random";

/**
 * Neon hub emblem, orthographic. World units: frame height = 1, origin at frame centre.
 * Every stroke is a ribbon whose fragment shader evaluates core + glow from the distance to its
 * centre line, and draw-on / pulse / flash from per-vertex attributes + the frame uniform.
 */

export type HubMode = "drawOn" | "pulseLoop";

const HUB = new THREE.Vector2(0, 0.165);
const R = 0.092; // ring radius (≈9% of frame height)
const DEV_W = 0.056;
const DEV_H = 0.066;

type Stroke = {
  pts: THREE.Vector2[];
  width: number; // core half-width multiplier
  white?: number; // how white the core is (0 = glow colour, 1 = white-blue core); default 1
  bright: number;
  start: number; // draw-on start frame
  dur: number; // draw-on duration (frames)
  pulse?: { k: number; phase: number }; // whole trips per 600 frames
  flash?: { k: number; phase: number; pop: number; center: THREE.Vector2 }; // device
  fill?: boolean; // solid soft body (device fill)
  ring?: number; // 1 = rotates with the ring
  teeth?: THREE.Vector2; // tooth pop centre
};

const arc = (c: THREE.Vector2, r: number, a0: number, a1: number, n = 48) => {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push(new THREE.Vector2(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r));
  }
  return pts;
};

const roundRect = (c: THREE.Vector2, w: number, h: number, r: number) => {
  const pts: THREE.Vector2[] = [];
  const corners: [number, number, number][] = [
    [c.x + w / 2 - r, c.y + h / 2 - r, 0],
    [c.x - w / 2 + r, c.y + h / 2 - r, Math.PI / 2],
    [c.x - w / 2 + r, c.y - h / 2 + r, Math.PI],
    [c.x + w / 2 - r, c.y - h / 2 + r, (3 * Math.PI) / 2],
  ];
  for (const [x, y, a0] of corners)
    for (let i = 0; i <= 5; i++) {
      const a = a0 + (i / 5) * (Math.PI / 2);
      pts.push(new THREE.Vector2(x + Math.cos(a) * r, y + Math.sin(a) * r));
    }
  pts.push(pts[0].clone());
  return pts;
};

const bezier = (p0: THREE.Vector2, p1: THREE.Vector2, p2: THREE.Vector2, p3: THREE.Vector2, n = 40) => {
  const c = new THREE.CubicBezierCurve(p0, p1, p2, p3);
  return c.getPoints(n);
};

// Left wing (reference-like pixel space 768×432, hub centre at 384,140); the right wing is its mirror.
// parent: index of the device it branches from; -1 = end of the upper hub bar, -2 = lower-left of the ring.
const LEFT_DEVICES: { px: [number, number]; parent: number }[] = [
  { px: [257, 140], parent: -1 },
  { px: [183, 120], parent: 0 },
  { px: [125, 105], parent: 1 },
  { px: [195, 183], parent: 0 },
  { px: [128, 178], parent: 3 },
  { px: [93, 225], parent: 4 },
  { px: [318, 258], parent: -2 },
  { px: [243, 240], parent: 6 },
  { px: [185, 228], parent: 7 },
  { px: [255, 300], parent: 6 },
  { px: [190, 295], parent: 9 },
  { px: [155, 342], parent: 10 },
  { px: [236, 352], parent: 9 },
];
const toWorld = ([x, y]: [number, number]) => new THREE.Vector2((x - 384) / 432, (140 - y) / 432 + HUB.y);

const buildStrokes = (mode: HubMode): Stroke[] => {
  const rnd = mulberry32(0x1f2e3d4c);
  const story = mode === "drawOn";
  const S: Stroke[] = [];
  const T = (s: number) => (story ? s : -1000);

  // ---- hub (0–2 s): bright main ring, thin inner ring, segmented outer band with gaps ----
  S.push({ pts: arc(HUB, R, Math.PI / 2, Math.PI / 2 + TAU, 128), width: 2.0, bright: 1.05, white: 0.55, start: T(4), dur: 40 });
  S.push({ pts: arc(HUB, R * 0.8, -Math.PI / 2, -Math.PI / 2 + TAU, 112), width: 0.8, bright: 0.75, white: 0.5, start: T(14), dur: 36 });
  // outer band: four arc-band segments, gaps at about 10 and 2 o'clock and at the bottom (static)
  const r1 = R * 1.18;
  const r2 = R * 1.36;
  const segs: [number, number][] = [
    [0.12, 0.92], // right-top … top-right gap at ~2 o'clock (≈ 0.5 rad)
    [1.08, 2.06],
    [2.22, 4.38],
    [4.62, 6.0],
  ];
  segs.forEach(([a0, a1], i) => {
    const pts = [...arc(HUB, r1, a0, a1, 24), ...arc(HUB, r2, a1, a0, 24)];
    pts.push(pts[0].clone());
    S.push({ pts, width: 1.2, bright: 1.1, white: 0.5, start: T(30 + i * 3), dur: 16 });
  });
  // 12 notches/teeth on the outer edge of the band — these rotate one notch period per loop
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + 0.26;
    const w = 0.07;
    const c = new THREE.Vector2(HUB.x + Math.cos(a) * R * 1.44, HUB.y + Math.sin(a) * R * 1.44);
    const pts = [...arc(HUB, R * 1.36, a - w, a + w, 4), ...arc(HUB, R * 1.47, a + w, a - w, 4)];
    pts.push(pts[0].clone());
    S.push({ pts, width: 0.8, bright: 0.85, white: 0.4, start: T(44 + i * 1.5), dur: 8, ring: 1, teeth: c });
  }
  // two horizontal bars each side at the hub's lower half, with small square terminals
  const barA = HUB.y - 0.05;
  const barB = HUB.y - 0.095;
  for (const sgn of [-1, 1]) {
    S.push({ pts: [new THREE.Vector2(sgn * R * 1.0, barA), new THREE.Vector2(sgn * 0.25, barA)], width: 0.8, bright: 0.85, white: 0.4, start: T(50), dur: 12 });
    S.push({ pts: [new THREE.Vector2(sgn * R * 0.7, barB), new THREE.Vector2(sgn * 0.27, barB)], width: 0.7, bright: 0.7, white: 0.3, start: T(54), dur: 12 });
    for (const [x, y] of [[0.106, barA], [0.178, barB]] as [number, number][]) {
      S.push({ pts: roundRect(new THREE.Vector2(sgn * x, y), 0.014, 0.014, 0.002), width: 0.9, bright: 1.0, white: 0.6, start: T(58), dur: 4 });
    }
  }

  // ---- devices + wires (left wing, then mirrored) ----
  type Dev = { p: THREE.Vector2; depth: number; parent: number };
  const devs: Dev[] = [];
  LEFT_DEVICES.forEach((d) => {
    const depth = d.parent < 0 ? 0 : devs[d.parent].depth + 1;
    devs.push({ p: toWorld(d.px), depth, parent: d.parent });
  });
  const tierStart = [62, 100, 138, 172];
  const pops: number[] = [];
  const wing: Stroke[] = [];
  devs.forEach((d, di) => {
    let from: THREE.Vector2;
    if (d.parent === -1) from = new THREE.Vector2(-0.25, barA);
    else if (d.parent === -2) {
      const ang = Math.PI * 1.3;
      from = new THREE.Vector2(HUB.x + Math.cos(ang) * R * 1.36, HUB.y + Math.sin(ang) * R * 1.36);
    } else {
      const par = devs[d.parent].p;
      from = new THREE.Vector2(par.x - DEV_W * 0.52, par.y + (rnd() - 0.5) * DEV_H * 0.5);
    }
    const to = new THREE.Vector2(d.p.x + DEV_W * 0.52, d.p.y + (rnd() - 0.5) * DEV_H * 0.4);
    const dx = to.x - from.x;
    const wob = (rnd() - 0.5) * 0.025;
    const pts = bezier(
      from,
      new THREE.Vector2(from.x + dx * (0.35 + rnd() * 0.2), from.y + wob),
      new THREE.Vector2(to.x - dx * (0.35 + rnd() * 0.2), to.y - wob),
      to,
    );
    const len = pts.reduce((sum, p, i) => (i ? sum + p.distanceTo(pts[i - 1]) : 0), 0);
    const parentPop = d.parent >= 0 ? pops[d.parent] : 0;
    const wStart = Math.max(tierStart[Math.min(d.depth, 3)] + rnd() * 10, parentPop + 2);
    const wDur = Math.round(14 + len * 60);
    const pulse = { k: 1 + Math.floor(rnd() * 2), phase: rnd() };
    wing.push({ pts, width: 0.5, bright: 0.75, white: 0.3, start: T(wStart), dur: wDur, pulse });
    // doubled / tripled traces, as in the reference
    const strands = 1 + Math.floor(rnd() * 2.6);
    for (let k = 1; k <= strands; k++) {
      const off = pts.map((p, i) => {
        const u = i / (pts.length - 1);
        const e = Math.min(1, Math.min(u, 1 - u) / 0.12);
        return new THREE.Vector2(p.x, p.y + e * 0.0055 * k * (k % 2 ? 1 : -1));
      });
      wing.push({ pts: off, width: 0.4, bright: 0.45, white: 0.15, start: T(wStart + 3 * k), dur: wDur });
    }
    const pop = wStart + wDur;
    pops[di] = pop;
    const flash = { k: pulse.k, phase: pulse.phase, pop: story ? pop : -1000, center: d.p.clone() };
    wing.push({ pts: roundRect(d.p, DEV_W, DEV_H, 0.006), width: 1.05, bright: 1.15, white: 0.15, start: T(pop - 2), dur: 2, flash });
    // luminous card body
    wing.push({
      pts: [new THREE.Vector2(d.p.x - DEV_W * 0.38, d.p.y), new THREE.Vector2(d.p.x + DEV_W * 0.38, d.p.y)],
      width: (DEV_H * 0.42) / 0.0011, bright: 0.08, white: 0, start: T(pop - 2), dur: 2, flash, fill: true,
    });
    // document glyph: white text lines
    for (let k = 0; k < 4; k++) {
      const y = d.p.y + DEV_H * (0.26 - k * 0.16);
      const w = DEV_W * (k === 3 ? 0.32 : k === 1 ? 0.5 : 0.62);
      wing.push({
        pts: [new THREE.Vector2(d.p.x - DEV_W * 0.3, y), new THREE.Vector2(d.p.x - DEV_W * 0.3 + w, y)],
        width: 0.75, bright: 1.0, white: 0.85, start: T(pop - 2), dur: 2, flash,
      });
    }
  });
  // mirror the wing → perfectly symmetrical emblem
  for (const st of wing) {
    S.push(st);
    const m = (v: THREE.Vector2) => new THREE.Vector2(2 * HUB.x - v.x, v.y);
    S.push({ ...st, pts: st.pts.map(m), flash: st.flash ? { ...st.flash, center: m(st.flash.center) } : undefined });
  }
  return S;
};

const STROKE_VERT = /* glsl */ `
attribute vec4 aAcross; // x: -1..1 across, y: core half-width multiplier, z: whiteness, w: fill
attribute vec2 aSeg;    // x: position along this segment (extends past both ends), y: segment length
attribute vec4 aAlong;  // x: arc length, y: total length, z: start frame, w: duration
attribute vec4 aPulse;  // x: k, y: phase, z: has pulse, w: brightness
attribute vec4 aFlash;  // x: k, y: phase, z: pop frame, w: is device
attribute vec4 aCenter; // xy: pop/tooth centre, z: ring-rotating, w: is tooth
uniform float frame; uniform float loopT; uniform float ringRot; uniform vec2 hub; uniform float halfW;
varying vec4 vAcross; varying vec4 vAlong; varying vec4 vPulse; varying vec4 vFlash; varying float vScale; varying vec2 vSeg;
void main() {
  vec2 p = position.xy;
  float sc = 1.0;
  if (aFlash.w > 0.5) {
    float t = (frame - aFlash.z) / 9.0;
    float x = clamp(t, 0.0, 1.0) - 1.0;
    sc = t <= 0.0 ? 0.0 : 1.0 + 2.70158 * x * x * x + 1.70158 * x * x;
    p = aCenter.xy + (p - aCenter.xy) * sc;
  }
  if (aCenter.w > 0.5) {
    float t = clamp((frame - aAlong.z) / aAlong.w, 0.0, 1.0);
    float x = t - 1.0;
    float s2 = 1.0 + 2.70158 * x * x * x + 1.70158 * x * x;
    p = aCenter.xy + (p - aCenter.xy) * s2;
    sc = t;
  }
  if (aCenter.z > 0.5) {
    vec2 d = p - hub;
    float c = cos(ringRot), s = sin(ringRot);
    p = hub + vec2(c * d.x - s * d.y, s * d.x + c * d.y);
  }
  vAcross = aAcross; vAlong = aAlong; vPulse = aPulse; vFlash = aFlash; vScale = sc; vSeg = aSeg;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 0.0, 1.0);
}
`;

const STROKE_FRAG = /* glsl */ `
uniform float frame; uniform float loopT; uniform float halfW; uniform float coreW; uniform float glowW;
uniform vec3 cGlow; uniform vec3 cCore; uniform vec3 cBead; uniform vec3 cWire; uniform float pulseOn;
varying vec4 vAcross; varying vec4 vAlong; varying vec4 vPulse; varying vec4 vFlash; varying float vScale; varying vec2 vSeg;
float hash(float n) { return fract(sin(n) * 43758.5453123); }
void main() {
  // draw-on: reveal along the arc length
  float du = vSeg.x - clamp(vSeg.x, 0.0, vSeg.y);   // distance beyond the segment ends
  float alongPos = vAlong.x - du;
  float prog = clamp((frame - vAlong.z) / vAlong.w, 0.0, 1.0);
  float head = prog * vAlong.y;
  float vis = smoothstep(head + 0.002, head - 0.002, alongPos) * step(0.0001, prog);
  if (vFlash.w > 0.5) vis = step(0.001, vScale);
  if (vis <= 0.0) discard;
  // true distance to the segment (round caps); fills keep square ends
  float d = vAcross.w > 0.5 ? abs(vAcross.x) * halfW : length(vec2(du, vAcross.x * halfW));
  if (vAcross.w > 0.5 && du != 0.0) discard;
  float cw = coreW * vAcross.y;
  float aa = fwidth(d) + 1e-6;
  float core = clamp((cw - d) / aa + 0.5, 0.0, 1.0);
  core = max(core, clamp(cw / aa, 0.0, 1.0) * exp(-d * d / (aa * aa))); // sub-pixel lines keep their energy
  float glow = vAcross.w > 0.5 ? core : exp(-d * d / (glowW * glowW * vAcross.y)) * 0.55 + exp(-d / (glowW * 2.6)) * 0.12;
  float b = vPulse.w;
  // pulses: beads travelling hub → device, whole trips per loop
  float bead = 0.0;
  if (vPulse.z > 0.5 && pulseOn > 0.0) {
    float s = alongPos / vAlong.y;
    float on = pulseOn * clamp(prog * 2.0 - 1.0, 0.0, 1.0);
    for (int i = 0; i < 2; i++) {
      float u = fract(vPulse.x * loopT + vPulse.y + float(i) * 0.5);
      float dd = (s - u) * vAlong.y / 0.016;
      bead += exp(-dd * dd) * on;
      bead += ((s < u) ? exp(-(u - s) * vAlong.y / 0.035) * 0.35 : 0.0) * on;
    }
  }
  // device flash when a bead arrives + a light step-schedule flicker
  float flash = 0.0;
  if (vFlash.w > 0.5) {
    float a = fract(vFlash.x * loopT + vFlash.y);   // 0 right at arrival
    float since = a / vFlash.x * 600.0;               // frames since arrival
    flash = exp(-since / 7.0) * 1.2 * pulseOn;
    float popF = frame - vFlash.z;
    flash += exp(-max(popF, 0.0) / 6.0) * step(0.0, popF) * 1.5;
    float step4 = floor(mod(frame, 600.0) / 4.0);
    flash += (hash(step4 * 7.13 + vFlash.y * 91.7) - 0.5) * 0.18;
  }
  float br = b * (1.0 + flash) * vis;
  vec3 glowC = vAcross.y < 0.6 ? cWire : cGlow; // wires lean teal-cyan
  vec3 coreC = mix(glowC, cCore, vAcross.z);
  vec3 col = (vAcross.w > 0.5 ? cGlow * core : coreC * core * 0.95 + glowC * glow * 0.6) * br;
  col += (cBead * core * 1.8 + cBead * exp(-d * d / (glowW * glowW * 1.5)) * 0.7) * bead * vis;
  gl_FragColor = vec4(col, 1.0);
}
`;

const HAZE_FRAG = /* glsl */ `
uniform vec2 res; uniform vec2 hubUv; uniform vec3 cHaze;
varying vec2 vUv;
void main() {
  vec2 d = (vUv - hubUv) * vec2(res.x / res.y, 1.0);
  float r = length(d);
  gl_FragColor = vec4(cHaze * (exp(-r * r / 0.03) * 0.004 + exp(-r * r / 0.25) * 0.001), 1.0);
}
`;

const buildGeometry = (strokes: Stroke[], halfW: number) => {
  // One independent quad per polyline segment (extended by halfW at both ends); the fragment
  // shader measures the true distance to the segment (round caps), so sharp corners never fold.
  const pos: number[] = [];
  const across: number[] = [];
  const along: number[] = [];
  const seg: number[] = [];
  const pulse: number[] = [];
  const flash: number[] = [];
  const center: number[] = [];
  const idx: number[] = [];
  let base = 0;
  for (const s of strokes) {
    const n = s.pts.length;
    let L = 0;
    const cum = [0];
    for (let i = 1; i < n; i++) cum.push((L += s.pts[i].distanceTo(s.pts[i - 1])));
    const total = Math.max(L, 1e-4);
    for (let i = 0; i < n - 1; i++) {
      const a = s.pts[i];
      const b = s.pts[i + 1];
      const len = a.distanceTo(b);
      if (len < 1e-7) continue;
      const t = new THREE.Vector2().subVectors(b, a).normalize();
      const nrm = new THREE.Vector2(-t.y, t.x);
      for (const u of [-halfW, len + halfW])
        for (const side of [-1, 1]) {
          const p = a.clone().addScaledVector(t, u).addScaledVector(nrm, side * halfW);
          pos.push(p.x, p.y, 0);
          across.push(side, s.width, s.white ?? 1, s.fill ? 1 : 0);
          along.push(cum[i] + u, total, s.start, s.dur);
          seg.push(u, len);
          pulse.push(s.pulse?.k ?? 0, s.pulse?.phase ?? 0, s.pulse ? 1 : 0, s.bright);
          flash.push(s.flash?.k ?? 1, s.flash?.phase ?? 0, s.flash?.pop ?? -1000, s.flash ? 1 : 0);
          const c = s.flash?.center ?? s.teeth ?? HUB;
          center.push(c.x, c.y, s.ring ?? 0, s.teeth ? 1 : 0);
        }
      idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      base += 4;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aAcross", new THREE.Float32BufferAttribute(across, 4));
  g.setAttribute("aAlong", new THREE.Float32BufferAttribute(along, 4));
  g.setAttribute("aSeg", new THREE.Float32BufferAttribute(seg, 2));
  g.setAttribute("aPulse", new THREE.Float32BufferAttribute(pulse, 4));
  g.setAttribute("aFlash", new THREE.Float32BufferAttribute(flash, 4));
  g.setAttribute("aCenter", new THREE.Float32BufferAttribute(center, 4));
  g.setIndex(idx);
  return g;
};

export const createNetworkHub = (mode: HubMode) => (): Look => {
  const LOOPLEN = mode === "pulseLoop" ? 600 : 450;
  const pipe = new Pipeline(4);
  const scene = new THREE.Scene();
  const aspect = 16 / 9;
  const camera = new THREE.OrthographicCamera(-aspect / 2, aspect / 2, 0.5, -0.5, -1, 1);
  const halfW = 0.03;
  const strokes = buildStrokes(mode);

  const haze = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: HAZE_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        res: { value: new THREE.Vector2(16, 9) },
        hubUv: { value: new THREE.Vector2(0.5 + HUB.x / aspect, 0.5 + HUB.y) },
        cHaze: { value: new THREE.Color("#3A8AFF") },
      },
    }),
  );
  haze.frustumCulled = false;
  haze.renderOrder = -1;
  scene.add(haze);

  const mat = new THREE.ShaderMaterial({
    vertexShader: STROKE_VERT,
    fragmentShader: STROKE_FRAG,
    transparent: true,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
    // MAX blending: overlapping ribbons (corners, crossings) never stack into hot spots
    blending: THREE.CustomBlending,
    blendEquation: THREE.MaxEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    uniforms: {
      frame: { value: 0 },
      loopT: { value: 0 },
      ringRot: { value: 0 },
      hub: { value: HUB.clone() },
      halfW: { value: halfW },
      coreW: { value: 0.0011 },
      glowW: { value: 0.0042 },
      cGlow: { value: new THREE.Color("#3A8AFF") },
      cCore: { value: new THREE.Color("#BFE0FF") },
      cBead: { value: new THREE.Color("#8AFFE0") },
      cWire: { value: new THREE.Color("#2AB4F0") },
      pulseOn: { value: 1 },
    },
  });
  const mesh = new THREE.Mesh(buildGeometry(strokes, halfW), mat);
  mesh.frustumCulled = false;
  scene.add(mesh);
  const clear = new THREE.Color(0, 0, 0);

  return {
    render(gl, frame) {
      const f = ((frame % LOOPLEN) + LOOPLEN) % LOOPLEN;
      const u = mat.uniforms;
      if (mode === "pulseLoop") {
        u.frame.value = f;
        u.loopT.value = f / 600;
        u.ringRot.value = (-TAU / 12) * (f / 600); // one notch period per loop
        u.pulseOn.value = 1;
      } else {
        u.frame.value = f;
        u.loopT.value = f / 600;
        u.ringRot.value = (-TAU / 12) * (f / 600);
        // pulses fade in once the wings have grown
        u.pulseOn.value = Math.min(1, Math.max(0, (f - 190) / 40));
      }
      pipe.begin(gl, clear);
      (haze.material as THREE.ShaderMaterial).uniforms.res.value.set(pipe.w, pipe.h);
      gl.render(scene, camera);
      pipe.finish(gl, {
        bloom: { strength: 0.6, threshold: 0.1, knee: 0.2, levels: 6, falloff: 0.55 },
        final: { frame: f, period: LOOPLEN, grain: 0.015, grainLumaCut: 0.03, vignette: 0.0 },
      });
    },
    dispose() {
      pipe.dispose();
    },
  };
};
