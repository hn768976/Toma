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
const R = 0.09; // ring radius (≈9% of frame height)
const DEV_W = 0.046;
const DEV_H = 0.056;

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

// Left wing as chains running outward from the hub (reference-like pixel space 768×432, hub at 384,140);
// the right wing is the exact mirror. 13 devices per side.
const LEFT_CHAINS: [number, number][][] = [
  [[258, 142], [183, 121], [124, 106]],
  [[196, 186], [128, 180], [62, 166]],
  [[244, 240], [186, 230], [92, 228]],
  [[318, 262], [256, 302], [190, 298], [154, 344]],
];
const toWorld = ([x, y]: [number, number]) => new THREE.Vector2((x - 384) / 432, (140 - y) / 432 + HUB.y);

const buildStrokes = (mode: HubMode): Stroke[] => {
  const rnd = mulberry32(0x1f2e3d4c);
  const story = mode === "drawOn";
  const S: Stroke[] = [];
  const T = (s: number) => (story ? s : -1000);

  // ---- hub ring (0–2s) ----
  S.push({ pts: arc(HUB, R, Math.PI / 2, Math.PI / 2 + TAU, 128), width: 3.4, bright: 1.15, white: 0.75, start: T(4), dur: 40 });
  S.push({ pts: arc(HUB, R * 0.8, -Math.PI / 2, -Math.PI / 2 + TAU, 112), width: 0.9, bright: 0.8, start: T(14), dur: 36 });
  // notched outer rim: 12 teeth (rotates with the ring)
  for (let i = 0; i < 12; i++) {
    const a0 = (i / 12) * TAU + 0.05;
    const a1 = a0 + TAU / 12 - 0.12;
    const c = new THREE.Vector2(HUB.x + Math.cos((a0 + a1) / 2) * R * 1.2, HUB.y + Math.sin((a0 + a1) / 2) * R * 1.2);
    // each tooth is a closed arc-band outline (gear segment)
    const r1 = R * 1.13;
    const r2 = R * 1.3 + (i % 3 === 0 ? 0.006 : 0);
    const pts = [...arc(HUB, r1, a0, a1, 12), ...arc(HUB, r2, a1, a0, 12)];
    pts.push(pts[0].clone());
    S.push({ pts, width: 1.0, bright: 0.9, white: 0.5, start: T(44 + i * 1.5), dur: 8, ring: 1, teeth: c });
  }
  // short horizontal bar with small dots under the hub (mirrored pairs)
  const barY = HUB.y - R * 0.38;
  for (const sgn of [-1, 1]) {
    S.push({
      pts: [new THREE.Vector2(HUB.x + sgn * R * 1.32, barY), new THREE.Vector2(HUB.x + sgn * R * 2.9, barY)],
      width: 1.0, bright: 0.9, start: T(50), dur: 10,
    });
    S.push({
      pts: [new THREE.Vector2(HUB.x + sgn * R * 0.95, barY - 0.032), new THREE.Vector2(HUB.x + sgn * R * 2.1, barY - 0.032)],
      width: 0.8, bright: 0.7, start: T(54), dur: 10,
    });
    for (const dx of [1.32, 2.0]) {
      const c = new THREE.Vector2(HUB.x + sgn * R * dx, barY - (dx > 1.5 ? 0.032 : 0));
      S.push({ pts: roundRect(c, 0.012, 0.012, 0.002), width: 0.9, bright: 1.1, start: T(56), dur: 6 });
    }
  }

  // ---- devices + wires (left wing, then mirrored) ----
  type Dev = { p: THREE.Vector2; tier: 1 | 2 | 3 | 4; i: number; parent: THREE.Vector2 | null };
  const devs: Dev[] = [];
  let di = 0;
  LEFT_CHAINS.forEach((chain, ci) => {
    let prev: THREE.Vector2 | null = ci === 1 ? toWorld(LEFT_CHAINS[0][0]) : null;
    chain.forEach((px, k) => {
      const p = toWorld(px);
      devs.push({ p, tier: (k + (ci === 1 ? 2 : 1)) as Dev["tier"], i: di++, parent: prev });
      prev = p;
    });
  });
  const tierStart = { 1: 62, 2: 100, 3: 138, 4: 172 };
  const wing: Stroke[] = [];
  for (const d of devs) {
    let from: THREE.Vector2;
    if (!d.parent) {
      // port on the left half of the ring
      const ang = Math.PI + Math.atan2(HUB.y - d.p.y, HUB.x - d.p.x) * 0.6;
      from = new THREE.Vector2(HUB.x + Math.cos(ang) * R * 1.3, HUB.y + Math.sin(ang) * R * 1.3);
    } else {
      from = new THREE.Vector2(d.parent.x - DEV_W * 0.55, d.parent.y + (rnd() - 0.5) * DEV_H * 0.4);
    }
    const to = new THREE.Vector2(d.p.x + DEV_W * 0.55, d.p.y + (rnd() - 0.5) * DEV_H * 0.3);
    const dx = to.x - from.x;
    const wob = (rnd() - 0.5) * 0.03;
    const pts = bezier(
      from,
      new THREE.Vector2(from.x + dx * (0.35 + rnd() * 0.2), from.y + wob),
      new THREE.Vector2(to.x - dx * (0.35 + rnd() * 0.2), to.y - wob),
      to,
    );
    const len = pts.reduce((s, p, i) => (i ? s + p.distanceTo(pts[i - 1]) : 0), 0);
    const wStart = tierStart[d.tier] + rnd() * 12;
    const wDur = Math.round(16 + len * 60);
    const pulse = { k: 2 + Math.floor(rnd() * 3), phase: rnd() };
    wing.push({ pts, width: 0.55, bright: 0.7, white: 0.35, start: T(wStart), dur: wDur, pulse });
    // a second, fainter parallel wire on some links (like the reference's doubled traces)
    if (rnd() < 0.45) {
      const off = pts.map((p) => new THREE.Vector2(p.x, p.y - 0.006));
      wing.push({ pts: off, width: 0.45, bright: 0.4, white: 0.2, start: T(wStart + 4), dur: wDur, pulse: { k: pulse.k, phase: (pulse.phase + 0.5) % 1 } });
    }
    const pop = wStart + wDur;
    const flash = { k: pulse.k, phase: pulse.phase, pop: story ? pop : -1000, center: d.p.clone() };
    wing.push({ pts: roundRect(d.p, DEV_W, DEV_H, 0.006), width: 1.1, bright: 1.0, white: 0.6, start: T(pop - 2), dur: 2, flash });
    // soft blue fill of the device body
    wing.push({
      pts: [new THREE.Vector2(d.p.x - DEV_W * 0.36, d.p.y), new THREE.Vector2(d.p.x + DEV_W * 0.36, d.p.y)],
      width: (DEV_H * 0.4) / 0.0011, bright: 0.07, white: 0, start: T(pop - 2), dur: 2, flash, fill: true,
    });
    // inner glyph: document lines / screen / phone
    const g = d.i % 3;
    if (g === 0) {
      for (let k = 0; k < 3; k++) {
        const y = d.p.y + DEV_H * (0.22 - k * 0.18);
        const w = DEV_W * (k === 2 ? 0.35 : 0.6);
        wing.push({
          pts: [new THREE.Vector2(d.p.x - DEV_W * 0.3, y), new THREE.Vector2(d.p.x - DEV_W * 0.3 + w, y)],
          width: 0.7, bright: 0.9, start: T(pop - 2), dur: 2, flash,
        });
      }
    } else if (g === 1) {
      wing.push({ pts: roundRect(new THREE.Vector2(d.p.x, d.p.y + DEV_H * 0.08), DEV_W * 0.6, DEV_H * 0.42, 0.002), width: 0.7, bright: 0.9, start: T(pop - 2), dur: 2, flash });
      wing.push({
        pts: [new THREE.Vector2(d.p.x - DEV_W * 0.2, d.p.y - DEV_H * 0.28), new THREE.Vector2(d.p.x + DEV_W * 0.2, d.p.y - DEV_H * 0.28)],
        width: 0.7, bright: 0.9, start: T(pop - 2), dur: 2, flash,
      });
    } else {
      wing.push({ pts: roundRect(new THREE.Vector2(d.p.x - DEV_W * 0.12, d.p.y), DEV_W * 0.34, DEV_H * 0.6, 0.004), width: 0.7, bright: 0.9, start: T(pop - 2), dur: 2, flash });
      wing.push({
        pts: [new THREE.Vector2(d.p.x + DEV_W * 0.12, d.p.y + DEV_H * 0.12), new THREE.Vector2(d.p.x + DEV_W * 0.3, d.p.y + DEV_H * 0.12)],
        width: 0.7, bright: 0.9, start: T(pop - 2), dur: 2, flash,
      });
    }
  }
  // mirror the wing → perfectly symmetrical emblem
  for (const s of wing) {
    S.push(s);
    const m = (v: THREE.Vector2) => new THREE.Vector2(2 * HUB.x - v.x, v.y);
    S.push({
      ...s,
      pts: s.pts.map(m),
      flash: s.flash ? { ...s.flash, center: m(s.flash.center) } : undefined,
    });
  }
  return S;
};

