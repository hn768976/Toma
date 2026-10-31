import React, { useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export type UniformValue = number | readonly number[];
export type Uniforms = Record<string, UniformValue>;

const VERTEX_SHADER = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

type GlState = {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  locations: Map<string, WebGLUniformLocation | null>;
};

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Could not create shader");
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error("Shader compile error:\n" + log);
  }
  return shader;
};

const createState = (canvas: HTMLCanvasElement, fragSrc: string): GlState => {
  const gl = canvas.getContext("webgl2", {
    // Keep the frame in the buffer so Remotion's screenshot always sees it.
    preserveDrawingBuffer: true,
    antialias: false,
    alpha: false,
    premultipliedAlpha: false,
    powerPreference: "high-performance",
  });
  if (!gl) throw new Error("WebGL 2 is not available in this browser");
  const program = gl.createProgram();
  if (!program) throw new Error("Could not create program");
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragSrc));
  gl.bindAttribLocation(program, 0, "aPos");
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error("Program link error:\n" + gl.getProgramInfoLog(program));
  }
  // Single full-screen triangle.
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.useProgram(program);
  return { gl, program, locations: new Map() };
};

const setUniform = (state: GlState, name: string, value: UniformValue) => {
  const { gl, program, locations } = state;
  if (!locations.has(name)) {
    locations.set(name, gl.getUniformLocation(program, name));
  }
  const loc = locations.get(name);
  if (!loc) return; // optimised out by the compiler
  if (typeof value === "number") {
    gl.uniform1f(loc, value);
    return;
  }
  if (value === undefined || value === null) {
    throw new Error(`Uniform ${name} is undefined`);
  }
  const arr = value as number[];
  if (arr.length === 2) gl.uniform2f(loc, arr[0], arr[1]);
  else if (arr.length === 3) gl.uniform3f(loc, arr[0], arr[1], arr[2]);
  else if (arr.length === 4) gl.uniform4f(loc, arr[0], arr[1], arr[2], arr[3]);
  else throw new Error(`Unsupported uniform size for ${name}`);
};

/**
 * Full-frame WebGL 2 fragment-shader canvas.
 *
 * The canvas backing store is exactly the composition size (3840x2160 for the
 * 4K compositions). Every frame is a pure function of the frame number, so
 * renders are deterministic and can run in parallel / out of order.
 *
 * Built-in uniforms: uRes (px), uFrame, uTime (s), uProgress (0..1).
 */
export const ShaderCanvas: React.FC<{
  fragmentShader: string;
  uniforms: Uniforms;
}> = ({ fragmentShader, uniforms }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GlState | null>(null);
  const [handle] = useState(() => delayRender("Compiling WebGL 2 shader"));

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
      setUniform(state, "uRes", [width, height]);
      setUniform(state, "uFrame", frame);
      setUniform(state, "uTime", frame / fps);
      setUniform(state, "uProgress", frame / Math.max(1, durationInFrames - 1));
      for (const [k, v] of Object.entries(uniforms)) setUniform(state, k, v);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      // Block until the GPU (or SwiftShader) is done so the screenshot is complete.
      gl.finish();
      continueRender(handle);
    } catch (err) {
      cancelRender(err);
    }
  }, [frame, width, height, fps, durationInFrames, uniforms, fragmentShader, handle]);

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
