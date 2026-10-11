import * as THREE from "three";

// 3D line segments drawn as screen-space quads of a fixed pixel width, with
// analytic anti-aliasing across the line. Each segment carries `data`
// (vec3) that the caller's GLSL `intensity` snippet can use, e.g. for
// draw-on order and pulses.

export type Segment = {
  a: [number, number, number];
  b: [number, number, number];
  data?: [number, number, number];
};

const VERT = /* glsl */ `
attribute vec3 aStart;
attribute vec3 aEnd;
attribute vec3 aData;
attribute vec2 aCorner; // x: 0 = start, 1 = end; y: side -1 / 1
uniform vec2 resolution;
uniform float widthPx;
varying float vSide;
varying float vHalf;
varying float vAlong;
varying vec3 vData;
void main() {
  vec4 cs = projectionMatrix * modelViewMatrix * vec4(aStart, 1.0);
  vec4 ce = projectionMatrix * modelViewMatrix * vec4(aEnd, 1.0);
  vec2 hs = 0.5 * resolution;
  vec2 ss = cs.xy / cs.w * hs;
  vec2 se = ce.xy / ce.w * hs;
  vec2 d = se - ss;
  float len = length(d);
  vec2 dir = len > 1e-5 ? d / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float half_ = max(widthPx, 1.0) * 0.5;
  float ext = half_ + 1.0;
  vec4 c = mix(cs, ce, aCorner.x);
  vec2 off = nrm * aCorner.y * ext + dir * (aCorner.x * 2.0 - 1.0) * ext * 0.5;
  c.xy += off / hs * c.w;
  gl_Position = c;
  vSide = aCorner.y * ext;
  vHalf = half_;
  vAlong = aCorner.x;
  vData = aData;
}
`;

const fragFor = (intensity: string) => /* glsl */ `
uniform vec3 color;
uniform float widthPx;
uniform float uTime;
varying float vSide;
varying float vHalf;
varying float vAlong;
varying vec3 vData;
float lineIntensity() {
  ${intensity}
}
void main() {
  float cover = clamp(vHalf + 0.5 - abs(vSide), 0.0, 1.0);
  // Lines thinner than a pixel fade instead of breaking up.
  cover *= min(widthPx, 1.0);
  float k = lineIntensity();
  float a = cover * k;
  if (a < 0.002) discard;
  gl_FragColor = vec4(color * a, 1.0);
}
`;

export class FatLines {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  constructor(
    segs: Segment[],
    opts: {
      widthPx: number; // buffer pixels
      color: THREE.ColorRepresentation;
      intensity?: number;
      resolution: THREE.Vector2;
      glsl?: string; // body of float lineIntensity()
      depthTest?: boolean;
    },
  ) {
    const n = segs.length;
    const start = new Float32Array(n * 4 * 3);
    const end = new Float32Array(n * 4 * 3);
    const data = new Float32Array(n * 4 * 3);
    const corner = new Float32Array(n * 4 * 2);
    const index: number[] = [];
    const corners = [
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 1],
    ];
    segs.forEach((s, i) => {
      for (let c = 0; c < 4; c++) {
        const v = i * 4 + c;
        start.set(s.a, v * 3);
        end.set(s.b, v * 3);
        data.set(s.data ?? [0, 0, 0], v * 3);
        corner.set(corners[c], v * 2);
      }
      const o = i * 4;
      index.push(o, o + 2, o + 1, o + 1, o + 2, o + 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(start, 3));
    g.setAttribute("aStart", new THREE.BufferAttribute(start, 3));
    g.setAttribute("aEnd", new THREE.BufferAttribute(end, 3));
    g.setAttribute("aData", new THREE.BufferAttribute(data, 3));
    g.setAttribute("aCorner", new THREE.BufferAttribute(corner, 2));
    g.setIndex(index);
    const col = new THREE.Color(opts.color).multiplyScalar(opts.intensity ?? 1);
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: fragFor(opts.glsl ?? "return 1.0;"),
      uniforms: {
        resolution: { value: opts.resolution },
        widthPx: { value: opts.widthPx },
        color: { value: new THREE.Vector3(col.r, col.g, col.b) },
        uTime: { value: 0 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: opts.depthTest ?? true,
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
  }
}

export const circleSegments = (
  r: number,
  n: number,
  from = 0,
  to = Math.PI * 2,
  data: [number, number, number] = [0, 0, 0],
): Segment[] => {
  const out: Segment[] = [];
  for (let i = 0; i < n; i++) {
    const a0 = from + ((to - from) * i) / n;
    const a1 = from + ((to - from) * (i + 1)) / n;
    out.push({
      a: [Math.cos(a0) * r, Math.sin(a0) * r, 0],
      b: [Math.cos(a1) * r, Math.sin(a1) * r, 0],
      data,
    });
  }
  return out;
};
