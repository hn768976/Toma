import React, { useLayoutEffect, useRef } from "react";
import {
  AbsoluteFill,
  cancelRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export type UniformValue = number | readonly number[];

type GlState = {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  locations: Map<string, WebGLUniformLocation | null>;
};

const VERTEX_SHADER = /* glsl */ `#version 300 es
in vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const compile = (
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Could not create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error:\n${log}`);
  }
  return shader;
};

const createState = (
  canvas: HTMLCanvasElement,
  fragmentSource: string,
): GlState => {
  const gl = canvas.getContext("webgl2", {
    // Required so Remotion's screenshot sees the frame we drew.
    preserveDrawingBuffer: true,
    antialias: false,
    alpha: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance",
  });
  if (!gl) throw new Error("WebGL 2 is not available in this browser");

  const program = gl.createProgram();
  if (!program) throw new Error("Could not create WebGL program");
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentSource));
  gl.bindAttribLocation(program, 0, "aPos");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Program link error:\n${gl.getProgramInfoLog(program)}`);
  }
  gl.useProgram(program);

  // One oversized triangle covering the whole viewport.
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  return { gl, program, locations: new Map() };
};

const setUniform = (state: GlState, name: string, value: UniformValue) => {
  const { gl, program, locations } = state;
  if (!locations.has(name)) {
    locations.set(name, gl.getUniformLocation(program, name));
  }
  const loc = locations.get(name) ?? null;
  if (loc === null) return; // optimised away by the compiler
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
      throw new Error(`Unsupported uniform size for ${name}`);
  }
};

/**
 * Full-frame WebGL 2 fragment shader layer.
 *
 * The canvas backing store always matches the composition size (3840x2160),
 * so the shader is evaluated at native 4K. Rendering with `--scale=0.5`
 * downsamples that 4K image to 1080p (2x2 supersampling).
 *
 * Every frame is a pure function of `uTime = frame / fps`, so frames can be
 * rendered in any order / in parallel and stay deterministic.
 */
export const ShaderCanvas: React.FC<{
  fragmentShader: string;
  uniforms: Record<string, UniformValue>;
}> = ({ fragmentShader, uniforms }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GlState | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      if (!stateRef.current) {
        stateRef.current = createState(canvas, fragmentShader);
      }
      const state = stateRef.current;
      const { gl } = state;
      gl.viewport(0, 0, width, height);
      setUniform(state, "uResolution", [width, height]);
      setUniform(state, "uTime", frame / fps);
      for (const [name, value] of Object.entries(uniforms)) {
        setUniform(state, name, value);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      // Block until the GPU (or SwiftShader) has really produced the pixels.
      // Drawing is fully synchronous inside this layout effect, so no
      // delayRender() is needed: the frame is complete before capture.
      gl.finish();
    } catch (err) {
      cancelRender(err);
    }
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
