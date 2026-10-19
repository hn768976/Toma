import { BLUE_NOISE, BLUE_NOISE_SIZE } from "./blueNoise";
import { FULLSCREEN_VS, HEADER, NOISE_GEN_FS, PAPER_GEN_FS, POST_FS, SCENE_COMMON } from "./glsl";

export type UniformValue =
  | number
  | readonly number[]
  | { type: "1fv" | "2fv" | "3fv" | "4fv"; value: Float32Array };

const NOISE_SIZE = 1024;

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    const numbered = src
      .split("\n")
      .map((l, i) => `${i + 1}: ${l}`)
      .join("\n");
    throw new Error(`Shader compile failed: ${log}\n${numbered}`);
  }
  return sh;
};

const link = (gl: WebGL2RenderingContext, fs: string) => {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, FULLSCREEN_VS));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, "aPos");
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`Link failed: ${gl.getProgramInfoLog(p)}`);
  return p;
};

type Prog = { prog: WebGLProgram; locs: Map<string, WebGLUniformLocation | null> };

/**
 * Two-pass WebGL2 compositor:
 *   scene shader -> RGBA16F target (linear light) -> post (grain + dither) -> canvas.
 * Static inputs (tiling noise, the paper sheet) are baked once per mount;
 * painted p5.brush layers are uploaded once; Rough.js canvases are
 * re-uploaded every frame. The whole frame is redrawn from scratch on
 * every call to render(), so output depends only on the frame number.
 */
export class Compositor {
  gl: WebGL2RenderingContext;
  private scene: Prog;
  private post: Prog;
  private textures = new Map<string, { tex: WebGLTexture; unit: number; target: number }>();
  private fbo: WebGLFramebuffer;
  private sceneTex: WebGLTexture;
  private nextUnit = 0;

