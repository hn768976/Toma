import React from "react";
import * as THREE from "three";
import { GLStage, World } from "../../lib/GLStage";
import { Post } from "../../lib/post";
import { lin } from "../../lib/random";
import type { CircuitVersion } from "../../versions";
import { BOARD, CHIP, PIN_N, PITCH, TRACE_H, TRACE_W } from "./board";

/*
 * Circuit Chip (15 s story, 450 frames). Everything is a function of
 * t = frame / 30: camera path, focus distance, pulse positions, flare.
 */

export const CIRCUIT_FRAMES = 450;
const FPS = 30;

const COMMON = /* glsl */ `
uniform float uTime;
uniform float uFocus;
uniform float uAper;
uniform float uMaxCoc;
uniform float uFogD;
uniform float uFlare;     // chip edge flare 0..1+
uniform float uConverge;  // 0..1 during the converge phase
uniform vec3 uBoard;
uniform vec3 uTrace;
uniform vec3 uPulse;
uniform vec3 uCore;
uniform vec3 uHaze;
uniform vec3 uCamPos;
const vec3 LIGHT = vec3(0.0, 0.42, -0.91);
float cocA(float d) { return clamp(uAper * abs(d - uFocus) / max(d, 0.05) / uMaxCoc, 0.0, 1.0); }
vec3 fogMix(vec3 c, float d) {
  float f = 1.0 - exp(-max(d - 2.0, 0.0) * uFogD);
  return mix(c, uHaze, f);
}
float hh(float x) { return fract(sin(x * 91.3458 + 17.17) * 47453.5453); }
`;

const VERT = /* glsl */ `
${COMMON}
in float aAlong;
in vec4 aLane;   // seed, length, kind, unused
in vec2 aPad;    // pad radial 0..1 (or -1 for trace), via flag
out vec3 vN;
out vec3 vW;
out float vD;
out float vAlong;
out vec4 vLane;
out vec2 vPad;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 mv = viewMatrix * wp;
  vD = -mv.z;
  vAlong = aAlong;
  vLane = aLane;
  vPad = aPad;
  gl_Position = projectionMatrix * mv;
}`;

// traces and pads
const TRACE_FRAG = /* glsl */ `
precision highp float;
${COMMON}
in vec3 vN;
in vec3 vW;
in float vD;
in float vAlong;
in vec4 vLane;
in vec2 vPad;
out vec4 outColor;

float pulseTrain(float s, float seed, float t, float boost) {
  float speed = mix(1.4, 4.0, hh(seed * 3.1)) * (1.0 + 0.7 * boost);
  float period = mix(2.5, 8.0, hh(seed * 5.7)) * (1.0 - 0.45 * boost);
  float density = mix(0.35, 0.95, boost);
  float ph = t * speed + seed * 97.0;
  float q = (ph - s) / period;
  float idx = floor(q);
  float x = (q - idx) * period;              // distance behind the head
  float aliveT = step(hh(idx * 1.37 + seed * 17.0), density);
  float aliveF = step(hh((idx + 1.0) * 1.37 + seed * 17.0), density);
  float tail = mix(0.35, 1.1, hh(seed * 9.1));
  float I = aliveT * exp(-x / tail) + aliveF * exp(-(period - x) / 0.06);
  return I;
}

void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(uCamPos - vW);
  float seed = vLane.x;
  float kind = vLane.z;
  float diff = max(dot(N, LIGHT), 0.0);
  vec3 R = reflect(-V, N);
  float spec = pow(max(dot(R, LIGHT), 0.0), 18.0);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
  float laneVar = 0.5 + 0.9 * hh(seed * 13.7);
  float edgeF = 1.0 - N.y;
  // outline look: darker core on top, bright bevelled edges
  vec3 col = uTrace * (0.25 + 0.45 * diff) * laneVar + uPulse * (spec * 0.4 + fres * 0.12)
           + (uTrace * 1.8 + uPulse * 0.35) * edgeF * laneVar;
  // some traces glow softly all over
  col += uPulse * kind * 0.5;

  // pulses toward the chip
  float I = pulseTrain(vAlong, seed, uTime, uConverge);
  // converge: rings of light running toward the chip
  float rho = length(vW.xz);
  for (int k = 0; k < 3; k++) {
    float tk = 12.1 + float(k) * 0.35;
    float wf = (tk - uTime) * 7.0;
    float amp = smoothstep(9.8, 11.0, uTime) * (1.0 - smoothstep(12.6, 13.6, uTime));
    I += amp * 1.1 * exp(-pow((rho - wf) / 0.3, 2.0)) * (1.0 - smoothstep(4.0, 7.0, rho)) * step(0.25, hh(seed * 3.3 + float(k)));
  }
  // pads: a via is a ring with a dark hole
  if (vPad.x >= 0.0) {
    if (vPad.y > 0.5 && vPad.x < 0.5) { col = uBoard * 0.4; I *= 0.3; }
    else col *= 1.25;
  }
  col += uPulse * I * 2.2 + uCore * pow(min(I, 2.0), 3.0) * 0.9;
  // the near foreground stays darker than the mid-ground
  col *= mix(0.45, 1.0, smoothstep(1.2, 3.5, vD));
  // close to the chip, the traces brighten with the flare
  col += uPulse * uFlare * 0.6 * exp(-max(rho - 1.8, 0.0) / 0.9);
  col = fogMix(col, vD);
  outColor = vec4(col, cocA(vD));
}`;

