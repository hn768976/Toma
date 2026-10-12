import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Lines of light with travelling pulses. Every line carries:
//   aAlong  0..1 position along the line      aLen    world length
//   aPeriod frames per pulse (divides the loop) aPhase 0..1 seeded offset
//   aBright base brightness
// A pulse's head is at fract(frame/period + phase) * (len + seg); at a loop
// boundary frame/period is an integer, so the pattern repeats exactly.

export type LineAttrs = { period: number; phase: number; bright: number };

function addAttrs(g: THREE.BufferGeometry, along: Float32Array, len: number, a: LineAttrs) {
  const n = along.length;
  g.setAttribute("aAlong", new THREE.BufferAttribute(along, 1));
  g.setAttribute("aLen", new THREE.BufferAttribute(new Float32Array(n).fill(len), 1));
  g.setAttribute("aPeriod", new THREE.BufferAttribute(new Float32Array(n).fill(a.period), 1));
  g.setAttribute("aPhase", new THREE.BufferAttribute(new Float32Array(n).fill(a.phase), 1));
  g.setAttribute("aBright", new THREE.BufferAttribute(new Float32Array(n).fill(a.bright), 1));
}

/** Thin tube along a curve. */
export function tubeLine(curve: THREE.Curve<THREE.Vector3>, radius: number, segments: number, a: LineAttrs) {
  const g = new THREE.TubeGeometry(curve, segments, radius, 5, false);
  const uv = g.getAttribute("uv") as THREE.BufferAttribute;
  const along = new Float32Array(uv.count);
  for (let i = 0; i < uv.count; i++) along[i] = uv.getX(i);
  g.deleteAttribute("uv");
  g.deleteAttribute("normal");
  addAttrs(g, along, curve.getLength(), a);
  return g;
}

/** Flat ribbon through points; `normal` is the ribbon's facing direction. */
export function ribbonLine(points: THREE.Vector3[], width: number, normal: THREE.Vector3, a: LineAttrs) {
  const n = points.length;
  const pos = new Float32Array(n * 2 * 3);
  const along = new Float32Array(n * 2);
  const cum: number[] = [0];
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + points[i].distanceTo(points[i - 1]));
  const total = cum[n - 1];
  const idx: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = points[Math.min(n - 1, i + 1)].clone().sub(points[Math.max(0, i - 1)]).normalize();
    const side = new THREE.Vector3().crossVectors(t, normal).normalize().multiplyScalar(width / 2);
    const p = points[i];
    pos.set([p.x - side.x, p.y - side.y, p.z - side.z, p.x + side.x, p.y + side.y, p.z + side.z], i * 6);
    along[i * 2] = along[i * 2 + 1] = cum[i] / total;
    if (i < n - 1) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  addAttrs(g, along, total, a);
  return g;
}

export const mergeLines = (gs: THREE.BufferGeometry[]) => {
  const m = mergeGeometries(gs, false)!;
  m.computeBoundingSphere();
  return m;
};

const VERT = /* glsl */ `
attribute float aAlong, aLen, aPeriod, aPhase, aBright;
varying float vAlong, vLen, vPeriod, vPhase, vBright;
varying float vFog;
void main() {
  vAlong = aAlong; vLen = aLen; vPeriod = aPeriod; vPhase = aPhase; vBright = aBright;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vFog = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
uniform vec3 color;
uniform vec3 headColor;
uniform float frame;
uniform float base;
uniform float pulse;
uniform float seg;      // pulse length, world units
uniform float tail;     // 0..1 fraction of the pulse that is tail (rest is head ramp)
uniform float fadeIn, fadeOut;
uniform float fogDensity;
uniform float pulsesOnly;
varying float vAlong, vLen, vPeriod, vPhase, vBright;
varying float vFog;
void main() {
  float p = fract(fract(frame / vPeriod) + vPhase);
  float head = p * (vLen + seg);
  float s = head - vAlong * vLen;           // distance behind the head
  float k = 0.0;
  if (s > 0.0 && s < seg) {
    float x = s / seg;
    k = pow(1.0 - x, 2.2) * smoothstep(0.0, 0.04, x + 0.02);
  }
  float ends = smoothstep(0.0, fadeIn, vAlong) * (1.0 - smoothstep(1.0 - fadeOut, 1.0, vAlong));
  vec3 c = color * base * vBright * (1.0 - pulsesOnly) + mix(color, headColor, pow(k, 3.0)) * k * pulse * vBright;
  c *= ends;
  c *= exp(-fogDensity * vFog);
  gl_FragColor = vec4(c, 1.0);
}`;

export function flowMaterial(o: {
  color: string;
  headColor: string;
  base: number;
  pulse: number;
  seg: number;
  fadeIn?: number;
  fadeOut?: number;
  fogDensity?: number;
  pulsesOnly?: boolean;
}) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      color: { value: new THREE.Color(o.color) },
      headColor: { value: new THREE.Color(o.headColor) },
      frame: { value: 0 },
      base: { value: o.base },
      pulse: { value: o.pulse },
      seg: { value: o.seg },
      tail: { value: 0.15 },
      fadeIn: { value: o.fadeIn ?? 0.001 },
      fadeOut: { value: o.fadeOut ?? 0.001 },
      fogDensity: { value: o.fogDensity ?? 0 },
      pulsesOnly: { value: o.pulsesOnly ? 1 : 0 },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}