const STROKE_VERT = /* glsl */ `
attribute vec4 aAcross; // x: -1..1 across, y: core half-width multiplier, z: whiteness, w: fill
attribute vec4 aAlong;  // x: arc length, y: total length, z: start frame, w: duration
attribute vec4 aPulse;  // x: k, y: phase, z: has pulse, w: brightness
attribute vec4 aFlash;  // x: k, y: phase, z: pop frame, w: is device
attribute vec4 aCenter; // xy: pop/tooth centre, z: ring-rotating, w: is tooth
uniform float frame; uniform float loopT; uniform float ringRot; uniform vec2 hub; uniform float halfW;
varying vec4 vAcross; varying vec4 vAlong; varying vec4 vPulse; varying vec4 vFlash; varying float vScale;
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
  vAcross = aAcross; vAlong = aAlong; vPulse = aPulse; vFlash = aFlash; vScale = sc;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 0.0, 1.0);
}
`;

const STROKE_FRAG = /* glsl */ `
uniform float frame; uniform float loopT; uniform float halfW; uniform float coreW; uniform float glowW;
uniform vec3 cGlow; uniform vec3 cCore; uniform vec3 cBead; uniform float pulseOn;
varying vec4 vAcross; varying vec4 vAlong; varying vec4 vPulse; varying vec4 vFlash; varying float vScale;
float hash(float n) { return fract(sin(n) * 43758.5453123); }
void main() {
  // draw-on: reveal along the arc length
  float prog = clamp((frame - vAlong.z) / vAlong.w, 0.0, 1.0);
  float head = prog * vAlong.y;
  float vis = smoothstep(head + 0.002, head - 0.002, vAlong.x) * step(0.0001, prog);
  if (vFlash.w > 0.5) vis = step(0.001, vScale);
  if (vis <= 0.0) discard;
  float d = abs(vAcross.x) * halfW;           // world distance from the centre line
  float cw = coreW * vAcross.y;
  float aa = fwidth(d) + 1e-6;
  float core = clamp((cw - d) / aa + 0.5, 0.0, 1.0);
  core = max(core, clamp(cw / aa, 0.0, 1.0) * exp(-d * d / (aa * aa))); // sub-pixel lines keep their energy
  float glow = vAcross.w > 0.5 ? core : exp(-d * d / (glowW * glowW * vAcross.y)) * 0.55 + exp(-d / (glowW * 2.6)) * 0.12;
  float b = vPulse.w;
  // pulses: beads travelling hub → device, whole trips per loop
  float bead = 0.0;
  if (vPulse.z > 0.5 && pulseOn > 0.0) {
    float u = fract(vPulse.x * loopT + vPulse.y);
    float s = vAlong.x / vAlong.y;
    float dd = (s - u) * vAlong.y / 0.022;
    bead = exp(-dd * dd) * pulseOn * clamp(prog * 2.0 - 1.0, 0.0, 1.0);
    // a soft comet tail behind the bead
    float tail = (s < u) ? exp(-(u - s) * vAlong.y / 0.04) * 0.25 : 0.0;
    bead += tail * pulseOn * clamp(prog * 2.0 - 1.0, 0.0, 1.0);
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
  vec3 coreC = mix(cGlow, cCore, vAcross.z);
  vec3 col = (vAcross.w > 0.5 ? cGlow * core : coreC * core * 0.95 + cGlow * glow * 0.6) * br;
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
  gl_FragColor = vec4(cHaze * (exp(-r * r / 0.03) * 0.010 + exp(-r * r / 0.25) * 0.0025), 1.0);
}
`;

