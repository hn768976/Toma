import * as THREE from "three";
import { CITIES } from "../data/cities";
import { Key, latLonToVec3, mulberry32, sampleTrack } from "./math";
import { FLATTEN_GLSL } from "./flatten";

export type Arc = {
  a: THREE.Vector3; // unit vectors
  b: THREE.Vector3;
  angle: number;
  height: number;
  start: number;
  duration: number;
  seed: number;
  intensity: number;
};

export type LightPoint = [number, number, number]; // lat, lon, brightness

const TRAIL = 0.42; // fraction of arc length covered by the bright comet trail

/** Position along an elevated great-circle arc (t in 0..1). */
export const arcPoint = (arc: Arc, t: number, out = new THREE.Vector3()) => {
  const s = Math.sin(arc.angle);
  if (s < 1e-6) out.copy(arc.a);
  else {
    const w1 = Math.sin((1 - t) * arc.angle) / s;
    const w2 = Math.sin(t * arc.angle) / s;
    out.copy(arc.a).multiplyScalar(w1).addScaledVector(arc.b, w2);
  }
  return out.normalize().multiplyScalar(1.0015 + arc.height * Math.sin(Math.PI * t));
};

/** Head progress (0..1+TRAIL) for an arc at `time`; the visible trail is [head-TRAIL, head]. */
export const arcHead = (arc: Arc, time: number) => {
  const u = (time - arc.start) / arc.duration;
  // ease-out: launch fast, settle into the destination
  const e = u <= 0 ? 0 : u >= 1 ? 1 : 1 - Math.pow(1 - u, 1.6);
  return e * (1 + TRAIL);
};

/**
 * Deterministic arc schedule that follows the camera: hubs near the area the
 * camera is about to look at fire bursts of arcs (fan-outs) to nearby lights,
 * plus occasional long-haul links to other hubs.
 */
export const scheduleArcs = (keys: Key[], lights: LightPoint[], seed: number, duration: number): Arc[] => {
  const rnd = mulberry32(seed);
  const arcs: Arc[] = [];
  const hubVec = CITIES.map(([, la, lo]) => latLonToVec3(la, lo));
  const dests = lights.filter((l) => l[2] > 0.28).map((l) => latLonToVec3(l[0], l[1]));
  const cooldown = new Map<number, number>();
  const mk = (a: THREE.Vector3, b: THREE.Vector3, start: number, intensity: number, speed = 1): Arc | null => {
    const angle = a.angleTo(b);
    if (angle < 0.012) return null;
    return {
      a: a.clone(),
      b: b.clone(),
      angle,
      height: 0.015 + angle * 0.42,
      start,
      duration: (0.9 + angle * 5.0 + rnd() * 0.5) / speed,
      seed: rnd(),
      intensity,
    };
  };

  for (let t = 1.3; t < duration - 0.6; t += 0.15) {
    const look = sampleTrack(keys, Math.min(duration, t + 0.9));
    const center = latLonToVec3(look[0], look[1]);
    // hubs in (or about to enter) the frame
    const near: number[] = [];
    hubVec.forEach((h, i) => {
      if (h.angleTo(center) < 0.4 && (cooldown.get(i) ?? -99) < t) near.push(i);
    });
    if (near.length && rnd() < 0.85) {
      const hi = near[Math.floor(rnd() * near.length)];
      cooldown.set(hi, t + 2.5 + rnd() * 1.5);
      const hub = hubVec[hi];
      // fan-out burst to nearby lit places
      const n = 6 + Math.floor(rnd() * 7);
      const cand = dests.filter((d) => {
        const ang = d.angleTo(hub);
        return ang > 0.06 && ang < 0.3;
      });
      for (let k = 0; k < n && cand.length; k++) {
        const d = cand[Math.floor(rnd() * cand.length)];
        const arc = mk(hub, d, t + rnd() * 0.2, 1.0 + rnd() * 0.25, 1.25);
        if (arc) arcs.push(arc);
      }
      // long-haul link to another hub
      if (rnd() < 0.65) {
        const far = hubVec.filter((h) => {
          const ang = h.angleTo(hub);
          return ang > 0.2 && ang < 0.55;
        });
        if (far.length) {
          const arc = mk(hub, far[Math.floor(rnd() * far.length)], t + rnd() * 0.3, 1.0, 0.95);
          if (arc) arcs.push(arc);
        }
      }
    }
    // stray single links between lit places in view
    if (rnd() < 0.3) {
      const inView = dests.filter((d) => d.angleTo(center) < 0.35);
      if (inView.length > 2) {
        const a = inView[Math.floor(rnd() * inView.length)];
        const b = inView[Math.floor(rnd() * inView.length)];
        const arc = mk(a, b, t, 0.7 + rnd() * 0.3);
        if (arc && arc.angle > 0.04) arcs.push(arc);
      }
    }
  }
  return arcs;
};

export const ARC_SEGMENTS = 96;

