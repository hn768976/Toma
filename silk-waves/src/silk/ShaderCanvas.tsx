import React, { useLayoutEffect, useRef } from "react";
import { useVideoConfig } from "remotion";

const VERTEX_SHADER = /* glsl */ `#version 300 es
// Full-screen triangle: no vertex buffer needed.
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

export type Uniforms = Record<string, number | readonly number[]>;

type GlState = {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  locations: Map<string, WebGLUniformLocation | null>;
};

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("createShader failed");
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`Shader compile error: ${gl.getShaderInfoLog(shader)}`);
  }
  return shader;
};

const setUniform = (
  gl: WebGL2RenderingContext,
  loc: WebGLUniformLocation | null,
  value: number | readonly number[],
) => {
  if (loc === null) return;
  if (typeof value === "number") {
    gl.uniform1f(loc, value);
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
      throw new Error(`Unsupported uniform length ${value.length}`);
  }
};

/**
 * Renders a GLSL ES 3.00 fragment shader into a canvas at the full
 * composition resolution (3840x2160 for the 4K compositions). Drawing is
 * synchronous inside useLayoutEffect, so every Remotion frame is fully
 * deterministic and ready before the screenshot is taken.
 * `u_resolution` (vec2) is always provided.
 */
export const ShaderCanvas: React.FC<{
  fragmentShader: string;
  uniforms: Uniforms;
}> = ({ fragmentShader, uniforms }) => {
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GlState | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", {
      preserveDrawingBuffer: true,
      antialias: false,
      alpha: false,
      premultipliedAlpha: false,
    });
    if (!gl) throw new Error("WebGL 2 is not available in this browser.");
    const program = gl.createProgram();
    if (!program) throw new Error("createProgram failed");
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentShader));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Program link error: ${gl.getProgramInfoLog(program)}`);
    }
    gl.bindVertexArray(gl.createVertexArray());
    stateRef.current = { gl, program, locations: new Map() };
    return () => {
      gl.deleteProgram(program);
      stateRef.current = null;
    };
  }, [fragmentShader]);

  useLayoutEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    const { gl, program, locations } = state;
    const loc = (name: string) => {
      if (!locations.has(name)) {
        locations.set(name, gl.getUniformLocation(program, name));
      }
      return locations.get(name) ?? null;
    };
    gl.viewport(0, 0, width, height);
    gl.useProgram(program);
    setUniform(gl, loc("u_resolution"), [width, height]);
    for (const [name, value] of Object.entries(uniforms)) {
      setUniform(gl, loc(name), value);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
  });

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width, height, display: "block" }}
    />
  );
};