  constructor(
    public canvas: HTMLCanvasElement,
    public comp: [number, number],
    sceneSrc: string,
    opts: { paperMargin?: number; paperSeed?: number; fibre?: number } = {},
  ) {
    const gl = canvas.getContext("webgl2", {
      preserveDrawingBuffer: true,
      antialias: false,
      premultipliedAlpha: false,
      alpha: false,
    });
    if (!gl) throw new Error("WebGL2 unavailable: render with --gl=angle (GPU) or --gl=swangle (CPU)");
    if (!gl.getExtension("EXT_color_buffer_float")) throw new Error("EXT_color_buffer_float unavailable");
    gl.getExtension("OES_texture_float_linear");
    this.gl = gl;
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.scene = { prog: link(gl, HEADER + SCENE_COMMON + sceneSrc), locs: new Map() };
    this.post = { prog: link(gl, POST_FS), locs: new Map() };

    // half-float scene target
    this.sceneTex = this.makeTarget(canvas.width, canvas.height, gl.RGBA16F, gl.HALF_FLOAT, false);
    this.fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.sceneTex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error("FBO incomplete");

    // blue noise
    const blue = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, blue);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, BLUE_NOISE_SIZE, BLUE_NOISE_SIZE, 0, gl.RED, gl.UNSIGNED_BYTE, BLUE_NOISE);
    this.nearest();
    this.register("uBlue", blue);

    // baked noise (mipmapped, repeating)
    const noise = this.bake(NOISE_GEN_FS, NOISE_SIZE, NOISE_SIZE, { uSize: [NOISE_SIZE, NOISE_SIZE] }, true);
    this.register("uNoise", noise);

    // baked paper, at render resolution plus a margin for camera drift
    const m = opts.paperMargin ?? 0.06;
    const pw = Math.min(8192, Math.round(canvas.width * (1 + 2 * m)));
    const ph = Math.min(8192, Math.round(canvas.height * (1 + 2 * m)));
    const paper = this.bake(
      PAPER_GEN_FS,
      pw,
      ph,
      { uSize: [pw, ph], uComp: comp, uMargin: m, uSeed: opts.paperSeed ?? 7, uFibre: opts.fibre ?? 1 },
      false,
    );
    this.register("uPaper", paper);
    this.paperMargin = m;
  }
  private paperMargin: number;

  private nearest() {
    const gl = this.gl;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  }

  private makeTarget(w: number, h: number, internal: number, type: number, repeat: boolean) {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, gl.RGBA, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    return t;
  }

  private bake(fs: string, w: number, h: number, uniforms: Record<string, UniformValue>, repeat: boolean) {
    const gl = this.gl;
    const t = this.makeTarget(w, h, gl.RGBA16F, gl.HALF_FLOAT, repeat);
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    const p: Prog = { prog: link(gl, fs), locs: new Map() };
    gl.useProgram(p.prog);
    for (const [k, v] of Object.entries(uniforms)) this.setUniform(p, k, v);
    gl.viewport(0, 0, w, h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb);
    if (repeat) {
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
    }
    return t;
  }

  private register(name: string, tex: WebGLTexture, target: number = WebGL2RenderingContext.TEXTURE_2D) {
    const existing = this.textures.get(name);
    if (existing) {
      existing.tex = tex;
      return;
    }
    this.textures.set(name, { tex, unit: this.nextUnit++, target });
  }

  /** Painted layer (grayscale PNG: white = bare paper). Stored as R8, mipmapped. */
  addImage(name: string, img: TexImageSource, opts: { repeat?: boolean } = {}) {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, gl.RED, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const wrap = opts.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    gl.generateMipmap(gl.TEXTURE_2D);
    this.register(name, t);
  }

  /** Several same-size painted layers as one sampler2DArray (R8, mipmapped). */
  addImageArray(name: string, imgs: TexImageSource[], w: number, h: number) {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.R8, w, h, imgs.length, 0, gl.RED, gl.UNSIGNED_BYTE, null);
    imgs.forEach((img, i) => gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, w, h, 1, gl.RED, gl.UNSIGNED_BYTE, img));
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    this.register(name, t, gl.TEXTURE_2D_ARRAY);
  }

  /** RGBA canvas (Rough.js output); call again every frame to re-upload. */
  setCanvas(name: string, src: TexImageSource, opts: { mipmap?: boolean } = {}) {
    const gl = this.gl;
    let entry = this.textures.get(name);
    if (!entry) {
      const t = gl.createTexture()!;
      this.register(name, t);
      entry = this.textures.get(name)!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, opts.mipmap ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    gl.bindTexture(gl.TEXTURE_2D, entry.tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); // premultiplied, so mips average correctly
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
    if (opts.mipmap) gl.generateMipmap(gl.TEXTURE_2D);
  }

  private setUniform(p: Prog, name: string, v: UniformValue) {
    const gl = this.gl;
    if (!p.locs.has(name)) p.locs.set(name, gl.getUniformLocation(p.prog, name));
    const loc = p.locs.get(name);
    if (!loc) return;
    if (typeof v === "number") gl.uniform1f(loc, v);
    else if ("type" in v) {
      if (v.type === "1fv") gl.uniform1fv(loc, v.value);
      if (v.type === "2fv") gl.uniform2fv(loc, v.value);
      if (v.type === "3fv") gl.uniform3fv(loc, v.value);
      if (v.type === "4fv") gl.uniform4fv(loc, v.value);
    } else if (v.length === 2) gl.uniform2f(loc, v[0], v[1]);
    else if (v.length === 3) gl.uniform3f(loc, v[0], v[1], v[2]);
    else if (v.length === 4) gl.uniform4f(loc, v[0], v[1], v[2], v[3]);
  }

  private bindTextures(p: Prog) {
    const gl = this.gl;
    for (const [name, { tex, unit, target }] of this.textures) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(target, tex);
      if (!p.locs.has(name)) p.locs.set(name, gl.getUniformLocation(p.prog, name));
      const loc = p.locs.get(name);
      if (loc) gl.uniform1i(loc, unit);
    }
  }

  render(frame: number, loop: number, uniforms: Record<string, UniformValue>, grain = 0.015) {
    const gl = this.gl;
    const { width, height } = this.canvas;
    const wrapped = ((frame % loop) + loop) % loop;
    // pass 1: scene -> half-float
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, width, height);
    gl.useProgram(this.scene.prog);
    this.bindTextures(this.scene);
    const base: Record<string, UniformValue> = {
      uComp: this.comp,
      uBasis: [3840, (3840 * this.comp[1]) / this.comp[0]],
      uRes: [width, height],
      uFrame: wrapped,
      uLoop: loop,
      uCam: [0, 0],
      uCamZoom: 1,
      uPaperMargin: this.paperMargin,
    };
    for (const [k, v] of Object.entries({ ...base, ...uniforms })) this.setUniform(this.scene, k, v);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // pass 2: post -> canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(this.post.prog);
    const unit = this.nextUnit;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, this.sceneTex);
    this.setUniformInt(this.post, "uScene", unit);
    const blue = this.textures.get("uBlue")!;
    gl.activeTexture(gl.TEXTURE0 + blue.unit);
    gl.bindTexture(gl.TEXTURE_2D, blue.tex);
    this.setUniformInt(this.post, "uBlue", blue.unit);
    this.setUniform(this.post, "uRes", [width, height]);
    this.setUniform(this.post, "uFrame", wrapped);
    this.setUniform(this.post, "uGrain", grain);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
  }

  private setUniformInt(p: Prog, name: string, v: number) {
    const gl = this.gl;
    if (!p.locs.has(name)) p.locs.set(name, gl.getUniformLocation(p.prog, name));
    const loc = p.locs.get(name);
    if (loc) gl.uniform1i(loc, v);
  }
}
