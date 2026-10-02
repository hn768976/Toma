import React, { useLayoutEffect, useRef } from "react";
import { getRemotionEnvironment, useCurrentFrame, useVideoConfig } from "remotion";
import { GLSL_HASH } from "./three-setup";

// Signed film grain + dither for 2D/2.5D looks, as a fixed function of pixel
// position and frame. CSS blending can only add or subtract, so the noise is
// split into two layers: the positive half is added (plus-lighter) and the
// negative half is subtracted (difference, which is base - n while base > n).

const VERT = `#version 300 es
in vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
precision highp int;
uniform float frame;
uniform float grain;
uniform float sgn;
out vec4 o;
${GLSL_HASH}
void main() {
  uvec3 p = uvec3(uint(gl_FragCoord.x), uint(gl_FragCoord.y), uint(frame));
  float d = (rnd3(p) + rnd3(p + uvec3(7919u, 104729u, 31u)) - 1.0) / 255.0;
  float g = (rnd3(p + uvec3(1543u, 3079u, 911u)) - 0.5) * 2.0 * grain;
  float n = (d + g) * sgn;
  o = vec4(vec3(max(n, 0.0)), 1.0);
}`;

const dpr = () => {
  const d = window.devicePixelRatio || 1;
  return getRemotionEnvironment().isStudio ? Math.min(d, 1) : d;
};

const NoiseCanvas: React.FC<{ sign: 1 | -1; grain: number; blend: string; loop?: number }> = ({
  sign,
  grain,
  blend,
  loop,
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<{ gl: WebGL2RenderingContext; uFrame: WebGLUniformLocation } | null>(null);
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  useLayoutEffect(() => {
    const canvas = ref.current!;
    const r = dpr();
    canvas.width = Math.round(width * r);
    canvas.height = Math.round(height * r);
    const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true, antialias: false })!;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "");
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(gl.getUniformLocation(prog, "grain"), grain);
    gl.uniform1f(gl.getUniformLocation(prog, "sgn"), sign);
    gl.viewport(0, 0, canvas.width, canvas.height);
    glRef.current = { gl, uFrame: gl.getUniformLocation(prog, "frame")! };
  }, [width, height, grain, sign]);

  useLayoutEffect(() => {
    const g = glRef.current;
    if (!g) return;
    g.gl.uniform1f(g.uFrame, loop ? frame % loop : frame);
    g.gl.drawArrays(g.gl.TRIANGLES, 0, 3);
    g.gl.finish();
  }, [frame, loop]);

  return (
    <canvas
      ref={ref}
      style={{
        position: "absolute",
        inset: 0,
        width,
        height,
        mixBlendMode: blend as React.CSSProperties["mixBlendMode"],
        pointerEvents: "none",
      }}
    />
  );
};

export const GrainLayer: React.FC<{ grain: number; loop?: number }> = ({ grain, loop }) => (
  <>
    <NoiseCanvas sign={1} grain={grain} blend="plus-lighter" loop={loop} />
    <NoiseCanvas sign={-1} grain={grain} blend="difference" loop={loop} />
  </>
);
