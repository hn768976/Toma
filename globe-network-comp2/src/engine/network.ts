import * as THREE from "three";
import { CITIES } from "../data/cities";
import { Key, latLonToVec3, mulberry32, sampleTrack } from "./math";
import { FLATTEN_GLSL } from "./flatten";

export type NetNode = { p: THREE.Vector3; start: number; size: number };
export type Link = {
  a: THREE.Vector3;
  b: THREE.Vector3;
  angle: number;
  height: number;
  start: number;
  duration: number;
  seed: number;
  pulse: number; // 0 = no travelling pulse
};

export const linkPoint = (l: Link, t: number, out = new THREE.Vector3()) => {
  const s = Math.sin(l.angle);
  const w1 = Math.sin((1 - t) * l.angle) / s;
  const w2 = Math.sin(t * l.angle) / s;
  out.copy(l.a).multiplyScalar(w1).addScaledVector(l.b, w2);
  return out.normalize().multiplyScalar(1.003 + l.height * Math.sin(Math.PI * t));
};

/**
 * Grows a mesh network over time. Nodes "switch on" as the camera brings their
 * region into view; each new node links to a few of its nearest active
 * neighbours (plus the odd long-haul link), so the web densifies the way the
 * reference does. Fully deterministic.
 */
export const scheduleNetwork = (
  keys: Key[],
  seed: number,
  duration: number,
  viewRadius: (dist: number) => number,
) => {
  const rnd = mulberry32(seed);
  const pool: THREE.Vector3[] = CITIES.filter(([, la, lo]) => lo > -130 && lo < 75 && la > -45 && la < 68).map(
    ([, la, lo]) => latLonToVec3(la, lo),
  );
  // extra junctions scattered over land and sea, like the reference mesh
  for (let i = 0; i < 170; i++) {
    const la = -35 + rnd() * 100;
    const lo = -125 + rnd() * 195;
    pool.push(latLonToVec3(la, lo));
  }
  const nodes: NetNode[] = [];
  const links: Link[] = [];
  const active: THREE.Vector3[] = [];
  const used = new Set<number>();
  const mkLink = (a: THREE.Vector3, b: THREE.Vector3, start: number): Link => {
    const angle = a.angleTo(b);
    return {
      a: a.clone(),
      b: b.clone(),
      angle,
      height: 0.002 + angle * 0.06,
      start,
      duration: 0.7 + angle * 2.2,
      seed: rnd(),
      pulse: rnd() < 0.45 ? 0.25 + rnd() * 0.35 : 0,
    };
  };
  for (let t = 1.2; t < duration - 1.5; t += 0.1) {
    const v = sampleTrack(keys, Math.min(duration, t + 0.6));
    const center = latLonToVec3(v[0], v[1]);
    const R = viewRadius(v[2]);
    const cand: number[] = [];
    pool.forEach((p, i) => {
      if (!used.has(i) && p.angleTo(center) < R) cand.push(i);
    });
    // ramp: few nodes at first, more as the network builds
    const rate = Math.min(1, 0.1 + t / 18);
    if (!cand.length || rnd() > rate) continue;
    const take = 1 + Math.floor(rnd() * 2);
    for (let k = 0; k < take && cand.length; k++) {
      const ci = cand.splice(Math.floor(rnd() * cand.length), 1)[0];
      used.add(ci);
      const p = pool[ci];
      const start = t + rnd() * 0.1;
      nodes.push({ p, start, size: 0.8 + rnd() * 0.5 });
      const near = active
        .map((q) => ({ q, d: q.angleTo(p) }))
        .filter((o) => o.d > 0.05 && o.d < 0.5)
        .sort((x, y) => x.d - y.d);
      const nLinks = Math.min(near.length, 2 + Math.floor(rnd() * 3));
      for (let j = 0; j < nLinks; j++) {
        // links draw outwards from the existing node to the newcomer
        links.push(mkLink(near[j].q, p, start + j * 0.12));
      }
      if (rnd() < 0.14) {
        const far = active.filter((q) => {
          const d = q.angleTo(p);
          return d > 0.5 && d < 0.9;
        });
        if (far.length) links.push(mkLink(far[Math.floor(rnd() * far.length)], p, start + 0.2));
      }
      active.push(p);
    }
  }
  return { nodes, links };
};

export const LINK_SEGMENTS = 72;

