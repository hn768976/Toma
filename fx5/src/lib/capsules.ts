import { Container, Geometry, Mesh, Shader, UniformGroup } from 'pixi.js';
import { es3, type UniformSpec } from './pixi';

/**
 * Anti-aliased capsule segments (polyline pieces) drawn as quads whose
 * fragment shader measures the true distance to the segment. With 'max'
 * blending, joints and overlaps never double up.
 */
export interface Seg {
  ax: number; ay: number; bx: number; by: number;
  w: number;        // core half-width (design px)
  ia: number; ib: number; // intensity at A and B
  kind: number;     // free channel for the shader (e.g. 0 = main, 1 = branch)
  sa?: number; sb?: number; // free parameter along the path (e.g. arc length)
}

const CAPSULE_VERT = /* glsl */ `
in vec2 aPosition;
in vec4 aSeg;    // ax, ay, bx, by (design px)
in vec4 aProp;   // halfWidth, ia, ib, kind
in vec2 aPath;   // sa, sb
out vec2 vP; out vec4 vSeg; out vec4 vProp; out vec2 vPath;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform float uS;     // physical px per design px
uniform vec3 uView;   // view transform: scale, offset x, offset y (design px)
void main() {
  vec2 p = aPosition * uView.x + uView.yz;
  vP = p; vSeg = aSeg * uView.x + vec4(uView.yz, uView.yz); vProp = aProp; vPath = aPath;
  vProp.x *= uView.x;
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(p * uS, 1.0)).xy, 0.0, 1.0);
}
`;

export class Capsules {
  mesh: Mesh<Geometry, Shader>;
  /** Render this, not the mesh: Pixi ignores a root container's own blend mode. */
  root = new Container();
  u: Record<string, any>;
  constructor(fragment: string, uniforms: UniformSpec, s: number) {
    const group = new UniformGroup({
      uS: { value: s, type: 'f32' },
      uView: { value: [1, 0, 0], type: 'vec3<f32>' },
      ...uniforms,
    } as any);
    const shader = Shader.from({
      gl: { vertex: es3(CAPSULE_VERT), fragment: es3(fragment) },
      resources: { u: group },
    });
    this.u = group.uniforms;
    this.mesh = new Mesh({ geometry: Capsules.build([], 1), shader });
    this.mesh.blendMode = 'max';
    this.root.addChild(this.mesh);
  }
  /** pad: extra design px around each capsule for glow/AA */
  set(segs: Seg[], pad: number) {
    const old = this.mesh.geometry;
    this.mesh.geometry = Capsules.build(segs, pad);
    old.destroy(true);
  }
  static build(segs: Seg[], pad: number): Geometry {
    const n = Math.max(segs.length, 1);
    const pos = new Float32Array(n * 8);
    const seg = new Float32Array(n * 16);
    const prop = new Float32Array(n * 16);
    const path = new Float32Array(n * 8);
    const idx = new Uint32Array(n * 6);
    segs.forEach((s, i) => {
      let dx = s.bx - s.ax;
      let dy = s.by - s.ay;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      const r = s.w + pad;
      const nx = -dy * r;
      const ny = dx * r;
      const ex = dx * r;
      const ey = dy * r;
      const corners = [
        s.ax - ex + nx, s.ay - ey + ny,
        s.bx + ex + nx, s.by + ey + ny,
        s.bx + ex - nx, s.by + ey - ny,
        s.ax - ex - nx, s.ay - ey - ny,
      ];
      pos.set(corners, i * 8);
      for (let k = 0; k < 4; k++) {
        seg.set([s.ax, s.ay, s.bx, s.by], i * 16 + k * 4);
        prop.set([s.w, s.ia, s.ib, s.kind], i * 16 + k * 4);
        path.set([s.sa ?? 0, s.sb ?? 0], i * 8 + k * 2);
      }
      idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    });
    if (segs.length === 0) pos.fill(-1e5);
    return new Geometry({
      attributes: {
        aPosition: { buffer: pos, format: 'float32x2' },
        aSeg: { buffer: seg, format: 'float32x4' },
        aProp: { buffer: prop, format: 'float32x4' },
        aPath: { buffer: path, format: 'float32x2' },
      },
      indexBuffer: idx,
    });
  }
}

/** GLSL helper: distance from p to segment, and the 0..1 position along it. */
export const SEG_DIST = /* glsl */ `
vec2 segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return vec2(length(pa - ba * h), h);
}
`;
