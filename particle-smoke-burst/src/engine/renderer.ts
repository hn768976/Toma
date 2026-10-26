// WebGL 2 renderer for the smoke burst: additive filament segments into a
// half-float HDR buffer, a two-level bloom, then filmic tone mapping.

export type Camera = {
  eye: [number, number, number];
  target: [number, number, number];
  fovY: number; // degrees
};

const SEG_VS = `#version 300 es
in vec2 a_corner;      // x: 0..1 along segment, y: -1..1 across
in vec3 a_p0;
in vec3 a_p1;
in vec4 a_color;       // rgb * intensity, a = width scale
uniform mat4 u_viewProj;
uniform vec2 u_res;
uniform float u_width;
out vec3 v_color;
out float v_across;
void main() {
  vec4 c0 = u_viewProj * vec4(a_p0, 1.0);
  vec4 c1 = u_viewProj * vec4(a_p1, 1.0);
  if (c0.w < 0.1 || c1.w < 0.1) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec2 s0 = c0.xy / c0.w * 0.5 * u_res;
  vec2 s1 = c1.xy / c1.w * 0.5 * u_res;
  vec2 d = s1 - s0;
  float len = length(d);
  vec2 dir = len > 0.001 ? d / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float w = u_width * a_color.a;
  vec2 p = mix(s0, s1, a_corner.x) + dir * (a_corner.x * 2.0 - 1.0) * w * 0.5 + nrm * a_corner.y * w;
  gl_Position = vec4(p / (0.5 * u_res), 0.0, 1.0);
  // Keep total energy per unit length roughly independent of width, and
  // fade very long (over-stretched) segments.
  v_color = a_color.rgb / max(w, 1.0) * 2.0 / (1.0 + max(0.0, len - 60.0 * u_width * 0.5) * 0.004);
  v_across = a_corner.y;
}`;

const SEG_FS = `#version 300 es
precision highp float;
in vec3 v_color;
in float v_across;
out vec4 o;
void main() {
  float f = 1.0 - v_across * v_across;
  o = vec4(v_color * f * f, 1.0);
}`;

const QUAD_VS = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() { v_uv = a_pos * 0.5 + 0.5; gl_Position = vec4(a_pos, 0.0, 1.0); }`;

const DOWN_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_texel; // source texel size
out vec4 o;
void main() {
  vec3 c = texture(u_tex, v_uv + u_texel * vec2(-1.0, -1.0)).rgb
         + texture(u_tex, v_uv + u_texel * vec2( 1.0, -1.0)).rgb
         + texture(u_tex, v_uv + u_texel * vec2(-1.0,  1.0)).rgb
         + texture(u_tex, v_uv + u_texel * vec2( 1.0,  1.0)).rgb;
  o = vec4(c * 0.25, 1.0);
}`;

const BLUR_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_dir; // texel step
out vec4 o;
void main() {
  float w[5] = float[](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
  vec3 c = texture(u_tex, v_uv).rgb * w[0];
  for (int i = 1; i < 5; i++) {
    c += texture(u_tex, v_uv + u_dir * float(i) * 1.5).rgb * w[i];
    c += texture(u_tex, v_uv - u_dir * float(i) * 1.5).rgb * w[i];
  }
  o = vec4(c, 1.0);
}`;

const COMPOSITE_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_hdr;
uniform sampler2D u_glowA;
uniform sampler2D u_glowB;
uniform float u_exposure;
uniform float u_glow;
uniform vec3 u_background;
uniform float u_saturation;
out vec4 o;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec3 c = texture(u_hdr, v_uv).rgb;
  c += (texture(u_glowA, v_uv).rgb * 0.6 + texture(u_glowB, v_uv).rgb * 0.4) * u_glow;
  c *= u_exposure;
  // Per-channel exponential tone map, then pull very bright regions toward
  // white the way a camera sensor would.
  vec3 m = 1.0 - exp(-c);
  float l = max(max(c.r, c.g), c.b);
  m = mix(m, vec3(1.0 - exp(-l)), smoothstep(3.0, 10.0, l) * 0.25);
  float luma = dot(m, vec3(0.2126, 0.7152, 0.0722));
  m = max(mix(vec3(luma), m, u_saturation), 0.0);
  m += u_background;
  m += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  o = vec4(pow(clamp(m, 0.0, 1.0), vec3(0.95)), 1.0);
}`;

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(`Shader compile failed: ${gl.getShaderInfoLog(s)}`);
  }
  return s;
};

