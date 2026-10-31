import { useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/**
 * Minimal WebGL 2 full-screen fragment-shader renderer.
 *
 * The canvas is always allocated at the composition's native size
 * (3840x2160 for the 4K compositions), and every frame is drawn
 * synchronously and deterministically from `frame` alone, so the
 * output is identical regardless of render order / concurrency.
 */

/** number -> float, [a,b]/[a,b,c]/[a,b,c,d] -> vecN, {vec4Array} -> vec4[] */
export type UniformValue =
  | number
  | readonly number[]
  | { readonly vec4Array: Float32Array };
export type Uniforms = Record<string, UniformValue>;

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

type GlState = {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  locations: Map<string, WebGLUniformLocation | null>;
};

const compile = (
  gl: WebGL2RenderingContext,
  type: number,
  src: string,
): WebGLShader => {
  const sh = gl.createShader(type);
  if (!sh) throw new Error("createShader failed");
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error("Shader compile error: " + log);
  }
  return sh;
};

const setUniform = (
  gl: WebGL2RenderingContext,
  loc: WebGLUniformLocation | null,
  value: UniformValue,
) => {
  if (loc === null) return;
  if (typeof value === "number") {
    gl.uniform1f(loc, value);
    return;
  }
  if ("vec4Array" in value) {
    gl.uniform4fv(loc, value.vec4Array);
    return;
  }
  switch (value.length) {
    case 2:
      gl.uniform2f(loc, value[0], value[1]);
      break;
    case 3:
      gl.uniform3f(loc, value[0], value[1], value[2]);
      break;
    case 4:
      gl.uniform4f(loc, value[0], value[1], value[2], value[3]);
      break;
    default:
      throw new Error("Unsupported uniform length " + value.length);
  }
};

export const ShaderCanvas: React.FC<{
  fragmentShader: string;
  uniforms: Uniforms;
}> = ({ fragmentShader, uniforms }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GlState | null>(null);
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const [handle] = useState(() => delayRender("Compiling WebGL2 shader"));

  // One-time GL setup.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", {
      preserveDrawingBuffer: true,
      antialias: false,
      alpha: false,
      premultipliedAlpha: false,
      powerPreference: "high-performance",
    });
    if (!gl) {
      throw new Error(
        "WebGL 2 is not available. Render with --gl=swangle (CPU) or --gl=angle (GPU).",
      );
    }
    const program = gl.createProgram();
    if (!program) throw new Error("createProgram failed");
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentShader));
    gl.bindAttribLocation(program, 0, "aPos");
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error("Program link error: " + gl.getProgramInfoLog(program));
    }
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    stateRef.current = { gl, program, locations: new Map() };
    continueRender(handle);
    return () => {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      stateRef.current = null;
    };
  }, [fragmentShader, handle]);

  // Per-frame draw (synchronous, deterministic).
  useLayoutEffect(() => {
    const st = stateRef.current;
    if (!st) return;
    const { gl, program, locations } = st;
    const loc = (name: string) => {
      if (!locations.has(name)) {
        locations.set(name, gl.getUniformLocation(program, name));
      }
      return locations.get(name) ?? null;
    };
    gl.viewport(0, 0, width, height);
    gl.useProgram(program);
    setUniform(gl, loc("uResolution"), [width, height]);
    setUniform(gl, loc("uFrame"), frame);
    setUniform(gl, loc("uTime"), frame / fps);
    for (const [k, v] of Object.entries(uniforms)) {
      setUniform(gl, loc(k), v);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
  }, [frame, fps, width, height, uniforms]);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
