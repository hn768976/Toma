/**
 * WebGL2 depth-of-field ink renderer.
 *
 * The blurred image of a strand is the sharp strand convolved with a Gaussian.
 * Convolution is linear, so the blurred polyline is exactly the SUM of its
 * blurred segments – and for a straight segment of width w and length L the
 * Gaussian convolution factorises into erf terms:
 *
 *   across(d) = ½·[erf((d + w/2)/(√2σ)) − erf((d − w/2)/(√2σ))]
 *   along(x)  = ½·[erf(x/(√2σ)) − erf((x − L)/(√2σ))]
 *
 * Pass 1 adds across·along for every segment into a float "ink density"
 * buffer (additive blending, so joints sum seamlessly and strand ends fade
 * softly). Width and σ are interpolated along each segment, so blur changes
 * continuously where a strand passes through the focal plane.
 * Pass 2 turns density into ink with Beer–Lambert absorption,
 * T = exp(−κ·D): overlapping sheets darken like real ink.
 */

const SEG_VS = `#version 300 es
in vec2 aPos;    // pixel position of this quad corner
in vec4 aSeg;    // segment end points A.xy, B.xy (px)
in vec4 aProf;   // width at A, width at B, sigma at A, sigma at B (px)
uniform vec2 uRes;
out vec2 vPos;
flat out vec4 vSeg;
flat out vec4 vProf;
void main() {
  vPos = aPos;
  vSeg = aSeg;
  vProf = aProf;
  gl_Position = vec4(aPos.x / uRes.x * 2.0 - 1.0, 1.0 - aPos.y / uRes.y * 2.0, 0.0, 1.0);
}`;

const ERF = `
float erf_(float x) {
  // Abramowitz–Stegun 7.1.26, |error| < 1.5e-7
  float s = sign(x);
  x = abs(x);
  float t = 1.0 / (1.0 + 0.3275911 * x);
  float y = 1.0 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * exp(-x * x);
  return s * y;
}`;

const SEG_FS = `#version 300 es
precision highp float;
in vec2 vPos;
flat in vec4 vSeg;
flat in vec4 vProf;
out vec4 o;
${ERF}
void main() {
  vec2 A = vSeg.xy, B = vSeg.zw;
  vec2 ab = B - A;
  float L = max(length(ab), 1e-4);
  vec2 u = ab / L;
  vec2 n = vec2(-u.y, u.x);
  vec2 ap = vPos - A;
  float x = dot(ap, u);
  float d = dot(ap, n);
  float t = clamp(x / L, 0.0, 1.0);
  float w = mix(vProf.x, vProf.y, t);
  float s = max(mix(vProf.z, vProf.w, t), 0.45); // >= ~half a pixel: analytic AA
  float k = 0.70710678 / s;
  float across = 0.5 * (erf_((d + 0.5 * w) * k) - erf_((d - 0.5 * w) * k));
  float along = 0.5 * (erf_(x * k) - erf_((x - L) * k));
  float c = across * along;
  if (c < 1e-4) discard;
  o = vec4(c, 0.0, 0.0, 1.0);
}`;

const QUAD_VS = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const RESOLVE_FS = `#version 300 es
precision highp float;
uniform sampler2D uDensity;
uniform vec3 uInk;
uniform float uKappa;
out vec4 o;
void main() {
  float D = texelFetch(uDensity, ivec2(gl_FragCoord.xy), 0).r;
  float ink = 1.0 - exp(-uKappa * D);
  o = vec4(mix(vec3(1.0), uInk, ink), 1.0);
}`;

const STRIDE = 10; // floats per vertex

export type StrandVertex = { x: number; y: number; w: number; s: number };

export class InkRenderer {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private segProg: WebGLProgram;
  private resolveProg: WebGLProgram;
  private segVao: WebGLVertexArrayObject;
  private quadVao: WebGLVertexArrayObject;
  private segBuf: WebGLBuffer;
  private fbo: WebGLFramebuffer;
  private densityTex: WebGLTexture;
  private data = new Float32Array(1 << 20);

  constructor(width: number, height: number) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    const gl = this.canvas.getContext("webgl2", {
      antialias: false,
      preserveDrawingBuffer: true,
      premultipliedAlpha: false,
      alpha: false,
    });
    if (!gl) throw new Error("WebGL2 is not available");
    this.gl = gl;
    if (!gl.getExtension("EXT_color_buffer_float")) {
      throw new Error("EXT_color_buffer_float is required for the ink density buffer");
    }
    const program = (vs: string, fs: string) => {
      const sh = (type: number, src: string) => {
        const s = gl.createShader(type)!;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
        return s;
      };
      const p = gl.createProgram()!;
      gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
      gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link");
      return p;
    };
    this.segProg = program(SEG_VS, SEG_FS);
    this.resolveProg = program(QUAD_VS, RESOLVE_FS);