const program = (gl: WebGL2RenderingContext, vs: string, fs: string) => {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`Program link failed: ${gl.getProgramInfoLog(p)}`);
  }
  return p;
};

type Target = { fb: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number };

const makeTarget = (gl: WebGL2RenderingContext, w: number, h: number): Target => {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error("Half-float render target is not supported");
  }
  return { fb, tex, w, h };
};

// Column-major 4x4 helpers.
const perspective = (fovY: number, aspect: number, near: number, far: number) => {
  const f = 1 / Math.tan((fovY * Math.PI) / 360);
  const nf = 1 / (near - far);
  return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
};

const lookAt = (eye: number[], target: number[], up: number[]) => {
  let zx = eye[0] - target[0];
  let zy = eye[1] - target[1];
  let zz = eye[2] - target[2];
  let l = Math.hypot(zx, zy, zz);
  zx /= l; zy /= l; zz /= l;
  let xx = up[1] * zz - up[2] * zy;
  let xy = up[2] * zx - up[0] * zz;
  let xz = up[0] * zy - up[1] * zx;
  l = Math.hypot(xx, xy, xz);
  xx /= l; xy /= l; xz /= l;
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;
  return [
    xx, yx, zx, 0,
    xy, yy, zy, 0,
    xz, yz, zz, 0,
    -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
    -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
    -(zx * eye[0] + zy * eye[1] + zz * eye[2]),
    1,
  ];
};

const multiply = (a: number[], b: number[]) => {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
};

export type Look = {
  exposure: number;
  glow: number;
  background: [number, number, number]; // 0..1, added after tone mapping
  lineWidth: number; // in 4K pixels
  saturation: number; // applied after tone mapping, 1 = unchanged
};

