import { Buffer, BufferUsage, Geometry, Mesh, Shader } from "pixi.js";

// Soft round glows computed analytically in the fragment shader (float
// precision, so wide low-alpha falloffs don't band the way an 8-bit
// gradient texture does). Additive.
const VERT = /* glsl */ `#version 300 es
in vec2 aPosition; in vec2 aUv; in vec4 aColor; in float aSharp;
out vec2 vUv; out vec4 vColor; out float vSharp;
uniform mat3 uProjectionMatrix; uniform mat3 uWorldTransformMatrix; uniform mat3 uTransformMatrix;
void main(){
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUv = aUv; vColor = aColor; vSharp = aSharp;
}`;
const FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv; in vec4 vColor; in float vSharp;
out vec4 finalColor;
void main(){
  float r2 = dot(vUv, vUv);
  // vSharp: 0 = broad gaussian, 1 = point core + long tail
  float broad = max(0.0, (exp(-r2 * 4.5) - exp(-4.5)) / (1.0 - exp(-4.5)));
  float pt = exp(-r2 * 220.0) + 0.35*exp(-r2 * 30.0) + 0.08*exp(-r2*6.0);
  float ptEdge = max(0.0, 1.0 - r2);
  float a = mix(broad, pt * ptEdge * ptEdge, vSharp);
  finalColor = vColor * a;
}`;

export class GlowBatch {
  mesh: Mesh<Geometry, Shader>;
  private pos: Float32Array;
  private col: Float32Array;
  private sh: Float32Array;
  private pb: Buffer;
  private cb: Buffer;
  private sb: Buffer;
  private cap: number;
  private n = 0;
  constructor(cap: number) {
    this.cap = cap;
    this.pos = new Float32Array(cap * 8);
    this.col = new Float32Array(cap * 16);
    this.sh = new Float32Array(cap * 4);
    const uv = new Float32Array(cap * 8);
    const idx = new Uint32Array(cap * 6);
    for (let i = 0; i < cap; i++) {
      uv.set([-1, -1, 1, -1, 1, 1, -1, 1], i * 8);
      const v = i * 4;
      idx.set([v, v + 1, v + 2, v, v + 2, v + 3], i * 6);
    }
    this.pb = new Buffer({ data: this.pos, usage: BufferUsage.VERTEX | BufferUsage.COPY_DST });
    this.cb = new Buffer({ data: this.col, usage: BufferUsage.VERTEX | BufferUsage.COPY_DST });
    this.sb = new Buffer({ data: this.sh, usage: BufferUsage.VERTEX | BufferUsage.COPY_DST });
    const geometry = new Geometry({
      attributes: {
        aPosition: { buffer: this.pb, format: "float32x2" },
        aUv: { buffer: new Buffer({ data: uv, usage: BufferUsage.VERTEX }), format: "float32x2" },
        aColor: { buffer: this.cb, format: "float32x4" },
        aSharp: { buffer: this.sb, format: "float32" },
      },
      indexBuffer: idx,
    });
    this.mesh = new Mesh({ geometry, shader: Shader.from({ gl: { vertex: VERT, fragment: FRAG } }) });
    this.mesh.blendMode = "add";
  }
  begin() {
    this.n = 0;
  }
  // radius in px; rgb linear 0..n (HDR ok), intensity a
  add(x: number, y: number, radius: number, r: number, g: number, b: number, a: number, sharp = 0) {
    if (this.n >= this.cap || a <= 0) return;
    const o = this.n * 8;
    this.pos.set([x - radius, y - radius, x + radius, y - radius, x + radius, y + radius, x - radius, y + radius], o);
    const q = this.n * 16;
    for (let k = 0; k < 4; k++) this.col.set([r * a, g * a, b * a, a], q + k * 4);
    this.sh.fill(sharp, this.n * 4, this.n * 4 + 4);
    this.n++;
  }
  end() {
    this.pos.fill(0, this.n * 8);
    this.col.fill(0, this.n * 16);
    this.pb.update();
    this.cb.update();
    this.sb.update();
  }
}
