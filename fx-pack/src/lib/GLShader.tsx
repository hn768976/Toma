import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { useBacking } from "./backing";
import { GLSL_PRELUDE } from "./glsl";

export type Uniforms = Record<string, number | number[]>;

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

// Final pass: half-float image -> 8-bit canvas, with +-1/255 dither only where
// the image is above 2% brightness so exact black stays exactly 0.
const FINAL_FRAG = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uTex;
uniform int uFrame;
uniform vec2 uSoft;   // blur radius (backing px) x, y: tape/CRT softness; 0 = sharp
out vec4 outColor;
uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec2 res = vec2(textureSize(uTex, 0));
  vec2 uv = gl_FragCoord.xy / res;
  vec3 c = texture(uTex, uv).rgb;
  if (uSoft.x > 0.0 || uSoft.y > 0.0) {
    vec2 dx = vec2(uSoft.x, 0.0) / res;
    vec2 dy = vec2(0.0, uSoft.y) / res;
    c = c * 0.36
      + (texture(uTex, uv + dx).rgb + texture(uTex, uv - dx).rgb) * 0.2
      + (texture(uTex, uv + dy).rgb + texture(uTex, uv - dy).rgb) * 0.12;
  }
  c = clamp(c, 0.0, 1.0);
  if (max(c.r, max(c.g, c.b)) > 0.02) {
    uint h = pcg(uint(p.x) ^ pcg(uint(p.y) ^ pcg(uint(uFrame % 600))));
    float d = float(h >> 8) / 16777216.0 - 0.5;
    c = clamp(c + d * (2.0 / 255.0), 0.0, 1.0);
  }
  outColor = vec4(c, 1.0);
}`;

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    const numbered = src
      .split("\n")
      .map((l, i) => `${i + 1}: ${l}`)
      .join("\n");
    throw new Error(`Shader compile failed: ${log}\n${numbered}`);
  }
  return s;
};

const link = (gl: WebGL2RenderingContext, frag: string) => {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, frag));
  gl.bindAttribLocation(p, 0, "aPos");
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`Program link failed: ${gl.getProgramInfoLog(p)}`);
  }
  return p;
};

type GLState = {
  gl: WebGL2RenderingContext;
  main: WebGLProgram;
  final: WebGLProgram;
  fbo: WebGLFramebuffer;
  tex: WebGLTexture;
};

/**
 * Full-screen fragment shader, rendered into a half-float target and resolved
 * to the canvas with a brightness-gated dither. `body` is GLSL appended to the
 * shared prelude and must define `void main()` writing `outColor`.
 */
export const GLShader: React.FC<{
  body: string;
  uniforms?: (frame: number) => Uniforms;
  /** final-pass softness in 4K px (x, y) */
  soft?: [number, number];
}> = ({ body, uniforms, soft = [0, 0] }) => {
  const frame = useCurrentFrame();
  const { bw, bh, k } = useBacking();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GLState | null>(null);
  const source = useMemo(() => GLSL_PRELUDE + body, [body]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current!;
    let st = stateRef.current;
    if (!st) {
      const gl = canvas.getContext("webgl2", {
        preserveDrawingBuffer: true,
        antialias: false,
        alpha: false,
        premultipliedAlpha: false,
      });
      if (!gl) throw new Error("WebGL2 unavailable: render with --gl=angle");
      const halfFloat = !!gl.getExtension("EXT_color_buffer_float");
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(
        gl.TEXTURE_2D, 0, halfFloat ? gl.RGBA16F : gl.RGBA8, bw, bh, 0, gl.RGBA,
        halfFloat ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null,
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      st = { gl, main: link(gl, source), final: link(gl, FINAL_FRAG), fbo, tex };
      stateRef.current = st;
    }
    const { gl, main, final, fbo, tex } = st;

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, bw, bh);
    gl.useProgram(main);
    gl.uniform2f(gl.getUniformLocation(main, "uRes"), bw, bh);
    gl.uniform1f(gl.getUniformLocation(main, "uK"), k);
    gl.uniform1i(gl.getUniformLocation(main, "uFrame"), frame);
    const extra = uniforms ? uniforms(frame) : {};
    for (const [key, v] of Object.entries(extra)) {
      // "v4:name" uploads a flat number[] as a vec4 array
      const isVec4Array = key.startsWith("v4:");
      const name = isVec4Array ? key.slice(3) : key;
      const loc = gl.getUniformLocation(main, name);
      if (!loc) continue;
      if (typeof v === "number") gl.uniform1f(loc, v);
      else if (isVec4Array) gl.uniform4fv(loc, v);
      else if (v.length === 2) gl.uniform2fv(loc, v);
      else if (v.length === 3) gl.uniform3fv(loc, v);
      else if (v.length === 4) gl.uniform4fv(loc, v);
      else gl.uniform1fv(loc, v);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(final);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(gl.getUniformLocation(final, "uTex"), 0);
    gl.uniform1i(gl.getUniformLocation(final, "uFrame"), frame);
    gl.uniform2f(gl.getUniformLocation(final, "uSoft"), soft[0] * k, soft[1] * k);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
  }, [frame, bw, bh, k, source, uniforms, soft]);

  return (
    <AbsoluteFill>
      <canvas ref={canvasRef} width={bw} height={bh} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};