const BOARD_FRAG = /* glsl */ `
precision highp float;
${COMMON}
in vec3 vN;
in vec3 vW;
in float vD;
out vec4 outColor;
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float a = hh(i.x + i.y * 57.0), b = hh(i.x + 1.0 + i.y * 57.0);
  float c = hh(i.x + (i.y + 1.0) * 57.0), d = hh(i.x + 1.0 + (i.y + 1.0) * 57.0);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
void main() {
  vec3 V = normalize(uCamPos - vW);
  float n = vnoise(vW.xz * 0.6) * 0.6 + vnoise(vW.xz * 2.3) * 0.4;
  vec3 col = uBoard * (0.6 + 0.5 * n);
  vec2 g = abs(fract(vW.xz / 0.2) - 0.5) * 0.2;
  float fw = max(fwidth(vW.x), fwidth(vW.z));
  float dotm = (1.0 - smoothstep(0.012 - fw, 0.012 + fw, length(g))) * (1.0 - smoothstep(0.01, 0.03, fw));
  col += uTrace * dotm * 0.5;
  col *= mix(0.5, 1.0, smoothstep(1.2, 3.5, vD));
  // glossy solder mask: sheen toward the horizon
  float fres = pow(1.0 - max(V.y, 0.0), 5.0);
  col += uHaze * fres * 0.6;
  vec3 R = reflect(-V, vec3(0.0, 1.0, 0.0));
  col += uPulse * pow(max(dot(R, LIGHT), 0.0), 40.0) * 0.08;
  float rho = length(vW.xz);
  col += uPulse * uFlare * 0.5 * exp(-max(rho - 1.6, 0.0) / 1.2);
  col = fogMix(col, vD);
  outColor = vec4(col, cocA(vD));
}`;

