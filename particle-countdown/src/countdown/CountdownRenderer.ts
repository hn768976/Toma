import { DIGITS, DISSOLVE_FRAMES, FORM_FRAMES, ambientLevel, isDigitActive, peakFrame } from "./timeline";
import { CountdownPalette } from "./palette";
import { REF_H, REF_W, mulberry32, sampleGlyph } from "./glyphs";
import {
  BLUR_FS,
  COMPOSITE_FS,
  DOWNSAMPLE_FS,
  FULLSCREEN_VS,
  PARTICLE_FS,
  PARTICLE_VS,
} from "./shaders";

// Particle budget per number (scaled with the glyph's ink area so "1" is as dense as "8").
const GLITTER_PER_100K_PX = 6500;
const EDGE_GLITTER = 4000;
const BOKEH = 380;
const HAZE = 46;
const AMBIENT = 240;

const KIND_GLITTER = 0;
const KIND_EDGE = 1;
const KIND_BOKEH = 2;
const KIND_HAZE = 3;
const KIND_AMBIENT = 4;

type Range = { first: number; count: number; centroid: [number, number] };

type Target = { fbo: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number };

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(`Shader compile error: ${gl.getShaderInfoLog(sh)}`);
  }
  return sh;
};

const program = (gl: WebGL2RenderingContext, vs: string, fs: string) => {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`Program link error: ${gl.getProgramInfoLog(p)}`);
  }
  return p;
};

/**
 * Raw WebGL 2 particle renderer. All particle motion is evaluated in the vertex
 * shader from static per-particle seeds + the frame number, so every frame is
 * a pure function of time (no simulation state), which keeps Remotion's
 * parallel / out-of-order rendering deterministic.
 */
export class CountdownRenderer {
  private gl: WebGL2RenderingContext;
  private particleProg: WebGLProgram;
  private downProg: WebGLProgram;
  private blurProg: WebGLProgram;
  private compProg: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private emptyVao: WebGLVertexArrayObject;
  private digitRanges: Range[] = [];
  private ambientRange: Range;
  private scene: Target;
  private bloomA: Target;
  private bloomB: Target;
  private bloomC: Target;
  private bloomD: Target;
  private uniforms = new Map<WebGLProgram, Map<string, WebGLUniformLocation | null>>();
  private maxPoint: number;

