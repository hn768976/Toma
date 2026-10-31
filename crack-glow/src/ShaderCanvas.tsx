import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export type UniformValue = number | [number, number] | [number, number, number];
export type Uniforms = Record<string, UniformValue>;

const VERTEX_SHADER = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Could not create shader");
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error("Shader compile error: " + log);
  }
  return shader;
};

type GLState = {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  locations: Map<string, WebGLUniformLocation | null>;
};

/**
 * Full-frame WebGL 2 fragment-shader renderer.
 * The canvas backing store is the full composition resolution (e.g. 3840x2160),
 * every frame is drawn synchronously from `frame` so renders are deterministic
 * and can be parallelised by Remotion.
 */
export const ShaderCanvas: React.FC<{
  fragmentShader: string;
  uniforms: Uniforms;
  /** Backing-store scale. 1 = native composition resolution (final 4K renders). */
  internalScale?: number;
}> = ({ fragmentShader, uniforms, internalScale = 1 }) => {
  const frame = useCurrentFrame();
  const config = useVideoConfig();
  const fps = config.fps;
  const width = Math.round(config.width * internalScale);
  const height = Math.round(config.height * internalScale);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GLState | null>(null);
  const [initHandle] = useState(() => delayRender("Initialising WebGL2"));

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", {
      preserveDrawingBuffer: true,
      antialias: false,
      premultipliedAlpha: false,
      alpha: false,
    });
    if (!gl) throw new Error("WebGL2 is not available in this browser");
    const program = gl.createProgram();
    if (!program) throw new Error("Could not create program");
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentShader));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error("Program link error: " + gl.getProgramInfoLog(program));
    }
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const loc = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    stateRef.current = { gl, program, locations: new Map() };
    continueRender(initHandle);
    return () => {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      stateRef.current = null;
    };
  }, [fragmentShader, initHandle]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    const handle = delayRender(`Drawing frame ${frame}`);
    const { gl, program, locations } = state;
    gl.viewport(0, 0, width, height);
    gl.useProgram(program);
    const all: Uniforms = {
      uResolution: [width, height],
      uFrame: frame,
      uTime: frame / fps,
      ...uniforms,
    };
    for (const [name, value] of Object.entries(all)) {
      if (!locations.has(name)) {
        locations.set(name, gl.getUniformLocation(program, name));
      }
      const l = locations.get(name) ?? null;
      if (l === null) continue;
      if (typeof value === "number") gl.uniform1f(l, value);
      else if (value.length === 2) gl.uniform2f(l, value[0], value[1]);
      else gl.uniform3f(l, value[0], value[1], value[2]);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
    continueRender(handle);
  }, [frame, width, height, fps, uniforms]);

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