// chip package, die lid, metal edge, pins, components (material id in aPad.y)
const SOLID_FRAG = /* glsl */ `
precision highp float;
${COMMON}
in vec3 vN;
in vec3 vW;
in float vD;
in vec4 vLane;   // x: material, y: local u, z: local v
out vec4 outColor;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(uCamPos - vW);
  vec3 R = reflect(-V, N);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  float spec = pow(max(dot(R, LIGHT), 0.0), 60.0);
  float diff = max(dot(N, LIGHT), 0.0);
  float m = vLane.x;
  vec3 col;
  if (m < 0.5) {
    // package top: very dark, glossy
    col = vec3(0.0016, 0.0021, 0.0037) + uHaze * fres * 0.5 + uPulse * spec * 0.5;
    col += uPulse * uFlare * 0.03 * max(N.y, 0.0);
  } else if (m < 1.5) {
    // thin bright metal edge
    col = mix(uTrace, vec3(0.8), 0.35) * (0.4 + 0.8 * diff) + uPulse * (0.6 + 1.2 * spec) + uPulse * fres;
    col += (uPulse * 2.4 + uCore * 0.5) * uFlare;
  } else if (m < 2.5) {
    // pins
    col = mix(uTrace, vec3(0.7), 0.3) * (0.4 + 0.8 * diff) + uPulse * spec * 0.8;
    col += (uPulse * 2.2 + uCore * 1.2) * uFlare;
  } else if (m < 3.5) {
    // substrate
    col = uBoard * 1.6 + uTrace * 0.12 * diff + uHaze * fres * 0.3;
    col += uPulse * uFlare * 0.25;
  } else if (m < 4.5) {
    // resistor: dark body with metal end caps
    float cap = step(0.32, abs(vLane.y));
    col = mix(uBoard * 2.0 + uTrace * 0.15 * diff, mix(uTrace, vec3(0.6), 0.3) * (0.3 + 0.6 * diff), cap);
    col += uPulse * fres * 0.25 + uPulse * spec * 0.4;
  } else if (m < 5.5) {
    // capacitor
    float cap = step(0.36, abs(vLane.y));
    col = mix(uTrace * 0.35 * (0.4 + 0.6 * diff), mix(uTrace, vec3(0.6), 0.3) * (0.3 + 0.6 * diff), cap);
    col += uPulse * fres * 0.25 + uPulse * spec * 0.4;
  } else {
    // small IC package
    col = vec3(0.004, 0.005, 0.008) + uHaze * fres * 0.4 + uPulse * spec * 0.35;
  }
  col = fogMix(col, vD);
  outColor = vec4(col, cocA(vD));
}`;

// ------------------------------------------------------------ geometry

type Buf = { pos: number[]; nrm: number[]; along: number[]; lane: number[]; pad: number[] };
const newBuf = (): Buf => ({ pos: [], nrm: [], along: [], lane: [], pad: [] });
const toGeom = (b: Buf) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(b.pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(b.nrm, 3));
  g.setAttribute("aAlong", new THREE.Float32BufferAttribute(b.along, 1));
  g.setAttribute("aLane", new THREE.Float32BufferAttribute(b.lane, 4));
  g.setAttribute("aPad", new THREE.Float32BufferAttribute(b.pad, 2));
  return g;
};

const offset = (pts: [number, number][], o: number): [number, number][] => {
  const out: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    let d0 = [p[0] - a[0], p[1] - a[1]];
    let d1 = [b[0] - p[0], b[1] - p[1]];
    if (i === 0) d0 = d1;
    if (i === pts.length - 1) d1 = d0;
    const l0 = Math.hypot(d0[0], d0[1]) || 1;
    const l1 = Math.hypot(d1[0], d1[1]) || 1;
    const n0 = [-d0[1] / l0, d0[0] / l0];
    const n1 = [-d1[1] / l1, d1[0] / l1];
    let m = [n0[0] + n1[0], n0[1] + n1[1]];
    const ml = Math.hypot(m[0], m[1]) || 1;
    m = [m[0] / ml, m[1] / ml];
    const k = o / Math.max(m[0] * n0[0] + m[1] * n0[1], 0.5);
    out.push([p[0] + m[0] * k, p[1] + m[1] * k]);
  }
  return out;
};

