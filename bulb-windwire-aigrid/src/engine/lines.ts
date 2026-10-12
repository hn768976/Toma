import {
  BufferAttribute,
  BufferGeometry,
  CustomBlending,
  DynamicDrawUsage,
  GLSL3,
  InstancedBufferGeometry,
  InstancedInterleavedBuffer,
  InterleavedBufferAttribute,
  Mesh,
  NoBlending,
  OneFactor,
  Points,
  RawShaderMaterial,
  ZeroFactor,
} from "three";
import type { RGB } from "./color";

// Screen-space "fat" lines: one instanced quad per segment, expanded in the
// vertex shader to a constant pixel width (scaled with frame height, so 720p
// and 4K match), with a box-filtered coverage edge. Sub-pixel widths are drawn
// one pixel wide at proportionally lower intensity, so thin and distant lines
// never shimmer or crawl the way 1px GL_LINES do.

/** Additive in RGB, leaves destination alpha (= opaque coverage) untouched. */
export const ADDITIVE = {
  blending: CustomBlending,
  blendSrc: OneFactor,
  blendDst: OneFactor,
  blendSrcAlpha: ZeroFactor,
  blendDstAlpha: OneFactor,
} as const;

/** 8 floats per segment: ax ay az bx by bz intensityA intensityB */
export const SEG_STRIDE = 8;

export const DEFAULT_LINE_CHUNK = /* glsl */ `
vec3 xform(vec3 p) { return p; }
float segVisible(vec3 a0, vec3 b0, vec3 a, vec3 b) { return 1.0; }
`;

const LINE_VERT = (chunk: string) => /* glsl */ `
precision highp float;
uniform mat4 modelViewMatrix, projectionMatrix;
uniform vec2 uRes;
uniform float uWidth, uPersp, uPerspRef;
uniform vec2 uFog;
in vec3 position;
in vec3 iA; in vec3 iB; in vec2 iI;
out float vSideW; out float vW; out float vHalf; out float vI; out float vDepth;
${chunk}
void main() {
  vec3 a = xform(iA), b = xform(iB);
  float vis = segVisible(iA, iB, a, b);
  vec4 va = modelViewMatrix * vec4(a, 1.0), vb = modelViewMatrix * vec4(b, 1.0);
  const float nearZ = -0.05;
  if ((va.z > nearZ && vb.z > nearZ) || vis <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vI = 0.0; return; }
  if (va.z > nearZ) va = mix(vb, va, (vb.z - nearZ) / (vb.z - va.z));
  if (vb.z > nearZ) vb = mix(va, vb, (va.z - nearZ) / (va.z - vb.z));
  vec4 ca = projectionMatrix * va, cb = projectionMatrix * vb;
  vec2 sa = ca.xy / ca.w * 0.5 * uRes, sb = cb.xy / cb.w * 0.5 * uRes;
  vec2 d = sb - sa; float L = length(d);
  vec2 dir = L > 1e-5 ? d / L : vec2(1.0, 0.0);
  vec2 n = vec2(-dir.y, dir.x);
  float t = position.x;
  vec4 c = t < 0.5 ? ca : cb;
  float depth = -(t < 0.5 ? va.z : vb.z);
  float s = uRes.y / 1080.0;
  float w = uWidth * s * mix(1.0, clamp(uPerspRef / depth, 0.35, 4.0), uPersp);
  float wd = max(w, 1.0);
  float hw = wd * 0.5 + 1.0;
  vec2 off = n * position.y * hw + dir * (t * 2.0 - 1.0) * 0.5;
  c.xy += off * 2.0 / uRes * c.w;
  gl_Position = c;
  // Screen-linear interpolation of the side distance (no 'noperspective' in GLSL ES 3.0).
  vSideW = position.y * hw * c.w; vW = c.w;
  vHalf = wd * 0.5;
  float fog = 1.0 - smoothstep(uFog.x, uFog.y, depth);
  vI = mix(iI.x, iI.y, t) * (w / wd) * fog * vis;
  vDepth = depth;
}
`;

