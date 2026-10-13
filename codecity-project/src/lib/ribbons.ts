import * as THREE from "three";

// Camera-facing ribbons for polylines: each segment is expanded across the
// view direction in the vertex shader, so a ribbon reads as a round fibre from
// any angle. Width never drops below ~1.8 px (thinner fibres get dimmer
// instead), which keeps distant outlines from breaking up or crawling.

export type Polyline = {
  pts: THREE.Vector3[];
  width: number; // half width, world units
  intensity: number;
  // free per-line params: x = pulse cycles, y = phase, z = reveal start, w = colour mix
  params?: [number, number, number, number];
};

export function ribbonGeometry(lines: Polyline[]) {
  let nv = 0;
  let ni = 0;
  for (const l of lines) {
    nv += l.pts.length * 2;
    ni += (l.pts.length - 1) * 6;
  }
  const pos = new Float32Array(nv * 3);
  const prev = new Float32Array(nv * 3);
  const next = new Float32Array(nv * 3);
  const side = new Float32Array(nv);
  const info = new Float32Array(nv * 4); // along 0..1, width, intensity, length
  const par = new Float32Array(nv * 4);
  const idx = new Uint32Array(ni);
  let v = 0;
  let k = 0;
  for (const l of lines) {
    const n = l.pts.length;
    const cum = [0];
    for (let i = 1; i < n; i++) cum.push(cum[i - 1] + l.pts[i].distanceTo(l.pts[i - 1]));
    const total = cum[n - 1] || 1;
    for (let i = 0; i < n; i++) {
      const p = l.pts[i];
      const a = l.pts[Math.max(0, i - 1)];
      const b = l.pts[Math.min(n - 1, i + 1)];
      for (const s of [-1, 1]) {
        pos.set([p.x, p.y, p.z], v * 3);
        prev.set([a.x, a.y, a.z], v * 3);
        next.set([b.x, b.y, b.z], v * 3);
        side[v] = s;
        info.set([cum[i] / total, l.width, l.intensity, total], v * 4);
        par.set(l.params ?? [0, 0, 0, 0], v * 4);
        v++;
      }
      if (i < n - 1) {
        const b0 = v - 2;
        idx.set([b0, b0 + 1, b0 + 2, b0 + 1, b0 + 3, b0 + 2], k);
        k += 6;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aPrev", new THREE.BufferAttribute(prev, 3));
  g.setAttribute("aNext", new THREE.BufferAttribute(next, 3));
  g.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
  g.setAttribute("aInfo", new THREE.BufferAttribute(info, 4));
  g.setAttribute("aPar", new THREE.BufferAttribute(par, 4));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

// Rewrites positions of an existing ribbon geometry in place (same topology).
export function updateRibbonPositions(g: THREE.BufferGeometry, lines: THREE.Vector3[][]) {
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const prev = g.getAttribute("aPrev") as THREE.BufferAttribute;
  const next = g.getAttribute("aNext") as THREE.BufferAttribute;
  let v = 0;
  for (const pts of lines) {
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(n - 1, i + 1)];
      for (let s = 0; s < 2; s++) {
        pos.setXYZ(v, p.x, p.y, p.z);
        prev.setXYZ(v, a.x, a.y, a.z);
        next.setXYZ(v, b.x, b.y, b.z);
        v++;
      }
    }
  }
  pos.needsUpdate = true;
  prev.needsUpdate = true;
  next.needsUpdate = true;
}

export const RIBBON_VERT = /* glsl */ `
attribute vec3 aPrev;
attribute vec3 aNext;
attribute float aSide;
attribute vec4 aInfo;
attribute vec4 aPar;
uniform float uPx;     // 2 * tan(fov / 2) / drawing-buffer height
uniform float uMirror;
uniform float uWidthMul;
varying float vAcross;
varying float vAlong;
varying float vI;
varying vec4 vPar;
varying float vLen;
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec4 wa = modelMatrix * vec4(aPrev, 1.0);
  vec4 wb = modelMatrix * vec4(aNext, 1.0);
  wp.y *= uMirror; wa.y *= uMirror; wb.y *= uMirror;
  vec3 dir = wb.xyz - wa.xyz;
  dir = length(dir) > 1e-6 ? normalize(dir) : vec3(1.0, 0.0, 0.0);
  vec3 toCam = normalize(cameraPosition - wp.xyz);
  vec3 off = cross(dir, toCam);
  off = length(off) > 1e-6 ? normalize(off) : vec3(0.0, 1.0, 0.0);
  float dist = length(cameraPosition - wp.xyz);
  float w = aInfo.y * uWidthMul;
  float minW = uPx * dist * 0.9;
  float wEff = max(w, minW);
  // Quad is 2x the core so the soft falloff has room.
  wp.xyz += off * wEff * 2.0 * aSide;
  vAcross = aSide * 2.0;
  vAlong = aInfo.x;
  vLen = aInfo.w;
  vI = aInfo.z * (w / wEff);
  vPar = aPar;
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