const buildTraces = () => {
  const b = newBuf();
  const hw = TRACE_W / 2;
  const tw = TRACE_W * 0.34;
  const H = TRACE_H;
  const quad = (
    p: number[][],
    n: number[],
    al: number[],
    lane: number[],
    pad: number[] = [-1, 0],
  ) => {
    // p: 4 corners (a0, a1, b1, b0) as 2 tris
    const idx = [0, 1, 2, 0, 2, 3];
    for (const i of idx) {
      b.pos.push(...p[i]);
      b.nrm.push(...n);
      b.along.push(al[i]);
      b.lane.push(...lane);
      b.pad.push(...pad);
    }
  };
  for (const l of BOARD.lanes) {
    const pts = l.pts;
    const acc = [0];
    for (let i = 1; i < pts.length; i++)
      acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const L = acc[acc.length - 1];
    const lane = [l.seed, L, l.kind, 0];
    const bl = offset(pts, -hw);
    const tl = offset(pts, -tw);
    const tr = offset(pts, tw);
    const br = offset(pts, hw);
    for (let i = 0; i < pts.length - 1; i++) {
      const dx = pts[i + 1][0] - pts[i][0];
      const dz = pts[i + 1][1] - pts[i][1];
      const dl = Math.hypot(dx, dz) || 1;
      const nx = -dz / dl;
      const nz = dx / dl; // left normal (toward -hw side is -n)
      const al = [acc[i], acc[i + 1], acc[i + 1], acc[i]];
      // top
      quad(
        [
          [tl[i][0], H, tl[i][1]],
          [tl[i + 1][0], H, tl[i + 1][1]],
          [tr[i + 1][0], H, tr[i + 1][1]],
          [tr[i][0], H, tr[i][1]],
        ],
        [0, 1, 0],
        al,
        lane,
      );
      const run = hw - tw;
      const sl = Math.hypot(run, H);
      // side at -n
      quad(
        [
          [bl[i][0], 0, bl[i][1]],
          [bl[i + 1][0], 0, bl[i + 1][1]],
          [tl[i + 1][0], H, tl[i + 1][1]],
          [tl[i][0], H, tl[i][1]],
        ],
        [(-nx * H) / sl, run / sl, (-nz * H) / sl],
        al,
        lane,
      );
      quad(
        [
          [tr[i][0], H, tr[i][1]],
          [tr[i + 1][0], H, tr[i + 1][1]],
          [br[i + 1][0], 0, br[i + 1][1]],
          [br[i][0], 0, br[i][1]],
        ],
        [(nx * H) / sl, run / sl, (nz * H) / sl],
        al,
        lane,
      );
    }
    // pads
    const pad = (p: [number, number], s: number, type: number) => {
      if (!type) return;
      const R = type === 2 ? PITCH * 0.6 : PITCH * 0.5;
      const seg = 14;
      const y = H * 1.15;
      for (let k = 0; k < seg; k++) {
        const a0 = (k / seg) * Math.PI * 2;
        const a1 = ((k + 1) / seg) * Math.PI * 2;
        const ring = (rr: number, a: number) => [p[0] + Math.cos(a) * rr, y, p[1] + Math.sin(a) * rr];
        // inner disc (radial 0..0.5) and outer ring (0.5..1)
        quad(
          [ring(0, a0), ring(R * 0.5, a0), ring(R * 0.5, a1), ring(0, a1)],
          [0, 1, 0],
          [s, s, s, s],
          lane,
          [0.25, type === 2 ? 1 : 0],
        );
        quad(
          [ring(R * 0.5, a0), ring(R, a0), ring(R, a1), ring(R * 0.5, a1)],
          [0, 1, 0],
          [s, s, s, s],
          lane,
          [0.75, type === 2 ? 1 : 0],
        );
      }
    };
    pad(pts[0], 0, l.padStart);
    pad(pts[pts.length - 1], L, l.padEnd);
  }
  return toGeom(b);
};

