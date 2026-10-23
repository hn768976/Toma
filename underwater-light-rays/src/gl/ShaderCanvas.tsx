import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

export type Uniforms = Record<string, number | readonly number[]>;

type Props = {
  fragmentShader: string;
  // Extra uniforms on top of the built-in uTime / uFrame / uResolution.
  uniforms?: Uniforms;
};

// Full-screen triangle generated from gl_VertexID, so no vertex buffers.
const VERTEX_SHADER = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

type GlState = {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  locations: Map<string, WebGLUniformLocation | null>;
};

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Could not create shader");
  }
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`Shader compile error: ${gl.getShaderInfoLog(shader)}`);
  }
  return shader;
};

const createState = (canvas: HTMLCanvasElement, fragment: string): GlState => {
  const gl = canvas.getContext("webgl2", {
    // Keep the frame in the buffer so Remotion's screenshot captures it.
    preserveDrawingBuffer: true,
    antialias: false,
    alpha: false,
    premultipliedAlpha: false,
  });
  if (!gl) {
    throw new Error(
      "WebGL 2 is not available. Render with --gl=angle (default in remotion.config.ts) or --gl=swangle.",
    );
  }
  const program = gl.createProgram();
  if (!program) {
    throw new Error("Could not create WebGL program");
  }
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Program link error: ${gl.getProgramInfoLog(program)}`);
  }
  gl.bindVertexArray(gl.createVertexArray());
  return { gl, program, locations: new Map() };
};

const setUniform = (state: GlState, name: string, value: number | readonly number[]) => {
  const { gl, program, locations } = state;
  if (!locations.has(name)) {
    locations.set(name, gl.getUniformLocation(program, name));
  }
  const loc = locations.get(name) ?? null;
  if (loc === null) {
    return;
  }
  if (typeof value === "number") {
    gl.uniform1f(loc, value);
  } else if (value.length === 2) {
    gl.uniform2f(loc, value[0], value[1]);
  } else if (value.length === 3) {
    gl.uniform3f(loc, value[0], value[1], value[2]);
  } else if (value.length === 4) {
    gl.uniform4f(loc, value[0], value[1], value[2], value[3]);
  }
};

/**
 * Draws a fragment shader across the full composition. Every frame is a pure
 * function of the frame number, so renders are deterministic and can be split
 * across any number of render workers.
 */
export const ShaderCanvas: React.FC<Props> = ({ fragmentShader, uniforms }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GlState | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    if (!stateRef.current) {
      stateRef.current = createState(canvas, fragmentShader);
    }
    const state = stateRef.current;
    const { gl } = state;
    gl.viewport(0, 0, width, height);
    gl.useProgram(state.program);
    setUniform(state, "uResolution", [width, height]);
    setUniform(state, "uTime", frame / fps);
    setUniform(state, "uFrame", frame);
    for (const [name, value] of Object.entries(uniforms ?? {})) {
      setUniform(state, name, value);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
  }, [frame, fps, width, height, fragmentShader, uniforms]);

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
