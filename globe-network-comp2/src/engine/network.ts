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
 * Grows the network like the reference: it starts at ~1.5 s with a burst of
 * spokes from one central-US hub, then spreads outward (each newcomer must be
 * near the existing network and inside / just ahead of the camera view) and
 * links to its nearest active neighbours, with the occasional long-haul link.
 * Junctions are cities plus evenly spaced points on land. Fully deterministic.
 */
export const scheduleNetwork = (
  keys: Key[],
  seed: number,
  duration: number,
  viewRadius: (dist: number) => number,
  isLand: (lat: number, lon: number) => boolean,
) => {
  const rnd = mulberry32(seed);
  const hubCity = CITIES.find(([n]) => n === "Kansas City")!;
  const pool: THREE.Vector3[] = [latLonToVec3(hubCity[1], hubCity[2])];
  CITIES.filter(([n, la, lo]) => n !== "Kansas City" && lo > -130 && lo < 75 && la > -45 && la < 68).forEach(
    ([, la, lo]) => pool.push(latLonToVec3(la, lo)),
  );
  // evenly spaced land junctions (deserts, interiors) - never in open ocean
  for (let tries = 0, extra = 0; extra < 110 && tries < 40000; tries++) {
    const la = -38 + rnd() * 103;
    const lo = -128 + rnd() * 200;
    if (!isLand(la, lo)) continue;
    const v = latLonToVec3(la, lo);
    if (pool.some((p) => p.angleTo(v) < 0.095)) continue;
    pool.push(v);
    extra++;
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
      height: 0.003 + angle * 0.07,
      start,
      duration: 0.7 + angle * 2.4,
      seed: rnd(),
      pulse: rnd() < 0.4 ? 0.25 + rnd() * 0.35 : 0,
    };
  };
  const activate = (i: number, start: number) => {
    used.add(i);
    const p = pool[i];
    nodes.push({ p, start, size: 0.8 + rnd() * 0.5 });
    const byDist = active.map((q) => ({ q, d: q.angleTo(p) })).sort((x, y) => x.d - y.d);
    const near = byDist.filter((o) => o.d > 0.04 && o.d < 0.42);
    const nLinks = Math.min(near.length, 2 + Math.floor(rnd() * 2));
    for (let j = 0; j < nLinks; j++) links.push(mkLink(near[j].q, p, start + j * 0.1));
    // no close neighbour (e.g. first node across an ocean): bridge with long hauls
    if (!near.length) {
      const bridge = byDist.filter((o) => o.d >= 0.42 && o.d < 1.0).slice(0, 2);
      bridge.forEach((o, j) => links.push(mkLink(o.q, p, start + j * 0.15)));
    }
    if (start > 6 && rnd() < 0.18) {
      const far = active.filter((q) => {
        const d = q.angleTo(p);
        return d > 0.42 && d < 0.95;
      });
      if (far.length) links.push(mkLink(far[Math.floor(rnd() * far.length)], p, start + 0.15));
    }
    active.push(p);
  };

  activate(0, 1.5); // the hub
  for (let t = 1.6; t < duration - 1.2; t += 0.1) {
    const v = sampleTrack(keys, Math.min(duration, t + 0.5));
    const center = latLonToVec3(v[0], v[1]);
    const R = viewRadius(v[2]);
    const cand: { i: number; d: number }[] = [];
    pool.forEach((p, i) => {
      if (used.has(i) || p.angleTo(center) > R) return;
      let d = 9;
      for (const q of active) d = Math.min(d, q.angleTo(p));
      if (d < 1.0) cand.push({ i, d: d + rnd() * 0.08 });
    });
    if (!cand.length) continue;
    if (t > 6 && rnd() > Math.min(1, 0.4 + t / 12)) continue;
    cand.sort((x, y) => x.d - y.d);
    const take = 1 + (rnd() < 0.5 ? 1 : 0) + (t < 4 ? 1 : 0);
    for (let k = 0; k < take && cand.length; k++) {
      const pick = cand.splice(Math.floor(rnd() * Math.min(4, cand.length)), 1)[0];
      activate(pick.i, t + rnd() * 0.1);
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
  float a = (base + pp) * intensity;
  a *= smoothstep(0.0, 0.015, vT) * smoothstep(1.0, 0.985, vT) * 0.5 + 0.5;
  float edge = 1.0 - abs(vSide);
  // cyan-tinted line with a soft glow; bright cyan head while the link grows
  vec3 col = (coreColor * smoothstep(0.3, 0.9, edge) + glowColor * edge * 0.6) * a;
  col += (glowColor * edge + coreColor * smoothstep(0.5, 1.0, edge)) * lead * 2.2 * intensity;
  gl_FragColor = vec4(col * vFade, 1.0);
}
`;