// boxes with a material id (stored in aLane.x) and local u along x (aLane.y)
const buildSolids = () => {
  const b = newBuf();
  const box = (cx: number, cy: number, cz: number, w: number, h: number, d: number, mat: number, uAlongZ = false) => {
    const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
    g.translate(cx, cy, cz);
    const p = g.getAttribute("position");
    const n = g.getAttribute("normal");
    for (let i = 0; i < p.count; i++) {
      b.pos.push(p.getX(i), p.getY(i), p.getZ(i));
      b.nrm.push(n.getX(i), n.getY(i), n.getZ(i));
      b.along.push(0);
      const lu = uAlongZ ? (p.getZ(i) - cz) / d : (p.getX(i) - cx) / w;
      b.lane.push(mat, lu, 0, 0);
      b.pad.push(-1, 0);
    }
    g.dispose();
  };
  const S = CHIP;
  // substrate
  box(0, 0.025, 0, S + 0.55, 0.05, S + 0.55, 3);
  // package body (top material) with a metal edge frame around the top
  const ph = 0.24;
  box(0, 0.05 + ph / 2, 0, S - 0.08, ph, S - 0.08, 0);
  const e = 0.05;
  const ry = 0.05 + ph - 0.006;
  box(0, ry, (S - e) / 2, S, 0.024, e, 1);
  box(0, ry, -(S - e) / 2, S, 0.024, e, 1);
  box((S - e) / 2, ry, 0, e, 0.024, S - 2 * e, 1);
  box(-(S - e) / 2, ry, 0, e, 0.024, S - 2 * e, 1);
  // raised die lid with its own thin bright rim
  const L = 1.55;
  box(0, 0.05 + ph + 0.02, 0, L, 0.04, L, 0);
  const re = 0.02;
  box(0, 0.05 + ph + 0.02, (L + re) / 2, L + 2 * re, 0.042, re, 1);
  box(0, 0.05 + ph + 0.02, -(L + re) / 2, L + 2 * re, 0.042, re, 1);
  box((L + re) / 2, 0.05 + ph + 0.02, 0, re, 0.042, L, 1);
  box(-(L + re) / 2, 0.05 + ph + 0.02, 0, re, 0.042, L, 1);
  // pins: rows of short leads on all four sides, meeting the fan-out traces
  for (let side = 0; side < 4; side++) {
    for (let i = 0; i < PIN_N; i++) {
      const o = (i - (PIN_N - 1) / 2) * PITCH;
      const len = 0.36;
      const c = S / 2 + 0.3 - len / 2 + 0.02;
      if (side === 0) box(o, 0.035, c, PITCH * 0.45, 0.03, len, 2);
      if (side === 2) box(o, 0.035, -c, PITCH * 0.45, 0.03, len, 2);
      if (side === 1) box(c, 0.035, o, len, 0.03, PITCH * 0.45, 2);
      if (side === 3) box(-c, 0.035, o, len, 0.03, PITCH * 0.45, 2);
    }
  }
  // components
  for (const c of BOARD.comps) {
    const mat = c.type === 0 ? 4 : c.type === 1 ? 5 : 6;
    box(c.x, c.h / 2, c.z, c.w, c.h, c.d, mat, c.d > c.w);
    if (c.type === 2) {
      // short pins along the long sides
      const along = c.w > c.d;
      const n = Math.max(3, Math.floor((along ? c.w : c.d) / 0.1));
      for (let i = 0; i < n; i++) {
        const o = (i - (n - 1) / 2) * 0.1;
        for (const s of [-1, 1]) {
          if (along) box(c.x + o, 0.012, c.z + s * (c.d / 2 + 0.04), 0.035, 0.022, 0.08, 2);
          else box(c.x + s * (c.w / 2 + 0.04), 0.012, c.z + o, 0.08, 0.022, 0.035, 2);
        }
      }
    }
  }
  return toGeom(b);
};

// ------------------------------------------------------------ timing

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

const YAW = THREE.MathUtils.degToRad(16);

export const circuitState = (frame: number) => {
  const t = frame / FPS;
  // dolly: slow glide that eases out toward the end
  const k = t / 15;
  // distance to the chip along a slightly diagonal approach (YAW), so the
  // buses run across the frame on a gentle diagonal
  const dist = 25 - 17 * (k * (1.45 - 0.45 * k));
  const drift = 0.35 * Math.sin(t * 0.37 + 0.4) * (1 - smooth(8, 14, t)) + 0.08 * Math.sin(t * 0.9);
  const x = dist * Math.sin(YAW) + drift * Math.cos(YAW);
  const z = dist * Math.cos(YAW) - drift * Math.sin(YAW);
  const y = 1.5 + 0.06 * Math.sin(t * 0.5);
  // focus: mid-distance traces, then a pull onto the chip at 9-11 s
  const chipDist = Math.hypot(dist, y - 0.3);
  const focus = 5.0 + (chipDist - 5.0) * smooth(9, 11, t);
  const converge = smooth(10.6, 11.6, t) * (1 - 0.5 * smooth(13, 15, t));
  const flare =
    smooth(11.3, 12.4, t) * 2.2 * (1 - 0.55 * smooth(12.6, 13.6, t)) +
    0.08 * Math.sin(t * 6.0) * smooth(13, 13.5, t);
  return { t, x, y, z, drift, focus, converge, flare };
};

