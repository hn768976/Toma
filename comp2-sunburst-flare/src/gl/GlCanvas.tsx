import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";

/**
 * A full-frame WebGL 2 canvas that runs one fragment shader per Remotion frame.
 *
 * Rendering is fully deterministic: the shader receives only the uniforms
 * passed in by the caller (which are derived from the frame number), so every
 * frame can be rendered in isolation, in any order, on any Remotion worker.
 *
 * Resolution: the composition is authored at 3840x2160. The canvas backing
 * store is sized to `composition size x devicePixelRatio` (capped at 1), so
 *   - `remotion render` (scale 1)          -> 3840x2160 native 4K pixels
 *   - `remotion render --scale=0.5`        -> 1920x1080 native pixels (no
 *                                             wasted 4K shading, no resample)
 */

export type UniformValue = number | readonly number[] | Float32Array;
export type Uniforms = Record<string, UniformValue>;

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

type GlState = {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  locations: Map<string, { loc: WebGLUniformLocation | null; type: number; size: number }>;
};

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("GlCanvas: createShader failed");
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error("GlCanvas: shader compile error\n" + log);
  }
  return shader;
};

const init = (canvas: HTMLCanvasElement, frag: string): GlState => {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  if (!gl) {
    // Fail loudly: a silent fallback would produce black frames.
    throw new Error(
      "GlCanvas: WebGL 2 is not available. Render with --gl=angle or --gl=swangle.",
    );
  }
  const program = gl.createProgram();
  if (!program) throw new Error("GlCanvas: createProgram failed");
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, frag));
  gl.bindAttribLocation(program, 0, "aPos");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error("GlCanvas: link error\n" + gl.getProgramInfoLog(program));
  }
  gl.useProgram(program);

  // One oversized triangle covering the viewport.
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const locations: GlState["locations"] = new Map();
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    if (!info) continue;
    const name = info.name.replace(/\[0\]$/, "");
    locations.set(name, {
      loc: gl.getUniformLocation(program, info.name),
      type: info.type,
      size: info.size,
    });
  }
  return { gl, program, locations };
};

const setUniform = (state: GlState, name: string, value: UniformValue) => {
  const entry = state.locations.get(name);
  if (!entry || !entry.loc) return; // optimised away by the compiler
  const { gl } = state;
  const v = typeof value === "number" ? [value] : value;
  switch (entry.type) {
    case gl.FLOAT:
      gl.uniform1fv(entry.loc, v as Float32List);
      break;
    case gl.FLOAT_VEC2:
      gl.uniform2fv(entry.loc, v as Float32List);
      break;
    case gl.FLOAT_VEC3:
      gl.uniform3fv(entry.loc, v as Float32List);
      break;
    case gl.FLOAT_VEC4:
      gl.uniform4fv(entry.loc, v as Float32List);
      break;
    case gl.INT:
      gl.uniform1iv(entry.loc, v as Int32List);
      break;
    default:
      throw new Error(`GlCanvas: unsupported uniform type for ${name}`);
  }
};

export const GlCanvas: React.FC<{ fragment: string; uniforms: Uniforms }> = ({
  fragment,
  uniforms,
}) => {
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GlState | null>(null);

  const dpr =
    typeof window === "undefined" ? 1 : Math.min(1, Math.max(0.25, window.devicePixelRatio || 1));
  const bw = Math.round(width * dpr);
  const bh = Math.round(height * dpr);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!stateRef.current) stateRef.current = init(canvas, fragment);
    const state = stateRef.current;
    const { gl } = state;
    gl.viewport(0, 0, bw, bh);
    setUniform(state, "uRes", [bw, bh]);
    for (const [k, v] of Object.entries(uniforms)) setUniform(state, k, v);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas ref={canvasRef} width={bw} height={bh} style={{ width, height, display: "block" }} />
    </AbsoluteFill>
  );
};