const LINE_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uColor; uniform float uOpacity;
in float vSideW; in float vW; in float vHalf; in float vI; in float vDepth;
out vec4 o;
void main() {
  float side = vSideW / vW;
  float cov = clamp(vHalf + 0.5 - abs(side), 0.0, 1.0);
#ifdef DEPTH_PASS
  if (cov * vI < 0.02) discard;
  o = vec4(vDepth, 0.0, 0.0, 1.0);
#else
  o = vec4(uColor * (uOpacity * vI * cov), 1.0);
#endif
}
`;

export type LineOptions = {
  color: RGB;
  /** Width in pixels at 1080p. */
  width: number;
  opacity?: number;
  /** View-depth fade [start, end]. */
  fog?: [number, number];
  /** 0..1: blend toward width ∝ perspRef / depth. */
  persp?: number;
  perspRef?: number;
  chunk?: string;
  uniforms?: Record<string, { value: unknown }>;
  /** Also build a depth-pass material (for DoF). */
  depth?: boolean;
  maxSegments?: number;
};

const baseQuad = () => {
  const pos = new Float32Array([0, -1, 0, 0, 1, 0, 1, -1, 0, 1, 1, 0]);
  return { pos, index: [0, 2, 1, 2, 3, 1] };
};

export class LineBatch {
  mesh: Mesh;
  geom: InstancedBufferGeometry;
  mat: RawShaderMaterial;
  depthMat?: RawShaderMaterial;
  private buf: InstancedInterleavedBuffer;

  constructor(segs: Float32Array, opts: LineOptions) {
    const g = new InstancedBufferGeometry();
    const q = baseQuad();
    g.setAttribute("position", new BufferAttribute(q.pos, 3));
    g.setIndex(q.index);
    const cap = opts.maxSegments ?? segs.length / SEG_STRIDE;
    const data = new Float32Array(cap * SEG_STRIDE);
    data.set(segs.subarray(0, Math.min(segs.length, data.length)));
    this.buf = new InstancedInterleavedBuffer(data, SEG_STRIDE, 1);
    if (opts.maxSegments) this.buf.setUsage(DynamicDrawUsage);
    g.setAttribute("iA", new InterleavedBufferAttribute(this.buf, 3, 0));
    g.setAttribute("iB", new InterleavedBufferAttribute(this.buf, 3, 3));
    g.setAttribute("iI", new InterleavedBufferAttribute(this.buf, 2, 6));
    g.instanceCount = Math.min(cap, segs.length / SEG_STRIDE);
    this.geom = g;

    const uniforms = {
      uRes: { value: [1920, 1080] },
      uWidth: { value: opts.width },
      uPersp: { value: opts.persp ?? 0 },
      uPerspRef: { value: opts.perspRef ?? 10 },
      uFog: { value: opts.fog ?? [1e5, 2e5] },
      uColor: { value: opts.color },
      uOpacity: { value: opts.opacity ?? 1 },
      ...(opts.uniforms ?? {}),
    };
    const chunk = opts.chunk ?? DEFAULT_LINE_CHUNK;
    this.mat = new RawShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: LINE_VERT(chunk),
      fragmentShader: LINE_FRAG,
      uniforms,
      transparent: true,
      ...ADDITIVE,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    if (opts.depth) {
      this.depthMat = new RawShaderMaterial({
        glslVersion: GLSL3,
        vertexShader: LINE_VERT(chunk),
        fragmentShader: LINE_FRAG,
        uniforms,
        defines: { DEPTH_PASS: 1 },
        blending: NoBlending,
        depthTest: true,
        depthWrite: true,
      });
      this.mesh.userData.depthMat = this.depthMat;
    }
  }

  get u() {
    return this.mat.uniforms;
  }

  /** Another mesh drawing the same segments with the same material (own transform). */
  instance() {
    const m = new Mesh(this.geom, this.mat);
    m.frustumCulled = false;
    m.renderOrder = this.mesh.renderOrder;
    m.userData.depthMat = this.mesh.userData.depthMat;
    return m;
  }

  /** Replace segment data (dynamic batches). */
  setSegments(data: Float32Array, count: number) {
    const arr = this.buf.array as Float32Array;
    const n = Math.min(count, arr.length / SEG_STRIDE);
    arr.set(data.subarray(0, n * SEG_STRIDE));
    this.buf.needsUpdate = true;
    this.buf.updateRanges.length = 0;
    this.buf.addUpdateRange(0, n * SEG_STRIDE);
    this.geom.instanceCount = n;
  }

  setRes(w: number, h: number) {
    this.mat.uniforms.uRes.value = [w, h];
  }

  dispose() {
    this.geom.dispose();
    this.mat.dispose();
    this.depthMat?.dispose();
  }
}

/** Growable flat segment list. */
export class SegList {
  data: number[] = [];
  add(a: ArrayLike<number>, b: ArrayLike<number>, ia = 1, ib = ia) {
    this.data.push(a[0], a[1], a[2], b[0], b[1], b[2], ia, ib);
  }
  get count() {
    return this.data.length / SEG_STRIDE;
  }
  toArray() {
    return new Float32Array(this.data);
  }
}

// ---------------------------------------------------------------------------
// Points
// ---------------------------------------------------------------------------

export const DEFAULT_POINT_CHUNK = /* glsl */ `
vec3 xform(vec3 p) { return p; }
float pointVisible(vec3 p0, vec3 p) { return 1.0; }
`;

const POINT_VERT = (chunk: string) => /* glsl */ `
precision highp float;
uniform mat4 modelViewMatrix, projectionMatrix;
uniform vec2 uRes;
uniform float uSize, uPersp, uPerspRef;
uniform vec2 uFog;
uniform vec3 uDof; // focus, aperture (frac of height), max coc (frac)
in vec3 position; in vec2 aSI; // size multiplier, intensity
out float vI; out float vDepth; out float vSharp;
${chunk}
void main() {
  vec3 p = xform(position);
  float vis = pointVisible(position, p);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = -mv.z;
  float s = uRes.y / 1080.0;
  float size = uSize * aSI.x * s * mix(1.0, clamp(uPerspRef / max(depth, 0.01), 0.25, 6.0), uPersp);
  // Per-point depth of field: grow the disc to the CoC, conserve energy.
  float coc = min(uDof.y * abs(depth - uDof.x) / max(depth, 1e-3), uDof.z) * uRes.y * 2.0;
  float eff = sqrt(size * size + coc * coc);
  float disp = clamp(eff, 1.5, 1000.0);
  gl_PointSize = disp + 2.0;
  float fog = 1.0 - smoothstep(uFog.x, uFog.y, depth);
  vI = aSI.y * vis * fog * (size * size) / (disp * disp);
  vSharp = disp;
  vDepth = depth;
  if (depth < 0.05 || vI <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
`;

const POINT_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uColor; uniform float uOpacity; uniform float uCore;
in float vI; in float vDepth; in float vSharp;
out vec4 o;
void main() {
  // Disc of diameter vSharp inside a sprite of vSharp+2 px: soft 1px edge,
  // plus an optional bright core for glints.
  float r = length(gl_PointCoord - 0.5) * (vSharp + 2.0);
  float disc = clamp(vSharp * 0.5 + 0.5 - r, 0.0, 1.0);
  float soft = exp(-r * r / max(vSharp * vSharp * 0.08, 0.2));
  float a = mix(disc, soft * 1.6, uCore);
#ifdef DEPTH_PASS
  if (a * vI < 0.02) discard;
  o = vec4(vDepth, 0.0, 0.0, 1.0);
#else
  o = vec4(uColor * (uOpacity * vI * a), 1.0);
#endif
}
`;

export type PointOptions = {
  color: RGB;
  /** Diameter in px at 1080p. */
  size: number;
  opacity?: number;
  fog?: [number, number];
  persp?: number;
  perspRef?: number;
  /** [focus, aperture, maxCoc] — per-point DoF; aperture 0 disables. */
  dof?: [number, number, number];
  core?: number;
  chunk?: string;
  uniforms?: Record<string, { value: unknown }>;
  depth?: boolean;
};


export class PointBatch {
  points: Points;
  geom: BufferGeometry;
  mat: RawShaderMaterial;
  depthMat?: RawShaderMaterial;

  /** positions: xyz per point; si: (size multiplier, intensity) per point. */
  constructor(positions: Float32Array, si: Float32Array, opts: PointOptions, dynamic = false) {
    const g = new BufferGeometry();
    const pa = new BufferAttribute(positions, 3);
    const sa = new BufferAttribute(si, 2);
    if (dynamic) {
      pa.setUsage(DynamicDrawUsage);
      sa.setUsage(DynamicDrawUsage);
    }
    g.setAttribute("position", pa);
    g.setAttribute("aSI", sa);
    this.geom = g;
    const uniforms = {
      uRes: { value: [1920, 1080] },
      uSize: { value: opts.size },
      uPersp: { value: opts.persp ?? 0 },
      uPerspRef: { value: opts.perspRef ?? 10 },
      uFog: { value: opts.fog ?? [1e5, 2e5] },
      uDof: { value: opts.dof ?? [10, 0, 0] },
      uColor: { value: opts.color },
      uOpacity: { value: opts.opacity ?? 1 },
      uCore: { value: opts.core ?? 0 },
      ...(opts.uniforms ?? {}),
    };
    const chunk = opts.chunk ?? DEFAULT_POINT_CHUNK;
    this.mat = new RawShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: POINT_VERT(chunk),
      fragmentShader: POINT_FRAG,
      uniforms,
      transparent: true,
      ...ADDITIVE,
      depthTest: false,
      depthWrite: false,
    });
    this.points = new Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
    if (opts.depth) {
      this.depthMat = new RawShaderMaterial({
        glslVersion: GLSL3,
        vertexShader: POINT_VERT(chunk),
        fragmentShader: POINT_FRAG,
        uniforms,
        defines: { DEPTH_PASS: 1 },
        blending: NoBlending,
        depthTest: true,
        depthWrite: true,
      });
      this.points.userData.depthMat = this.depthMat;
    }
  }

  get u() {
    return this.mat.uniforms;
  }

  update(count?: number) {
    (this.geom.attributes.position as BufferAttribute).needsUpdate = true;
    (this.geom.attributes.aSI as BufferAttribute).needsUpdate = true;
    if (count !== undefined) this.geom.setDrawRange(0, count);
  }

  setRes(w: number, h: number) {
    this.mat.uniforms.uRes.value = [w, h];
  }

  dispose() {
    this.geom.dispose();
    this.mat.dispose();
    this.depthMat?.dispose();
  }
}