class CircuitWorld implements World {
  post: Post;
  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.05, 400);
  uniforms: Record<string, THREE.IUniform>;
  mats: THREE.ShaderMaterial[] = [];
  geos: THREE.BufferGeometry[] = [];
  haze: THREE.Color;

  constructor(v: CircuitVersion) {
    const v3 = (h: string) => new THREE.Vector3(...lin(h));
    this.uniforms = {
      uTime: { value: 0 },
      uFocus: { value: 4 },
      uAper: { value: 0.016 },
      uMaxCoc: { value: 0.03 },
      uFogD: { value: 0.03 },
      uFlare: { value: 0 },
      uConverge: { value: 0 },
      uBoard: { value: v3(v.board) },
      uTrace: { value: v3(v.trace) },
      uPulse: { value: v3(v.pulse) },
      uCore: { value: v3(v.core) },
      uHaze: { value: v3(v.haze) },
      uCamPos: { value: new THREE.Vector3() },
    };
    const h = lin(v.haze);
    this.haze = new THREE.Color(h[0], h[1], h[2]);
    const mk = (frag: string) => {
      const m = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: VERT,
        fragmentShader: frag,
        uniforms: this.uniforms,
        side: THREE.DoubleSide,
      });
      this.mats.push(m);
      return m;
    };
    const boardG = new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2).translate(0, 0, -150);
    const n = boardG.getAttribute("position").count;
    boardG.setAttribute("aAlong", new THREE.Float32BufferAttribute(new Float32Array(n), 1));
    boardG.setAttribute("aLane", new THREE.Float32BufferAttribute(new Float32Array(n * 4), 4));
    boardG.setAttribute("aPad", new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    const traces = buildTraces();
    const solids = buildSolids();
    this.geos.push(boardG, traces, solids);
    for (const [g, f] of [
      [boardG, BOARD_FRAG],
      [traces, TRACE_FRAG],
      [solids, SOLID_FRAG],
    ] as const) {
      const m = new THREE.Mesh(g, mk(f));
      m.frustumCulled = false;
      this.scene.add(m);
    }
    this.post = new Post({
      dof: true,
      maxCoc: 0.03,
      bloomStrength: 1.35,
      bloomSpread: 0.9,
      threshold: 0.45,
      knee: 0.35,
      exposure: 0.56,
      vignette: 0.45,
      grain: 0.02,
    });
  }

  render(gl: THREE.WebGLRenderer, frame: number) {
    const s = circuitState(frame);
    this.post.render(
      gl,
      (target) => {
        const cam = this.cam;
        cam.aspect = target.width / target.height;
        cam.updateProjectionMatrix();
        cam.position.set(s.x, s.y, s.z);
        cam.rotation.set(0, 0, 0, "YXZ");
        cam.rotation.x = THREE.MathUtils.degToRad(-17.5);
        cam.rotation.y = YAW + 0.03 * Math.sin(s.t * 0.31 + 1.0) * (1 - smooth(8, 13, s.t)) - s.drift * 0.02;
        cam.rotation.z = 0.01 * Math.sin(s.t * 0.27);
        cam.updateMatrixWorld(true);
        const u = this.uniforms;
        u.uTime.value = s.t;
        u.uFocus.value = s.focus;
        u.uFlare.value = s.flare;
        u.uConverge.value = s.converge;
        u.uCamPos.value.copy(cam.position);
        gl.setRenderTarget(target);
        gl.setClearColor(this.haze, 1);
        gl.clear(true, true, false);
        gl.render(this.scene, cam);
      },
      frame % 600,
    );
  }

  dispose() {
    this.post.dispose();
    this.mats.forEach((m) => m.dispose());
    this.geos.forEach((g) => g.dispose());
  }
}

export const CircuitChip: React.FC<{ version: CircuitVersion }> = ({ version }) => (
  <GLStage create={() => new CircuitWorld(version)} deps={[version]} />
);
