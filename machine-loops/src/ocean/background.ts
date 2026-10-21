// Full-screen underwater background: surface light, depth falloff, a rocky
// wall on the left, faint light rays. Pass 1 renders into an RGBA16F target;
// pass 2 adds +-1/255 triangular dither and writes the canvas.
const VERT = `#version 300 es
in vec2 p;
out vec2 vUv;
void main() { vUv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

const SCENE = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform vec2 res;
uniform float t;
float h(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float n2(vec2 x) {
  vec2 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 6; i++) { s += a * n2(p); p = p * 2.02 + 7.3; a *= 0.5; } return s; }
float ridged(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 6; i++) { s += a * (1.0 - abs(n2(p) * 2.0 - 1.0)); p = p * 2.1 + 3.1; a *= 0.5; } return s; }
vec3 srgb2lin(vec3 c) { return pow(c, vec3(2.2)); }
void main() {
  vec2 uv = vUv;            // 0..1, y up
  float aspect = res.x / res.y;
  vec2 q = vec2(uv.x * aspect, uv.y);
  float depth = 1.0 - uv.y;  // 0 at top
  vec3 top = srgb2lin(vec3(30.0, 106.0, 154.0) / 255.0);
  vec3 deep = srgb2lin(vec3(2.0, 6.0, 10.0) / 255.0);
  // surface glow centred a little right of centre, fading with depth
  vec2 gc = vec2(0.5 * aspect, 1.1);
  float gd = length((q - gc) * vec2(1.7, 1.15));
  float glow = exp(-gd * gd * 4.4);
  float fall = exp(-depth * 4.5);
  vec3 col = mix(deep, top, clamp(glow * 1.1 + fall * 0.08, 0.0, 1.0));
  col = mix(col, deep, smoothstep(0.3, 0.85, depth) * 0.85);
  // faint rays from the surface
  vec2 rp = q - vec2(0.5 * aspect, 1.25);
  float ang = atan(rp.x, -rp.y);
  float rays = fbm(vec2(ang * 9.0, t * 0.05)) * fbm(vec2(ang * 23.0 + 4.0, t * 0.08));
  col += top * rays * 0.22 * smoothstep(0.55, 0.0, depth) * glow;
  // rocky wall on the left
  float edge = 0.35 + 0.08 * (fbm(vec2(uv.y * 3.0, 1.7)) - 0.5) * 2.0 + 0.05 * (ridged(vec2(uv.y * 14.0, 0.3)) - 0.5) - 0.03 * uv.y;
  float wall = smoothstep(edge + 0.012, edge - 0.012, uv.x);
  // bump-lit rock: height from ridged noise, light from the surface (upper right)
  vec2 rq = q * vec2(2.6, 1.9) + vec2(0.0, 2.0);
  float e = 0.004;
  float hgt = ridged(rq) + 0.35 * fbm(rq * 3.1);
  float hx = ridged(rq + vec2(e * 4.2, 0.0)) + 0.35 * fbm((rq + vec2(e * 4.2, 0.0)) * 3.1);
  float hy = ridged(rq + vec2(0.0, e * 3.0)) + 0.35 * fbm((rq + vec2(0.0, e * 3.0)) * 3.1);
  vec3 nrm = normalize(vec3(-(hx - hgt) / e * 0.03, -(hy - hgt) / e * 0.03, 1.0));
  float diff = clamp(dot(nrm, normalize(vec3(0.45, 0.8, 0.5))), 0.0, 1.0);
  float cav = smoothstep(0.35, 0.95, hgt);
  float light = (0.32 + 2.2 * glow + 0.9 * fall) * (0.45 + 0.55 * smoothstep(0.0, edge, uv.x));
  float lit = clamp(pow(diff, 3.0) * smoothstep(0.25, 0.85, hgt) * light * 1.7, 0.0, 1.0);
  vec3 rockCol = mix(deep * 0.03, top * 0.62, lit * (0.35 + 0.65 * smoothstep(0.0, edge, uv.x)));
  // dark channel between the cliff and open water
  col *= 1.0 - 0.6 * smoothstep(0.09, 0.0, abs(uv.x - edge - 0.04));
  col = mix(col, rockCol, wall);
  // right side slightly darker
  col = mix(col, deep, smoothstep(0.45, 1.05, uv.x) * 0.8);
  o = vec4(col, 1.0);
}`;

const FINAL = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D tex;
float h(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 enc(vec3 c) { return mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main() {
  vec3 c = enc(max(texture(tex, vUv).rgb, 0.0));
  float n = h(gl_FragCoord.xy) + h(gl_FragCoord.xy + 17.17) - 1.0;
  o = vec4(clamp(c + n / 255.0, 0.0, 1.0), 1.0);
}`;

type GL = WebGL2RenderingContext;
const compile = (gl: GL, vs: string, fs: string) => {
  const mk = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
    return s;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link");
  return p;
};

export const createBackground = (canvas: HTMLCanvasElement) => {
  const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true, antialias: false, alpha: false })!;
  gl.getExtension("EXT_color_buffer_float");
  const scene = compile(gl, VERT, SCENE);
  const final = compile(gl, VERT, FINAL);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const w = canvas.width;
  const h = canvas.height;
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  const bindQuad = (p: WebGLProgram) => {
    gl.useProgram(p);
    const loc = gl.getAttribLocation(p, "p");
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  };
  return (time: number) => {
    gl.viewport(0, 0, w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    bindQuad(scene);
    gl.uniform2f(gl.getUniformLocation(scene, "res"), w, h);
    gl.uniform1f(gl.getUniformLocation(scene, "t"), time);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    bindQuad(final);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(gl.getUniformLocation(final, "tex"), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
  };
};
