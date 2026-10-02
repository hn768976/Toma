import * as THREE from "three";
import { DOF_GLSL, DofUniforms } from "./post";

/**
 * Instanced screen-space line segments with a soft profile, additive.
 * Width is in 4K pixels (scaled to the render size), so lines keep the same
 * look at 720p and 4K. Each segment knows its curve parameter range so the
 * shader can draw travelling pulses: pulse head at fract(phase + k*frame/loop)
 * with whole-number k, which loops exactly.
 */
export type LineData = {
  a: Float32Array; // xyz per segment
  b: Float32Array; // xyz per segment
  t: Float32Array; // tA, tB per segment (curve parameter 0..1)
  color: Float32Array; // rgb + intensity per segment
  pulse: Float32Array; // phase, k (repeats per loop), amplitude, pulse length per segment
};

export const makeLineMaterial = (
  dof: DofUniforms,
  view: { uRes: THREE.IUniform<THREE.Vector2>; uPxScale: THREE.IUniform<number> },
  opts: { width: number; pulseColor: THREE.Color; loop: number },
) =>
  new THREE.ShaderMaterial({
    uniforms: {
      ...dof,
      ...view,
      uWidth: { value: opts.width },
      uFrame: { value: 0 },
      uLoop: { value: opts.loop },
      uPulseColor: { value: opts.pulseColor },
      uGain: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute vec3 iA; attribute vec3 iB; attribute vec2 iT; attribute vec4 iC; attribute vec4 iP;
      uniform vec2 uRes; uniform float uPxScale; uniform float uWidth;
      varying float vSide; varying float vT; varying vec4 vC; varying vec4 vP; varying float vDepth; varying float vAS;
      void main() {
        vec4 va = modelViewMatrix * vec4(iA, 1.0);
        vec4 vb = modelViewMatrix * vec4(iB, 1.0);
        vec4 a = projectionMatrix * va;
        vec4 b = projectionMatrix * vb;
        vec2 sa = a.xy / a.w * 0.5 * uRes;
        vec2 sb = b.xy / b.w * 0.5 * uRes;
        vec2 d = sb - sa;
        float len = length(d);
        vec2 dir = len > 1e-4 ? d / len : vec2(1.0, 0.0);
        vec2 nrm = vec2(-dir.y, dir.x);
        float w = uWidth * uPxScale;
        float wd = max(w, 1.4);
        vAS = w / wd;
        float along = position.x;
        vec4 p = mix(a, b, along);
        float half_ = wd * 0.5 + 1.0;
        p.xy += nrm * position.y * half_ / (0.5 * uRes) * p.w;
        vSide = position.y * half_ / (wd * 0.5);
        vT = mix(iT.x, iT.y, along);
        vC = iC; vP = iP;
        vDepth = -mix(va.z, vb.z, along);
        gl_Position = p;
      }`,
    fragmentShader: /* glsl */ `
      ${DOF_GLSL}
      uniform float uFrame; uniform float uLoop; uniform vec3 uPulseColor; uniform float uGain;
      varying float vSide; varying float vT; varying vec4 vC; varying vec4 vP; varying float vDepth; varying float vAS;
      void main() {
        float prof = exp(-vSide * vSide * 1.6);
        float wgt = sliceWeight(vDepth);
        if (wgt <= 0.0) discard;
        vec3 col = vC.rgb * vC.a;
        if (vP.z > 0.0) {
          float head = fract(vP.x + vP.y * uFrame / uLoop);
          float dd = vT - head;
          float tail = dd < 0.0 ? exp(dd / vP.w) : exp(-dd * dd / (0.0004));
          col += uPulseColor * vP.z * tail;
        }
        gl_FragColor = vec4(col * prof * vAS * wgt * uGain, 1.0);
      }`,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    depthTest: true,
  });

/**
 * Plain (non-instanced) geometry: 4 vertices per segment, each carrying the
 * segment's data. Software GL (SwiftShader) has a large per-instance cost, so
 * this is several times faster than instancing for tens of thousands of segments.
 */
export const makeLineMesh = (data: LineData, material: THREE.ShaderMaterial) => {
  const n = data.a.length / 3;
  const corner = new Float32Array(n * 4 * 3);
  const A = new Float32Array(n * 4 * 3);
  const B = new Float32Array(n * 4 * 3);
  const T = new Float32Array(n * 4 * 2);
  const Cc = new Float32Array(n * 4 * 4);
  const P = new Float32Array(n * 4 * 4);
  const idx = new Uint32Array(n * 6);
  const cx = [0, 1, 1, 0];
  const cy = [-1, -1, 1, 1];
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 4; k++) {
      const v = i * 4 + k;
      corner[v * 3] = cx[k];
      corner[v * 3 + 1] = cy[k];
      for (let j = 0; j < 3; j++) {
        A[v * 3 + j] = data.a[i * 3 + j];
        B[v * 3 + j] = data.b[i * 3 + j];
      }
      T[v * 2] = data.t[i * 2];
      T[v * 2 + 1] = data.t[i * 2 + 1];
      for (let j = 0; j < 4; j++) {
        Cc[v * 4 + j] = data.color[i * 4 + j];
        P[v * 4 + j] = data.pulse[i * 4 + j];
      }
    }
    idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(corner, 3));
  geo.setAttribute("iA", new THREE.BufferAttribute(A, 3));
  geo.setAttribute("iB", new THREE.BufferAttribute(B, 3));
  geo.setAttribute("iT", new THREE.BufferAttribute(T, 2));
  geo.setAttribute("iC", new THREE.BufferAttribute(Cc, 4));
  geo.setAttribute("iP", new THREE.BufferAttribute(P, 4));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  return mesh;
};

/** Accumulates sampled curves into LineData. */
export class LineBuilder {
  a: number[] = [];
  b: number[] = [];
  t: number[] = [];
  color: number[] = [];
  pulse: number[] = [];
  /** pts: flat xyz polyline */
  add(pts: number[], rgb: [number, number, number], intensity: number, pulse: [number, number, number, number]) {
    const n = pts.length / 3 - 1;
    for (let i = 0; i < n; i++) {
      this.a.push(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]);
      this.b.push(pts[i * 3 + 3], pts[i * 3 + 4], pts[i * 3 + 5]);
      this.t.push(i / n, (i + 1) / n);
      this.color.push(rgb[0], rgb[1], rgb[2], intensity);
      this.pulse.push(...pulse);
    }
  }
  build(): LineData {
    return {
      a: new Float32Array(this.a),
      b: new Float32Array(this.b),
      t: new Float32Array(this.t),
      color: new Float32Array(this.color),
      pulse: new Float32Array(this.pulse),
    };
  }
}

/** Cubic bezier sampled into a flat xyz array. */
export const bezier = (p0: number[], p1: number[], p2: number[], p3: number[], steps: number) => {
  const out: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const b0 = u * u * u;
    const b1 = 3 * u * u * t;
    const b2 = 3 * u * t * t;
    const b3 = t * t * t;
    for (let k = 0; k < 3; k++) out.push(b0 * p0[k] + b1 * p1[k] + b2 * p2[k] + b3 * p3[k]);
  }
  return out;
};