export const buildLinkGeometry = (links: Link[]) => {
  const S = LINK_SEGMENTS;
  const per = (S + 1) * 2;
  const n = links.length * per;
  const pos = new Float32Array(n * 3);
  const nxt = new Float32Array(n * 3);
  const side = new Float32Array(n);
  const tt = new Float32Array(n);
  const info = new Float32Array(n * 4);
  const idx: number[] = [];
  const p = new THREE.Vector3();
  const q = new THREE.Vector3();
  let v = 0;
  links.forEach((l, li) => {
    for (let i = 0; i <= S; i++) {
      const t = i / S;
      linkPoint(l, t, p);
      const last = i === S;
      linkPoint(l, last ? t - 1 / S : t + 1 / S, q);
      for (let s = 0; s < 2; s++) {
        pos.set([p.x, p.y, p.z], v * 3);
        nxt.set([q.x, q.y, q.z], v * 3);
        side[v] = (s === 0 ? -1 : 1) * (last ? -1 : 1);
        tt[v] = t;
        info.set([l.start, l.duration, l.seed, l.pulse], v * 4);
        v++;
      }
      if (i < S) {
        const b = li * per + i * 2;
        idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aNext", new THREE.BufferAttribute(nxt, 3));
  g.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
  g.setAttribute("aT", new THREE.BufferAttribute(tt, 1));
  g.setAttribute("aInfo", new THREE.BufferAttribute(info, 4));
  g.setIndex(idx);
  return g;
};

export const LINK_VERT = /* glsl */ `
${FLATTEN_GLSL}
attribute vec3 aNext; attribute float aSide; attribute float aT; attribute vec4 aInfo;
uniform vec2 resolution; uniform float width; uniform float pxScale; uniform vec3 camPos;
uniform float fogNear, fogFar;
varying float vT; varying float vSide; varying vec4 vInfo; varying float vFade;
void main() {
  vT = aT; vSide = aSide; vInfo = aInfo;
  vec3 f0 = flattenPos(position);
  vec4 c0 = projectionMatrix * viewMatrix * vec4(f0, 1.0);
  vec4 c1 = projectionMatrix * viewMatrix * vec4(flattenPos(aNext), 1.0);
  vec2 s0 = c0.xy / c0.w * resolution;
  vec2 s1 = c1.xy / c1.w * resolution;
  vec2 dir = normalize(s1 - s0 + 1e-6);
  vec2 nrm = vec2(-dir.y, dir.x);
  float w = width * pxScale * clamp(1.5 / c0.w, 0.45, 1.3);
  c0.xy += nrm * aSide * w / resolution * c0.w;
  // hide the far side of the globe (sphere mode) and fade with haze
  vec3 N = normalize(f0);
  float facing = uFlat > 0.5 ? 1.0 : smoothstep(-0.05, 0.12, dot(N, normalize(camPos - f0)));
  vFade = facing * (1.0 - 0.6 * smoothstep(fogNear, fogFar, length(camPos - f0)));
  gl_Position = c0;
}
`;

export const LINK_FRAG = /* glsl */ `
uniform float time; uniform vec3 coreColor; uniform vec3 glowColor; uniform float intensity;
varying float vT; varying float vSide; varying vec4 vInfo; varying float vFade;
void main() {
  float start = vInfo.x, dur = vInfo.y, seed = vInfo.z, pulse = vInfo.w;
  float u = (time - start) / dur;
  if (u <= 0.0) discard;
  float prog = u >= 1.0 ? 1.0 : 1.0 - pow(1.0 - u, 2.0);
  if (vT > prog) discard;
  // bright leading edge while drawing on, then a steady line
  float lead = exp(-pow((prog - vT) * 14.0, 2.0)) * (1.0 - smoothstep(0.9, 1.3, u));
  float base = 0.6 + 0.12 * sin(seed * 40.0 + time * 0.8);
  // occasional data pulses travelling along finished links
  float pp = 0.0;
  if (pulse > 0.0 && u > 1.0) {
    float ph = fract((time - start - dur) * pulse + seed);
    pp = exp(-pow((vT - ph) * 22.0, 2.0)) * 1.2;
  }
  float a = (base + lead * 1.6 + pp) * intensity;
  a *= smoothstep(0.0, 0.015, vT) * smoothstep(1.0, 0.985, vT) * 0.5 + 0.5;
  float edge = 1.0 - abs(vSide);
  vec3 col = coreColor * smoothstep(0.3, 0.9, edge) + glowColor * edge * 0.45;
  gl_FragColor = vec4(col * a * vFade, 1.0);
}
`;