/** Build one BufferGeometry holding a screen-space-expanded ribbon per arc. */
export const buildArcGeometry = (arcs: Arc[]) => {
  const S = ARC_SEGMENTS;
  const vertsPerArc = (S + 1) * 2;
  const n = arcs.length * vertsPerArc;
  const pos = new Float32Array(n * 3);
  const nxt = new Float32Array(n * 3);
  const side = new Float32Array(n);
  const tt = new Float32Array(n);
  const info = new Float32Array(n * 4);
  const info2 = new Float32Array(n * 2);
  const idx: number[] = [];
  const p = new THREE.Vector3();
  const q = new THREE.Vector3();
  let v = 0;
  arcs.forEach((arc, ai) => {
    for (let i = 0; i <= S; i++) {
      const t = i / S;
      arcPoint(arc, t, p);
      const flip = i === S;
      arcPoint(arc, flip ? t - 1 / S : t + 1 / S, q);
      for (let s = 0; s < 2; s++) {
        pos.set([p.x, p.y, p.z], v * 3);
        nxt.set([q.x, q.y, q.z], v * 3);
        side[v] = (s === 0 ? -1 : 1) * (flip ? -1 : 1);
        tt[v] = t;
        info.set([arc.start, arc.duration, arc.seed, arc.intensity], v * 4);
        info2.set([arc.angle * (1 + arc.height * 2), 0], v * 2);
        v++;
      }
      if (i < S) {
        const b = ai * vertsPerArc + i * 2;
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
  g.setAttribute("aInfo2", new THREE.BufferAttribute(info2, 2));
  g.setIndex(idx);
  return g;
};

export const ARC_VERT = /* glsl */ `
${FLATTEN_GLSL}
uniform float fogNear, fogFar; uniform vec3 camPos;
varying float vFade;
attribute vec3 aNext; attribute float aSide; attribute float aT; attribute vec4 aInfo; attribute vec2 aInfo2;
uniform vec2 resolution; uniform float width; uniform float pxScale;
varying float vT; varying float vSide; varying vec4 vInfo; varying float vLen;
void main() {
  vT = aT; vSide = aSide; vInfo = aInfo; vLen = aInfo2.x;
  vec3 f0 = flattenPos(position);
  vec4 c0 = projectionMatrix * viewMatrix * vec4(f0, 1.0);
  vec4 c1 = projectionMatrix * viewMatrix * vec4(flattenPos(aNext), 1.0);
  vFade = (1.0 - 0.75 * smoothstep(fogNear, fogFar, length(camPos - f0))) * smoothstep(1.0, 0.7, flatAngle(position));
  vec2 s0 = c0.xy / c0.w * resolution;
  vec2 s1 = c1.xy / c1.w * resolution;
  vec2 dir = normalize(s1 - s0 + 1e-6);
  vec2 nrm = vec2(-dir.y, dir.x);
  // thinner with distance a little, but never sub-pixel
  float w = width * pxScale * clamp(1.6 / c0.w, 0.5, 1.5);
  c0.xy += nrm * aSide * w / resolution * c0.w;
  gl_Position = c0;
}
`;

export const ARC_FRAG = /* glsl */ `
uniform float time; uniform vec3 coreColor; uniform vec3 glowColor; uniform float trail;
varying float vFade;
varying float vT; varying float vSide; varying vec4 vInfo; varying float vLen;
void main() {
  float start = vInfo.x, dur = vInfo.y, seed = vInfo.z, inten = vInfo.w;
  float u = (time - start) / dur;
  if (u <= 0.0) discard;
  float e = u >= 1.0 ? 1.0 : 1.0 - pow(1.0 - u, 1.6);
  float head = e * (1.0 + trail);
  float d = head - vT; // distance behind the head
  float comet = (d >= 0.0 && d <= trail) ? pow(1.0 - d / trail, 2.2) : 0.0;
  // dotted residue that stays behind the comet, then fades
  float age = time - (start + dur);
  float dotsN = max(14.0, vLen * 420.0);
  float dots = smoothstep(0.35, 0.5, fract(vT * dotsN)) * (1.0 - smoothstep(0.5, 0.65, fract(vT * dotsN)));
  float resid = (vT <= min(head, 1.0)) ? 0.65 * dots * (1.0 - smoothstep(1.0, 7.0, age)) : 0.0;
  float a = max(comet, resid) * inten;
  // soften the ends of the arc
  a *= smoothstep(0.0, 0.03, vT) * (0.6 + 0.4 * smoothstep(1.0, 0.94, vT));
  float edge = 1.0 - abs(vSide);
  float core = smoothstep(0.35, 0.95, edge);
  float halo = smoothstep(0.0, 1.0, edge);
  vec3 col = coreColor * core * 1.6 + glowColor * halo * 0.7;
  gl_FragColor = vec4(col * a * vFade, 1.0);
}
`;

export const TRAIL_LEN = TRAIL;
