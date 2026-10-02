import { Buffer, BufferUsage, Geometry, Mesh, Shader } from "pixi.js";

// Many screen-space polylines in one additive triangle mesh, rebuilt per
// frame. Each point carries a width (px) and a premultiplied RGBA. A soft
// cross-section profile (`hardness`) gives glowing fibres.

const VERT = /* glsl */ `#version 300 es
in vec2 aPosition; in vec4 aColor; in vec2 aAcross;
out vec4 vColor; out vec2 vAcross;
uniform mat3 uProjectionMatrix; uniform mat3 uWorldTransformMatrix; uniform mat3 uTransformMatrix;
void main(){
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vColor = aColor; vAcross = aAcross;
}`;
const FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec4 vColor; in vec2 vAcross;
out vec4 finalColor;
void main(){
  float d = abs(vAcross.x);
  // vAcross.y: 0 = crisp core + small halo, 1 = fully soft (defocused)
  float core = 1.0 - smoothstep(0.25, 0.6, d);
  float halo = exp(-d*d*6.0) * 0.45;
  float soft = exp(-d*d*3.2);
  float a = mix(core + halo, soft, vAcross.y);
  finalColor = vColor * a;
}`;

export class StripBatch {
  mesh: Mesh<Geometry, Shader>;
  private pos: Float32Array;
  private col: Float32Array;
  private acr: Float32Array;
  private idx: Uint32Array;
  private pb: Buffer;
  private cb: Buffer;
  private ab: Buffer;
  private ib: Buffer;
  private capV: number;
  private capI: number;
  private nv = 0;
  private ni = 0;

  constructor(maxPoints: number) {
    this.capV = maxPoints * 2;
    this.capI = maxPoints * 6;
    this.pos = new Float32Array(this.capV * 2);
    this.col = new Float32Array(this.capV * 4);
    this.acr = new Float32Array(this.capV * 2);
    this.idx = new Uint32Array(this.capI);
    this.pb = new Buffer({ data: this.pos, usage: BufferUsage.VERTEX | BufferUsage.COPY_DST });
    this.cb = new Buffer({ data: this.col, usage: BufferUsage.VERTEX | BufferUsage.COPY_DST });
    this.ab = new Buffer({ data: this.acr, usage: BufferUsage.VERTEX | BufferUsage.COPY_DST });
    this.ib = new Buffer({ data: this.idx, usage: BufferUsage.INDEX | BufferUsage.COPY_DST });
    const geometry = new Geometry({
      attributes: {
        aPosition: { buffer: this.pb, format: "float32x2" },
        aColor: { buffer: this.cb, format: "float32x4" },
        aAcross: { buffer: this.ab, format: "float32x2" },
      },
      indexBuffer: this.ib,
    });
    this.mesh = new Mesh({ geometry, shader: Shader.from({ gl: { vertex: VERT, fragment: FRAG } }) });
    this.mesh.blendMode = "add";
  }

  begin() {
    this.nv = 0;
    this.ni = 0;
  }

  // xs, ys: screen px; ws: full width px; cs: premultiplied rgba (4 per point); soft: 0..1 per point
  strip(n: number, xs: Float32Array, ys: Float32Array, ws: Float32Array, cs: Float32Array, soft: Float32Array) {
    if (n < 2 || this.nv + n * 2 > this.capV) return;
    const base = this.nv;
    for (let i = 0; i < n; i++) {
      const i0 = Math.max(0, i - 1),
        i1 = Math.min(n - 1, i + 1);
      let dx = xs[i1] - xs[i0],
        dy = ys[i1] - ys[i0];
      const l = Math.hypot(dx, dy) || 1e-6;
      dx /= l;
      dy /= l;
      const w = ws[i] + 1.5; // AA pad
      const k = ws[i] / w + 0.3;
      const nx = (-dy * w) / 2,
        ny = (dx * w) / 2;
      const v = this.nv;
      this.pos[v * 2] = xs[i] + nx;
      this.pos[v * 2 + 1] = ys[i] + ny;
      this.pos[v * 2 + 2] = xs[i] - nx;
      this.pos[v * 2 + 3] = ys[i] - ny;
      for (let j = 0; j < 2; j++) {
        const o = (v + j) * 4;
        this.col[o] = cs[i * 4] * k;
        this.col[o + 1] = cs[i * 4 + 1] * k;
        this.col[o + 2] = cs[i * 4 + 2] * k;
        this.col[o + 3] = cs[i * 4 + 3] * k;
        this.acr[(v + j) * 2] = j ? -1 : 1;
        this.acr[(v + j) * 2 + 1] = soft[i];
      }
      this.nv += 2;
    }
    for (let i = 0; i < n - 1; i++) {
      const a = base + i * 2;
      const o = this.ni;
      this.idx[o] = a;
      this.idx[o + 1] = a + 1;
      this.idx[o + 2] = a + 2;
      this.idx[o + 3] = a + 1;
      this.idx[o + 4] = a + 3;
      this.idx[o + 5] = a + 2;
      this.ni += 6;
    }
  }

  end() {
    this.idx.fill(0, this.ni);
    this.pos.fill(0, this.nv * 2);
    this.col.fill(0, this.nv * 4);
    this.pb.update();
    this.cb.update();
    this.ab.update();
    this.ib.update();
  }
}
