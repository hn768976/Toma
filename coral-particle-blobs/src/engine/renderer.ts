import { TAN_HALF_FOV_Y } from "./field";

export type RGB = [number, number, number];

export type Look = {
  palette: RGB[]; // dark -> light, 0..255 sRGB
  backgroundCenter: RGB;
  backgroundEdge: RGB;
  fogColor: RGB;
  focusDistance: number;
  // Circle of confusion in 4K pixels per unit of |1/focus - 1/z|.
  cocStrength: number;
};

const BG_VS = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const BG_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform vec3 u_center;
uniform vec3 u_edge;
uniform float u_aspect;
out vec4 o;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 d = (v_uv - vec2(0.46, 0.6)) * vec2(u_aspect, 1.0);
  float r = length(d) / 1.25;
  vec3 c = mix(u_center, u_edge, smoothstep(0.0, 1.0, r));
  c += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  o = vec4(c, 1.0);
}`;

const P_VS = `#version 300 es
in vec2 a_corner;
in vec4 a_posRad;
in vec4 a_color;
uniform vec2 u_res;
uniform float u_focal;
uniform float u_focusInv;
uniform float u_cocScale;
uniform float u_maxCoc;
uniform float u_zFogStart;
uniform float u_zFogEnd;
out vec2 v_local;
out float v_R;
out float v_coc;
out vec3 v_color;
out float v_fog;
out float v_near;
void main() {
  vec3 p = a_posRad.xyz;
  float z = max(p.z, 0.5);
  vec2 c = vec2(p.x, -p.y) / z * u_focal + u_res * 0.5;
  float R = a_posRad.w / z * u_focal;
  float coc = min(u_maxCoc, u_cocScale * abs(u_focusInv - 1.0 / z));
  float h = R + coc * 0.5 + 1.5;
  v_local = a_corner * h;
  vec2 px = c + v_local;
  vec2 ndc = px / u_res * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
  if (p.z < 0.6) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  v_R = R;
  v_coc = coc;
  v_color = a_color.rgb;
  v_fog = smoothstep(u_zFogStart, u_zFogEnd, z) * 0.3;
  // Fade out anything drifting closer than the field's near edge.
  v_near = smoothstep(3.3, 4.3, z);
}`;

const P_FS = `#version 300 es
precision highp float;
in vec2 v_local;
in float v_R;
in float v_coc;
in vec3 v_color;
in float v_fog;
in float v_near;
uniform vec3 u_fogColor;
uniform vec3 u_light;
out vec4 o;
void main() {
  float d = length(v_local);
  float edge = max(0.5 * v_coc, 0.75);
  float a = 1.0 - smoothstep(v_R - edge, v_R + edge, d);
  if (a <= 0.002) discard;
  a *= sqrt(v_R / (v_R + 0.5 * v_coc)) * v_near;
  vec2 uv = v_local / max(v_R, 0.001);
  float r2 = min(dot(uv, uv), 1.0);
  float nz = sqrt(1.0 - r2);
  vec3 n = normalize(vec3(uv.x, -uv.y, -nz - 0.0001));
  float ndl = dot(n, u_light);
  float wrap = clamp((ndl + 0.4) / 1.4, 0.0, 1.0);
  float shade = 0.6 + 0.5 * wrap;
  float contact = mix(0.74, 1.0, smoothstep(0.0, 0.7, nz));
  vec3 hv = normalize(u_light + vec3(0.0, 0.0, -1.0));
  float spec = pow(max(dot(n, hv), 0.0), 30.0) * 0.16;
  float blur = clamp(v_coc / (2.2 * v_R), 0.0, 1.0);
  float s = mix(shade * contact, 0.93, blur);
  vec3 col = v_color * s + spec * (1.0 - blur);
  col = mix(col, u_fogColor, v_fog);
  o = vec4(col * a, a);
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

const toLinear01 = (c: RGB) => c.map((v) => v / 255) as RGB;

export const samplePalette = (palette: RGB[], t: number): RGB => {
  const x = Math.min(0.9999, Math.max(0, t)) * (palette.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = palette[i];
  const b = palette[i + 1];
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
};

export class BlobRenderer {
  private gl: WebGL2RenderingContext;
  private bgProg: WebGLProgram;
  private pProg: WebGLProgram;
  private bgVao: WebGLVertexArrayObject;
  private pVao: WebGLVertexArrayObject;
  private instanceBuf: WebGLBuffer;
  private capacity = 0;

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
    });
    if (!gl) throw new Error("WebGL 2 is not available");
    this.gl = gl;
    this.bgProg = program(gl, BG_VS, BG_FS);
    this.pProg = program(gl, P_VS, P_FS);

    this.bgVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.bgVao);
    const tri = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, tri);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const bgLoc = gl.getAttribLocation(this.bgProg, "a_pos");
    gl.enableVertexAttribArray(bgLoc);
    gl.vertexAttribPointer(bgLoc, 2, gl.FLOAT, false, 0, 0);

    this.pVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.pVao);
    const quad = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const cLoc = gl.getAttribLocation(this.pProg, "a_corner");
    gl.enableVertexAttribArray(cLoc);
    gl.vertexAttribPointer(cLoc, 2, gl.FLOAT, false, 0, 0);
    this.instanceBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuf);
    const pr = gl.getAttribLocation(this.pProg, "a_posRad");
    const co = gl.getAttribLocation(this.pProg, "a_color");
    gl.enableVertexAttribArray(pr);
    gl.vertexAttribPointer(pr, 4, gl.FLOAT, false, 32, 0);
    gl.vertexAttribDivisor(pr, 1);
    gl.enableVertexAttribArray(co);
    gl.vertexAttribPointer(co, 4, gl.FLOAT, false, 32, 16);
    gl.vertexAttribDivisor(co, 1);
    gl.bindVertexArray(null);
  }

  // instances: 8 floats per particle (x, y, z, radius, r, g, b, unused),
  // already sorted back to front.
  draw(instances: Float32Array, count: number, look: Look) {
    const { gl, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;
    const scale = h / 2160;
    gl.viewport(0, 0, w, h);
    gl.disable(gl.DEPTH_TEST);

    gl.disable(gl.BLEND);
    gl.useProgram(this.bgProg);
    gl.uniform3fv(gl.getUniformLocation(this.bgProg, "u_center"), toLinear01(look.backgroundCenter));
    gl.uniform3fv(gl.getUniformLocation(this.bgProg, "u_edge"), toLinear01(look.backgroundEdge));
    gl.uniform1f(gl.getUniformLocation(this.bgProg, "u_aspect"), w / h);
    gl.bindVertexArray(this.bgVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.pProg);
    const u = (n: string) => gl.getUniformLocation(this.pProg, n);
    gl.uniform2f(u("u_res"), w, h);
    gl.uniform1f(u("u_focal"), h / 2 / TAN_HALF_FOV_Y);
    gl.uniform1f(u("u_focusInv"), 1 / look.focusDistance);
    gl.uniform1f(u("u_cocScale"), look.cocStrength * scale);
    gl.uniform1f(u("u_maxCoc"), 90 * scale);
    gl.uniform1f(u("u_zFogStart"), 9.0);
    gl.uniform1f(u("u_zFogEnd"), 15.0);
    gl.uniform3fv(u("u_fogColor"), toLinear01(look.fogColor));
    const l = [-0.42, 0.72, -0.55];
    const ll = Math.hypot(l[0], l[1], l[2]);
    gl.uniform3f(u("u_light"), l[0] / ll, l[1] / ll, l[2] / ll);
    gl.bindVertexArray(this.pVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuf);
    if (count > this.capacity) {
      gl.bufferData(gl.ARRAY_BUFFER, instances.byteLength, gl.DYNAMIC_DRAW);
      this.capacity = instances.length / 8;
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, instances, 0, count * 8);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    gl.bindVertexArray(null);
    gl.finish();
  }
}