    // segment quads
    this.segVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.segVao);
    this.segBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.segBuf);
    const attr = (name: string, size: number, offset: number) => {
      const loc = gl.getAttribLocation(this.segProg, name);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, STRIDE * 4, offset * 4);
    };
    attr("aPos", 2, 0);
    attr("aSeg", 4, 2);
    attr("aProf", 4, 6);

    // full-screen triangle
    this.quadVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.quadVao);
    const qb = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, qb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const ql = gl.getAttribLocation(this.resolveProg, "aPos");
    gl.enableVertexAttribArray(ql);
    gl.vertexAttribPointer(ql, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    // float density target
    this.densityTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.densityTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, width, height, 0, gl.RED, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    this.fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.densityTex, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error("Float framebuffer incomplete");
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /**
   * Renders polylines (screen px, per-vertex width and blur sigma) and resolves
   * them into a transmission image on `this.canvas` (white = no ink).
   * `opacity` is the darkness of a single in-focus strand.
   */
  render(strands: StrandVertex[][], ink: [number, number, number], opacity: number) {
    const gl = this.gl;
    const W = this.canvas.width;
    const H = this.canvas.height;

    let n = 0;
    const ensure = (k: number) => {
      if (n + k > this.data.length) {
        const bigger = new Float32Array(Math.max(this.data.length * 2, n + k));
        bigger.set(this.data.subarray(0, n));
        this.data = bigger;
      }
    };
    const seg = new Float32Array(8);
    const corner = (x: number, y: number) => {
      this.data[n++] = x;
      this.data[n++] = y;
      this.data.set(seg, n);
      n += 8;
    };

    for (const pts of strands) {
      for (let i = 0; i < pts.length - 1; i++) {
        const P = pts[i], Q = pts[i + 1];
        const dx = Q.x - P.x, dy = Q.y - P.y;
        const L = Math.hypot(dx, dy);
        if (L < 1e-6) continue;
        // the profile is negligible beyond w/2 + 3.5σ
        const ext = Math.max(0.5 * P.w + 3.5 * Math.max(P.s, 0.45), 0.5 * Q.w + 3.5 * Math.max(Q.s, 0.45)) + 1;
        if ((P.x < -ext && Q.x < -ext) || (P.x > W + ext && Q.x > W + ext)) continue;
        if ((P.y < -ext && Q.y < -ext) || (P.y > H + ext && Q.y > H + ext)) continue;
        seg.set([P.x, P.y, Q.x, Q.y, P.w, Q.w, P.s, Q.s]);
        const ux = dx / L, uy = dy / L;
        const nx = -uy, ny = ux;
        const ax = P.x - ux * ext, ay = P.y - uy * ext;
        const bx = Q.x + ux * ext, by = Q.y + uy * ext;
        ensure(6 * STRIDE);
        corner(ax + nx * ext, ay + ny * ext);
        corner(ax - nx * ext, ay - ny * ext);
        corner(bx + nx * ext, by + ny * ext);
        corner(bx + nx * ext, by + ny * ext);
        corner(ax - nx * ext, ay - ny * ext);
        corner(bx - nx * ext, by - ny * ext);
      }
    }

    // pass 1: accumulate ink density
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(this.segProg);
    gl.uniform2f(gl.getUniformLocation(this.segProg, "uRes"), W, H);
    gl.bindVertexArray(this.segVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.segBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.subarray(0, n), gl.STREAM_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, n / STRIDE);

    // pass 2: density -> transmission
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.disable(gl.BLEND);
    gl.useProgram(this.resolveProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.densityTex);
    gl.uniform1i(gl.getUniformLocation(this.resolveProg, "uDensity"), 0);
    gl.uniform3f(gl.getUniformLocation(this.resolveProg, "uInk"), ink[0], ink[1], ink[2]);
    // a single in-focus strand (D = 1) reaches exactly `opacity`
    gl.uniform1f(gl.getUniformLocation(this.resolveProg, "uKappa"), -Math.log(1 - Math.min(opacity, 0.999)));
    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.finish();
  }
}