const buildGeometry = (strokes: Stroke[], halfW: number) => {
  const pos: number[] = [];
  const across: number[] = [];
  const along: number[] = [];
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
    for (let i = 0; i < n; i++) {
      const a = s.pts[Math.max(0, i - 1)];
      const b = s.pts[Math.min(n - 1, i + 1)];
      const t = new THREE.Vector2().subVectors(b, a).normalize();
      const nrm = new THREE.Vector2(-t.y, t.x);
      for (const side of [-1, 1]) {
        const p = s.pts[i].clone().addScaledVector(nrm, side * halfW);
        pos.push(p.x, p.y, 0);
        across.push(side, s.width, s.white ?? 1, s.fill ? 1 : 0);
        along.push(cum[i], total, s.start, s.dur);
        pulse.push(s.pulse?.k ?? 0, s.pulse?.phase ?? 0, s.pulse ? 1 : 0, s.bright);
        flash.push(s.flash?.k ?? 1, s.flash?.phase ?? 0, s.flash?.pop ?? -1000, s.flash ? 1 : 0);
        const c = s.flash?.center ?? s.teeth ?? HUB;
        center.push(c.x, c.y, s.ring ?? 0, s.teeth ? 1 : 0);
      }
      if (i < n - 1) {
        const v = base + i * 2;
        idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
      }
    }
    base += n * 2;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aAcross", new THREE.Float32BufferAttribute(across, 4));
  g.setAttribute("aAlong", new THREE.Float32BufferAttribute(along, 4));
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
      cBead: { value: new THREE.Color("#9AF0FF") },
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
