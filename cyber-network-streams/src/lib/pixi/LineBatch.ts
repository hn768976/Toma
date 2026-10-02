import { Buffer, BufferUsage, Geometry, Mesh, Shader } from "pixi.js";

// Screen-space line segments drawn as one additive mesh, rebuilt every
// frame from projected points. Each segment: two endpoints, a width per
// end (px) and a premultiplied RGBA per end. Soft cross-section profile.

const VERT = /* glsl */ `#version 300 es
in vec2 aPosition; in vec4 aColor; in float aAcross;
out vec4 vColor; out float vAcross;
uniform mat3 uProjectionMatrix; uniform mat3 uWorldTransformMatrix; uniform mat3 uTransformMatrix;
void main(){
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vColor = aColor; vAcross = aAcross;
}`;
const FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec4 vColor; in float vAcross;
out vec4 finalColor;
void main(){
  float a = 1.0 - smoothstep(0.35, 1.0, abs(vAcross));
  finalColor = vColor * a;
}`;

export class LineBatch {
  mesh: Mesh<Geometry, Shader>;
  private pos: Float32Array;
  private col: Float32Array;
  private acr: Float32Array;
  private pb: Buffer;
  private cb: Buffer;
  private cap: number;
  private n = 0;

  constructor(capacity: number) {
    this.cap = capacity;
    this.pos = new Float32Array(capacity * 8);
    this.col = new Float32Array(capacity * 16);
    this.acr = new Float32Array(capacity * 4);
    const idx = new Uint32Array(capacity * 6);
    for (let i = 0; i < capacity; i++) {
      const v = i * 4;
      idx.set([v, v + 1, v + 2, v + 1, v + 3, v + 2], i * 6);
      this.acr.set([-1, 1, -1, 1], i * 4);
    }
    this.pb = new Buffer({ data: this.pos, usage: BufferUsage.VERTEX | BufferUsage.COPY_DST });
    this.cb = new Buffer({ data: this.col, usage: BufferUsage.VERTEX | BufferUsage.COPY_DST });
    const ab = new Buffer({ data: this.acr, usage: BufferUsage.VERTEX | BufferUsage.COPY_DST });
    const geometry = new Geometry({
      attributes: {
        aPosition: { buffer: this.pb, format: "float32x2" },
        aColor: { buffer: this.cb, format: "float32x4" },
        aAcross: { buffer: ab, format: "float32" },
      },
      indexBuffer: idx,
    });
    const shader = Shader.from({ gl: { vertex: VERT, fragment: FRAG } });
    this.mesh = new Mesh({ geometry, shader });
    this.mesh.blendMode = "add";
  }

  begin() {
    this.n = 0;
  }

  // premultiplied colours expected (r*a, g*a, b*a, a); widths in px (full width)
  add(x0: number, y0: number, x1: number, y1: number, w0: number, w1: number, r0: number, g0: number, b0: number, a0: number, r1: number, g1: number, b1: number, a1: number) {
    if (this.n >= this.cap) return;
    let dx = x1 - x0,
      dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1e-6;
    dx /= len;
    dy /= len;
    // AA padding: widen by 1px and lower intensity so thin lines keep their energy
    const W0 = w0 + 1.2,
      W1 = w1 + 1.2;
    const k0 = w0 / W0 + 0.35,
      k1 = w1 / W1 + 0.35;
    const nx = -dy,
      ny = dx;
    // extend along the line by half a width so ends are soft too
    const ex0 = x0 - dx * W0 * 0.3,
      ey0 = y0 - dy * W0 * 0.3,
      ex1 = x1 + dx * W1 * 0.3,
      ey1 = y1 + dy * W1 * 0.3;
    const p = this.pos,
      o = this.n * 8;
    p[o] = ex0 + (nx * W0) / 2;
    p[o + 1] = ey0 + (ny * W0) / 2;
    p[o + 2] = ex0 - (nx * W0) / 2;
    p[o + 3] = ey0 - (ny * W0) / 2;
    p[o + 4] = ex1 + (nx * W1) / 2;
    p[o + 5] = ey1 + (ny * W1) / 2;
    p[o + 6] = ex1 - (nx * W1) / 2;
    p[o + 7] = ey1 - (ny * W1) / 2;
    const c = this.col,
      q = this.n * 16;
    c[q] = c[q + 4] = r0 * k0;
    c[q + 1] = c[q + 5] = g0 * k0;
    c[q + 2] = c[q + 6] = b0 * k0;
    c[q + 3] = c[q + 7] = a0 * k0;
    c[q + 8] = c[q + 12] = r1 * k1;
    c[q + 9] = c[q + 13] = g1 * k1;
    c[q + 10] = c[q + 14] = b1 * k1;
    c[q + 11] = c[q + 15] = a1 * k1;
    this.n++;
  }

  end() {
    // collapse unused quads
    this.pos.fill(0, this.n * 8);
    this.col.fill(0, this.n * 16);
    this.pb.update();
    this.cb.update();
  }
}
