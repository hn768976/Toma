import { useLayoutEffect, useRef } from "react";
import { continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import { Palette } from "../palette";

// Volumetric "holographic smoke" rendered with a WebGL 2 fragment shader:
// domain-warped fBm noise, animated purely from uTime so every frame is
// deterministic. Rendered at the composition's full resolution.

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uCol;
uniform vec3 uHi;
uniform float uFade;
out vec4 outColor;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * noise(p); p = r * p * 2.03 + 11.7; a *= 0.5; }
  return v / 0.875;
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  uv.y = 1.0 - uv.y;
  vec2 p = vec2(uv.x * uRes.x / uRes.y, uv.y);
  float t = uTime;
  // A fixed number of large, soft cloud masses drifting on slow Lissajous
  // paths keeps the overall coverage steady (like the reference), while
  // domain-warped fBm gives them their folded, smoky texture.
  float m = 0.0;
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    vec2 base = vec2(fract(fi * 0.618 + 0.13) * 1.9 - 0.05, fract(fi * 0.382 + 0.71));
    // bias the masses toward a diagonal band (lower-left -> upper-right)
    base.y = mix(base.y, 0.85 - base.x * 0.42, 0.55);
    vec2 c = base + vec2(sin(t * (0.07 + 0.02 * fi) + fi * 2.1), cos(t * (0.06 + 0.017 * fi) + fi * 1.3)) * vec2(0.22, 0.14);
    float rad = 0.20 + 0.09 * fract(fi * 0.73);
    vec2 dd = p - c;
    m += exp(-dot(dd, dd) / (rad * rad));
  }
  vec2 q = vec2(fbm(p * 1.4 + t * 0.03), fbm(p * 1.4 + vec2(5.2, 1.3) - t * 0.025));
  float detail = fbm(p * 1.7 + 1.6 * q + vec2(t * 0.04, -t * 0.02));
  float d = m * (0.1 + 1.45 * detail);
  d = smoothstep(0.12, 1.6, d);
  d = pow(d, 1.25);
  // slow luminous pulsing of the whole cloud bank
  float pulse = 0.85 + 0.15 * sin(t * 0.55) + 0.08 * sin(t * 1.3 + 1.7);
  vec3 c = mix(uCol, uHi, smoothstep(0.45, 1.0, d)) * d * 0.68 * pulse;
  // vignette keeps the frame edges darker, like the reference
  vec2 v = uv - 0.5;
  c *= 1.0 - dot(v, v) * 1.1;
  c *= uFade;
  // dithering avoids banding in the very dark gradients
  c += (hash(gl_FragCoord.xy + t) - 0.5) / 255.0;
  outColor = vec4(max(c, 0.0), 1.0);
}`;

type GLState = {
  gl: WebGL2RenderingContext;
  uRes: WebGLUniformLocation | null;
  uTime: WebGLUniformLocation | null;
  uCol: WebGLUniformLocation | null;
  uHi: WebGLUniformLocation | null;
  uFade: WebGLUniformLocation | null;
};

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(s) ?? "shader compile error");
  }
  return s;
};

export const SmokeLayer: React.FC<{ palette: Palette }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const st = useRef<GLState | null>(null);

  useLayoutEffect(() => {
    const gl = ref.current!.getContext("webgl2", { preserveDrawingBuffer: true, antialias: false });
    if (!gl) throw new Error("WebGL 2 is not available. Render with --gl=swangle or --gl=angle.");
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "link error");
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    st.current = {
      gl,
      uRes: gl.getUniformLocation(prog, "uRes"),
      uTime: gl.getUniformLocation(prog, "uTime"),
      uCol: gl.getUniformLocation(prog, "uCol"),
      uHi: gl.getUniformLocation(prog, "uHi"),
      uFade: gl.getUniformLocation(prog, "uFade"),
    };
    return () => {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      st.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const s = st.current;
    if (!s) return;
    const handle = delayRender(`smoke ${frame}`);
    const { gl } = s;
    gl.viewport(0, 0, width, height);
    gl.uniform2f(s.uRes, width, height);
    gl.uniform1f(s.uTime, frame / fps + 4.0);
    gl.uniform3f(s.uCol, ...palette.smoke);
    gl.uniform3f(s.uHi, ...palette.smokeHi);
    gl.uniform1f(s.uFade, 1.0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
    continueRender(handle);
  }, [frame, fps, width, height, palette]);

  return <canvas ref={ref} width={width} height={height} style={{ position: "absolute", inset: 0, width, height }} />;
};