  constructor(
    canvas: HTMLCanvasElement,
    private width: number,
    private height: number,
    private palette: CountdownPalette,
  ) {
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: true,
      premultipliedAlpha: false,
      powerPreference: "high-performance",
    });
    if (!gl) throw new Error("WebGL 2 is not available");
    this.gl = gl;
    const floatOk = !!gl.getExtension("EXT_color_buffer_float");
    gl.getExtension("OES_texture_float_linear");
    const range = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array;
    this.maxPoint = range ? range[1] : 256;

    this.particleProg = program(gl, PARTICLE_VS, PARTICLE_FS);
    this.downProg = program(gl, FULLSCREEN_VS, DOWNSAMPLE_FS);
    this.blurProg = program(gl, FULLSCREEN_VS, BLUR_FS);
    this.compProg = program(gl, FULLSCREEN_VS, COMPOSITE_FS);

    // ---------- build particle buffers ----------
    const home: number[] = [];
    const seed: number[] = [];
    const kind: number[] = [];
    let n = 0;
    const push = (x: number, y: number, k: number, rand: () => number) => {
      home.push(x, y);
      seed.push(rand(), rand(), rand(), rand());
      kind.push(k);
      n++;
    };
    DIGITS.forEach((text, i) => {
      const rand = mulberry32(1000 + i * 7919);
      const inkCount = estimateInk(text);
      const count = Math.round((inkCount / 100000) * GLITTER_PER_100K_PX);
      const g = sampleGlyph(text, count, EDGE_GLITTER, 77 + i * 31);
      const first = n;
      for (let j = 0; j < count; j++) push(g.points[j * 2], g.points[j * 2 + 1], KIND_GLITTER, rand);
      for (let j = 0; j < EDGE_GLITTER; j++) push(g.edge[j * 2], g.edge[j * 2 + 1], KIND_EDGE, rand);
      for (let j = 0; j < BOKEH; j++) {
        const k = Math.floor(rand() * count);
        push(g.points[k * 2], g.points[k * 2 + 1], KIND_BOKEH, rand);
      }
      for (let j = 0; j < HAZE; j++) {
        const k = Math.floor(rand() * count);
        push(g.points[k * 2], g.points[k * 2 + 1], KIND_HAZE, rand);
      }
      this.digitRanges.push({ first, count: n - first, centroid: g.centroid });
    });
    {
      const rand = mulberry32(4242);
      const first = n;
      for (let j = 0; j < AMBIENT; j++) {
        push((rand() - 0.5) * REF_W * 1.05, (rand() - 0.5) * REF_H, KIND_AMBIENT, rand);
      }
      this.ambientRange = { first, count: n - first, centroid: [0, 0] };
    }

    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    const attrib = (loc: number, data: number[], size: number) => {
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };
    attrib(0, home, 2);
    attrib(1, seed, 4);
    attrib(2, kind, 1);
    gl.bindVertexArray(null);
    this.emptyVao = gl.createVertexArray()!;

    // ---------- render targets ----------
    const make = (w: number, h: number): Target => {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      if (floatOk) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      return { fbo, tex, w, h };
    };
    this.scene = make(width, height);
    const w4 = Math.max(1, Math.round(width / 4));
    const h4 = Math.max(1, Math.round(height / 4));
    const w16 = Math.max(1, Math.round(width / 16));
    const h16 = Math.max(1, Math.round(height / 16));
    this.bloomA = make(w4, h4);
    this.bloomB = make(w4, h4);
    this.bloomC = make(w16, h16);
    this.bloomD = make(w16, h16);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  private u(p: WebGLProgram, name: string) {
    let m = this.uniforms.get(p);
    if (!m) {
      m = new Map();
      this.uniforms.set(p, m);
    }
    if (!m.has(name)) m.set(name, this.gl.getUniformLocation(p, name));
    return m.get(name)!;
  }

  private bindTarget(t: Target | null) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fbo : null);
    gl.viewport(0, 0, t ? t.w : this.width, t ? t.h : this.height);
  }

  private fullscreen(prog: WebGLProgram) {
    const gl = this.gl;
    gl.useProgram(prog);
    gl.bindVertexArray(this.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private downsample(src: Target, dst: Target) {
    const gl = this.gl;
    this.bindTarget(dst);
    gl.useProgram(this.downProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, src.tex);
    gl.uniform1i(this.u(this.downProg, "uTex"), 0);
    gl.uniform2f(this.u(this.downProg, "uSrcTexel"), 1 / src.w, 1 / src.h);
    this.fullscreen(this.downProg);
  }

  private blur(src: Target, dst: Target, dx: number, dy: number) {
    const gl = this.gl;
    this.bindTarget(dst);
    gl.useProgram(this.blurProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, src.tex);
    gl.uniform1i(this.u(this.blurProg, "uTex"), 0);
    gl.uniform2f(this.u(this.blurProg, "uDir"), dx / src.w, dy / src.h);
    this.fullscreen(this.blurProg);
  }

  render(frame: number) {
    const gl = this.gl;
    const p = this.palette;
    gl.disable(gl.DEPTH_TEST);

    // ---------- particles (additive, linear light) ----------
    this.bindTarget(this.scene);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    const pr = this.particleProg;
    gl.useProgram(pr);
    gl.bindVertexArray(this.vao);
    gl.uniform1f(this.u(pr, "uFrame"), frame);
    gl.uniform2f(this.u(pr, "uRefSize"), REF_W, REF_H);
    gl.uniform1f(this.u(pr, "uPxScale"), this.height / REF_H);
    gl.uniform1f(this.u(pr, "uMaxPoint"), this.maxPoint);
    gl.uniform1f(this.u(pr, "uAmbient"), ambientLevel(frame));
    gl.uniform1f(this.u(pr, "uFormFrames"), FORM_FRAMES);
    gl.uniform1f(this.u(pr, "uDissolveFrames"), DISSOLVE_FRAMES - 12);
    gl.uniform3fv(this.u(pr, "uGlitterA"), p.glitterA);
    gl.uniform3fv(this.u(pr, "uGlitterB"), p.glitterB);
    gl.uniform3fv(this.u(pr, "uFlash"), p.flash);
    gl.uniform3fv(this.u(pr, "uAccent"), p.accents.flat());
    gl.uniform3fv(this.u(pr, "uHaze"), p.haze.flat());

    // ambient dust first (no peak)
    gl.uniform1f(this.u(pr, "uPeak"), -1000);
    gl.uniform2f(this.u(pr, "uCentroid"), 0, 0);
    gl.drawArrays(gl.POINTS, this.ambientRange.first, this.ambientRange.count);

    this.digitRanges.forEach((r, i) => {
      if (!isDigitActive(i, frame)) return;
      gl.uniform1f(this.u(pr, "uPeak"), peakFrame(i));
      gl.uniform2f(this.u(pr, "uCentroid"), r.centroid[0], r.centroid[1]);
      gl.drawArrays(gl.POINTS, r.first, r.count);
    });
    gl.disable(gl.BLEND);

    // ---------- bloom ----------
    this.downsample(this.scene, this.bloomA); // 1/4 (4x4 box via 2 bilinear stages)
    this.blur(this.bloomA, this.bloomB, 1.6, 0);
    this.blur(this.bloomB, this.bloomA, 0, 1.6);
    this.downsample(this.bloomA, this.bloomC); // 1/16
    this.blur(this.bloomC, this.bloomD, 1.8, 0);
    this.blur(this.bloomD, this.bloomC, 0, 1.8);

    // ---------- composite ----------
    this.bindTarget(null);
    const c = this.compProg;
    gl.useProgram(c);
    const tex = [this.scene.tex, this.bloomA.tex, this.bloomC.tex];
    ["uScene", "uBloom1", "uBloom2"].forEach((name, k) => {
      gl.activeTexture(gl.TEXTURE0 + k);
      gl.bindTexture(gl.TEXTURE_2D, tex[k]);
      gl.uniform1i(this.u(c, name), k);
    });
    gl.uniform2f(this.u(c, "uBloom"), p.bloom[0], p.bloom[1]);
    gl.uniform3fv(this.u(c, "uBg"), p.background);
    gl.uniform3fv(this.u(c, "uBgGlow"), p.backgroundGlow);
    gl.uniform2f(this.u(c, "uRes"), this.width, this.height);
    gl.uniform1f(this.u(c, "uFrame"), frame);
    this.fullscreen(c);
  }

  dispose() {
    const ext = this.gl.getExtension("WEBGL_lose_context");
    ext?.loseContext();
  }
}

/** Count glyph ink pixels on the sampling raster (cached per string). */
const inkCache = new Map<string, number>();
const estimateInk = (text: string) => {
  const cached = inkCache.get(text);
  if (cached) return cached;
  // sample with many points and measure coverage via a cheap grid
  const g = sampleGlyph(text, 40000, 1, 5);
  const cell = 8; // reference px
  const occupied = new Set<number>();
  for (let i = 0; i < g.points.length; i += 2) {
    occupied.add(Math.floor(g.points[i] / cell) * 100000 + Math.floor(g.points[i + 1] / cell));
  }
  const area = occupied.size * cell * cell;
  inkCache.set(text, area);
  return area;
};
