import * as THREE from "three";

// Up to N straight links drawn as screen-space quads (the instanced equivalent of
// THREE.LineSegments). Native GL lines are always 1 device pixel wide, which would make
// the 4K render look three times thinner than the 720p preview; these keep their width
// in 720p pixels at any resolution and are anti-aliased, with sub-pixel widths drawn as
// 1px lines at reduced alpha.
//
// Per link: endpoints A and B, a drawn range [t0, t1] along A->B (growth or travelling
// streaks), RGBA colour and a width multiplier. Hidden links: t1 <= t0.

const VERT = /* glsl */ `
attribute vec3 aA;
attribute vec3 aB;
attribute vec2 aRange;
attribute vec4 aCol;
attribute float aW;
uniform vec2 uRes;
uniform float uWidth;
uniform float uPx;
uniform float uFogNear;
uniform float uFogFar;
varying float vDist;
varying float vHalf;
varying vec4 vCol;
void main() {
  if (aRange.y <= aRange.x || aCol.a <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec3 pa = mix(aA, aB, aRange.x);
  vec3 pb = mix(aA, aB, aRange.y);
  mat4 pv = projectionMatrix * modelViewMatrix;
  vec4 ca = pv * vec4(pa, 1.0);
  vec4 cb = pv * vec4(pb, 1.0);
  float eps = 1e-3;
  if (ca.w < eps && cb.w < eps) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  if (ca.w < eps) ca = mix(ca, cb, (eps - ca.w) / (cb.w - ca.w));
  if (cb.w < eps) cb = mix(cb, ca, (eps - cb.w) / (ca.w - cb.w));
  vec2 sa = ca.xy / ca.w * 0.5 * uRes;
  vec2 sb = cb.xy / cb.w * 0.5 * uRes;
  vec2 d = sb - sa;
  float len = length(d);
  vec2 dir = len > 1e-4 ? d / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float wpx = uWidth * aW * uPx;
  float w = max(wpx, 1.0);
  float halfW = w * 0.5 + 1.0;
  bool atB = position.x > 0.5;
  vec4 c = atB ? cb : ca;
  vec2 s = atB ? sb : sa;
  s += nrm * position.y * halfW + dir * (atB ? 0.5 : -0.5);
  gl_Position = vec4(s / (0.5 * uRes) * c.w, c.z, c.w);
  vDist = position.y * halfW;
  vHalf = w * 0.5;
  float depth = c.w;
  vCol = vec4(aCol.rgb, aCol.a * min(1.0, wpx) * (1.0 - smoothstep(uFogNear, uFogFar, depth)));
}`;

const FRAG = /* glsl */ `
uniform float uOpacity;
uniform float uSoft;
varying float vDist;
varying float vHalf;
varying vec4 vCol;
void main() {
  float hard = clamp(vHalf + 0.5 - abs(vDist), 0.0, 1.0);
  // Soft lines: Gaussian cross-section (blurred light strands).
  float r = vDist / max(vHalf, 0.5);
  float a = mix(hard, exp(-r * r * 2.5), uSoft) * vCol.a * uOpacity;
  if (a <= 0.0) discard;
  gl_FragColor = vec4(vCol.rgb, a);
}`;

export type LinesOptions = {
  width: number; // in 720p pixels
  additive?: boolean;
  depthTest?: boolean;
  soft?: boolean;
  // Alpha fades out between these view distances (per vertex).
  fog?: { near: number; far: number };
};

export class Lines {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  readonly a: Float32Array;
  readonly b: Float32Array;
  readonly range: Float32Array;
  readonly col: Float32Array;
  readonly w: Float32Array;
  private geo: THREE.InstancedBufferGeometry;
  private attrs: THREE.InstancedBufferAttribute[];

  constructor(readonly count: number, res: { width: number; height: number; px: number }, opts: LinesOptions) {
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0]), 3),
    );
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    this.a = new Float32Array(count * 3);
    this.b = new Float32Array(count * 3);
    this.range = new Float32Array(count * 2);
    this.col = new Float32Array(count * 4);
    this.w = new Float32Array(count).fill(1);
    const mk = (arr: Float32Array, size: number) => {
      const at = new THREE.InstancedBufferAttribute(arr, size);
      at.setUsage(THREE.DynamicDrawUsage);
      return at;
    };
    this.attrs = [mk(this.a, 3), mk(this.b, 3), mk(this.range, 2), mk(this.col, 4), mk(this.w, 1)];
    geo.setAttribute("aA", this.attrs[0]);
    geo.setAttribute("aB", this.attrs[1]);
    geo.setAttribute("aRange", this.attrs[2]);
    geo.setAttribute("aCol", this.attrs[3]);
    geo.setAttribute("aW", this.attrs[4]);
    geo.instanceCount = count;
    this.geo = geo;
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uRes: { value: new THREE.Vector2(res.width, res.height) },
        uWidth: { value: opts.width },
        uPx: { value: res.px },
        uOpacity: { value: 1 },
        uSoft: { value: opts.soft ? 1 : 0 },
        uFogNear: { value: opts.fog?.near ?? 1e8 },
        uFogFar: { value: opts.fog?.far ?? 2e8 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: opts.depthTest ?? true,
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
  }

  setEnds(i: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number) {
    this.a[i * 3] = ax;
    this.a[i * 3 + 1] = ay;
    this.a[i * 3 + 2] = az;
    this.b[i * 3] = bx;
    this.b[i * 3 + 1] = by;
    this.b[i * 3 + 2] = bz;
  }

  setRange(i: number, t0: number, t1: number) {
    this.range[i * 2] = t0;
    this.range[i * 2 + 1] = t1;
  }

  setColor(i: number, r: number, g: number, b: number, a: number) {
    this.col[i * 4] = r;
    this.col[i * 4 + 1] = g;
    this.col[i * 4 + 2] = b;
    this.col[i * 4 + 3] = a;
  }

  // Limits the draw to the first n links.
  setDrawCount(n: number) {
    this.geo.instanceCount = Math.max(0, Math.min(this.count, n));
  }

  commit() {
    for (const at of this.attrs) at.needsUpdate = true;
  }
}
