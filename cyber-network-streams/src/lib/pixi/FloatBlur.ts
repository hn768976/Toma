import { Buffer, BufferUsage, Container, Geometry, Mesh, Renderer, Shader, Texture } from "pixi.js";

// Bloom helper that never leaves half-float textures. Pixi filters bounce
// through pooled 8-bit textures, which bands wide low-level glows; these are
// plain meshes rendering RT → RT.

const VERT = /* glsl */ `#version 300 es
in vec2 aPosition; in vec2 aUV; out vec2 vUv;
uniform mat3 uProjectionMatrix; uniform mat3 uWorldTransformMatrix; uniform mat3 uTransformMatrix;
void main(){ mat3 m = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix; gl_Position = vec4((m*vec3(aPosition,1.0)).xy,0.0,1.0); vUv = aUV; }`;
const FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv; out vec4 finalColor;
uniform sampler2D uSrc;
uniform vec2 uTexel; uniform vec2 uDir; uniform float uMode;
void main(){
  if (uMode < 0.5) {
    // 4×4 box via four bilinear taps
    vec2 h = uTexel;
    vec4 s = texture(uSrc, vUv + vec2(-h.x,-h.y)) + texture(uSrc, vUv + vec2(h.x,-h.y)) + texture(uSrc, vUv + vec2(-h.x,h.y)) + texture(uSrc, vUv + vec2(h.x,h.y));
    finalColor = s * 0.25;
  } else {
    // 9-tap gaussian with linear-sampling offsets
    vec2 d = uDir * uTexel;
    vec4 s = texture(uSrc, vUv) * 0.2270270270;
    s += (texture(uSrc, vUv + d*1.3846153846) + texture(uSrc, vUv - d*1.3846153846)) * 0.3162162162;
    s += (texture(uSrc, vUv + d*3.2307692308) + texture(uSrc, vUv - d*3.2307692308)) * 0.0702702703;
    finalColor = s;
  }
}`;

export class FloatBlur {
  private mesh: Mesh<Geometry, Shader>;
  private cont = new Container();
  private posBuf: Buffer;
  private shader: Shader;
  constructor() {
    this.posBuf = new Buffer({ data: new Float32Array(8), usage: BufferUsage.VERTEX | BufferUsage.COPY_DST });
    const geometry = new Geometry({
      attributes: {
        aPosition: { buffer: this.posBuf, format: "float32x2" },
        aUV: { buffer: new Buffer({ data: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), usage: BufferUsage.VERTEX }), format: "float32x2" },
      },
      indexBuffer: new Uint32Array([0, 1, 2, 0, 2, 3]),
    });
    this.shader = Shader.from({
      gl: { vertex: VERT, fragment: FRAG },
      resources: {
        uSrc: Texture.WHITE.source,
        u: { uTexel: { value: new Float32Array([0, 0]), type: "vec2<f32>" }, uDir: { value: new Float32Array([1, 0]), type: "vec2<f32>" }, uMode: { value: 0, type: "f32" } },
      },
    });
    this.mesh = new Mesh({ geometry, shader: this.shader });
    this.mesh.blendMode = "none";
    this.cont.addChild(this.mesh);
  }
  private run(r: Renderer, src: Texture, dst: Texture, mode: number, dir: [number, number]) {
    const w = dst.width,
      h = dst.height;
    (this.posBuf.data as Float32Array).set([0, 0, w, 0, w, h, 0, h]);
    this.posBuf.update();
    this.shader.resources.uSrc = src.source;
    const u = this.shader.resources.u.uniforms;
    u.uTexel = new Float32Array([1 / src.width, 1 / src.height]);
    u.uDir = new Float32Array(dir);
    u.uMode = mode;
    r.render({ container: this.cont, target: dst, clear: true, clearColor: [0, 0, 0, 0] });
  }
  down(r: Renderer, src: Texture, dst: Texture) {
    this.run(r, src, dst, 0, [0, 0]);
  }
  blur(r: Renderer, a: Texture, tmp: Texture, spread: number) {
    this.run(r, a, tmp, 1, [spread, 0]);
    this.run(r, tmp, a, 1, [0, spread]);
  }
}