export class SmokeRenderer {
  private gl: WebGL2RenderingContext;
  private segProg: WebGLProgram;
  private downProg: WebGLProgram;
  private blurProg: WebGLProgram;
  private compProg: WebGLProgram;
  private quadVao: WebGLVertexArrayObject;
  private segVao: WebGLVertexArrayObject;
  private segBuf: WebGLBuffer;
  private capacity = 0;
  private hdr: Target;
  private half: Target;
  private quarterA: Target;
  private quarterB: Target;
  private sixteenthA: Target;
  private sixteenthB: Target;

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) throw new Error("WebGL 2 is not available");
    if (!gl.getExtension("EXT_color_buffer_float")) {
      throw new Error("EXT_color_buffer_float is required");
    }
    this.gl = gl;
    this.segProg = program(gl, SEG_VS, SEG_FS);
    this.downProg = program(gl, QUAD_VS, DOWN_FS);
    this.blurProg = program(gl, QUAD_VS, BLUR_FS);
    this.compProg = program(gl, QUAD_VS, COMPOSITE_FS);

    const w = canvas.width;
    const h = canvas.height;
    this.hdr = makeTarget(gl, w, h);
    this.half = makeTarget(gl, w >> 1, h >> 1);
    this.quarterA = makeTarget(gl, w >> 2, h >> 2);
    this.quarterB = makeTarget(gl, w >> 2, h >> 2);
    this.sixteenthA = makeTarget(gl, w >> 4, h >> 4);
    this.sixteenthB = makeTarget(gl, w >> 4, h >> 4);

    this.quadVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.quadVao);
    const tri = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, tri);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    for (const p of [this.downProg, this.blurProg, this.compProg]) {
      const loc = gl.getAttribLocation(p, "a_pos");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    }

    this.segVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.segVao);
    const corners = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, corners);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, -1, 1, -1, 0, 1, 1, 1]), gl.STATIC_DRAW);
    const cl = gl.getAttribLocation(this.segProg, "a_corner");
    gl.enableVertexAttribArray(cl);
    gl.vertexAttribPointer(cl, 2, gl.FLOAT, false, 0, 0);
    this.segBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.segBuf);
    const attrs: [string, number, number][] = [
      ["a_p0", 3, 0],
      ["a_p1", 3, 12],
      ["a_color", 4, 24],
    ];
    for (const [name, size, offset] of attrs) {
      const loc = gl.getAttribLocation(this.segProg, name);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 40, offset);
      gl.vertexAttribDivisor(loc, 1);
    }
    gl.bindVertexArray(null);
  }

  private quadPass(prog: WebGLProgram, target: Target | null, setup: () => void) {
    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
    gl.viewport(0, 0, target ? target.w : this.canvas.width, target ? target.h : this.canvas.height);
    gl.useProgram(prog);
    setup();
    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private bindTex(prog: WebGLProgram, name: string, unit: number, tex: WebGLTexture) {
    const { gl } = this;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(gl.getUniformLocation(prog, name), unit);
  }

  // segments: 10 floats each (p0 xyz, p1 xyz, rgb*intensity, width scale).
  draw(segments: Float32Array, count: number, camera: Camera, look: Look) {
    const { gl, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;
    const scale = h / 2160;
    gl.disable(gl.DEPTH_TEST);

    // 1. Additive accumulation.
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.hdr.fb);
    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(this.segProg);
    const viewProj = multiply(
      perspective(camera.fovY, w / h, 0.1, 200),
      lookAt(camera.eye, camera.target, [0, 1, 0]),
    );
    gl.uniformMatrix4fv(gl.getUniformLocation(this.segProg, "u_viewProj"), false, viewProj);
    gl.uniform2f(gl.getUniformLocation(this.segProg, "u_res"), w, h);
    gl.uniform1f(gl.getUniformLocation(this.segProg, "u_width"), look.lineWidth * scale);
    gl.bindVertexArray(this.segVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.segBuf);
    if (count > this.capacity) {
      gl.bufferData(gl.ARRAY_BUFFER, segments.byteLength, gl.DYNAMIC_DRAW);
      this.capacity = segments.length / 10;
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, segments, 0, count * 10);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    gl.disable(gl.BLEND);

    // 2. Bloom: downsample chain + separable blurs at 1/4 and 1/16.
    const down = (src: Target, dst: Target) =>
      this.quadPass(this.downProg, dst, () => {
        this.bindTex(this.downProg, "u_tex", 0, src.tex);
        gl.uniform2f(gl.getUniformLocation(this.downProg, "u_texel"), 1 / src.w, 1 / src.h);
      });
    const blur = (src: Target, dst: Target, dx: number, dy: number) =>
      this.quadPass(this.blurProg, dst, () => {
        this.bindTex(this.blurProg, "u_tex", 0, src.tex);
        gl.uniform2f(gl.getUniformLocation(this.blurProg, "u_dir"), dx / src.w, dy / src.h);
      });
    down(this.hdr, this.half);
    down(this.half, this.quarterA);
    blur(this.quarterA, this.quarterB, 1, 0);
    blur(this.quarterB, this.quarterA, 0, 1);
    // 1/4 -> 1/16: taps two texels out so the 4x4 footprint is covered.
    this.quadPass(this.downProg, this.sixteenthA, () => {
      this.bindTex(this.downProg, "u_tex", 0, this.quarterA.tex);
      gl.uniform2f(gl.getUniformLocation(this.downProg, "u_texel"), 2 / this.quarterA.w, 2 / this.quarterA.h);
    });
    blur(this.sixteenthA, this.sixteenthB, 1, 0);
    blur(this.sixteenthB, this.sixteenthA, 0, 1);

    // 3. Composite + tone map to the canvas.
    this.quadPass(this.compProg, null, () => {
      this.bindTex(this.compProg, "u_hdr", 0, this.hdr.tex);
      this.bindTex(this.compProg, "u_glowA", 1, this.quarterA.tex);
      this.bindTex(this.compProg, "u_glowB", 2, this.sixteenthA.tex);
      gl.uniform1f(gl.getUniformLocation(this.compProg, "u_exposure"), look.exposure);
      gl.uniform1f(gl.getUniformLocation(this.compProg, "u_glow"), look.glow);
      gl.uniform3fv(gl.getUniformLocation(this.compProg, "u_background"), look.background);
      gl.uniform1f(gl.getUniformLocation(this.compProg, "u_saturation"), look.saturation);
    });
    gl.finish();
  }
}
