import React, { useLayoutEffect, useRef } from "react";
import { useVideoConfig } from "remotion";

export type UniformValue = number | [number, number] | [number, number, number];

const VERT = `#version 300 es
// Full-screen triangle, no vertex buffers needed.
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

type GlState = {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  locations: Map<string, WebGLUniformLocation | null>;
};

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to create shader");
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`Shader compile error: ${gl.getShaderInfoLog(shader)}`);
  }
  return shader;
};

/**
 * Renders a WebGL 2 fragment shader into a canvas whose backing store matches
 * the composition size exactly (3840x2160 for the 4K compositions).
 * The shader is redrawn synchronously for every frame Remotion requests, so the
 * output is fully deterministic.
 */
export const ShaderCanvas: React.FC<{
  fragmentShader: string;
  uniforms: Record<string, UniformValue>;
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
      premultipliedAlpha: false,
      alpha: false,
    });
    if (!gl) {
      throw new Error("WebGL 2 is not available in this browser.");
    }
    const program = gl.createProgram();
    if (!program) throw new Error("Unable to create program");
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fragmentShader);
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Program link error: ${gl.getProgramInfoLog(program)}`);
    }
    stateRef.current = { gl, program, locations: new Map() };
    return () => {
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      stateRef.current = null;
    };
  }, [fragmentShader]);

  useLayoutEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    const { gl, program, locations } = state;
    gl.viewport(0, 0, width, height);
    gl.useProgram(program);
    const set = (name: string, value: UniformValue) => {
      if (!locations.has(name)) {
        locations.set(name, gl.getUniformLocation(program, name));
      }
      const loc = locations.get(name) ?? null;
      if (loc === null) return;
      if (typeof value === "number") gl.uniform1f(loc, value);
      else if (value.length === 2) gl.uniform2f(loc, value[0], value[1]);
      else gl.uniform3f(loc, value[0], value[1], value[2]);
    };
    set("uResolution", [width, height]);
    for (const [k, v] of Object.entries(uniforms)) set(k, v);
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
