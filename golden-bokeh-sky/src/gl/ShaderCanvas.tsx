import React, { useLayoutEffect, useRef } from "react";
import { cancelRender } from "remotion";

export type Uniforms = Record<string, number | readonly number[]>;

type Props = {
  fragmentShader: string;
  width: number;
  height: number;
  uniforms: Uniforms;
};

const VERTEX_SHADER = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

type GLState = {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  locations: Map<string, WebGLUniformLocation | null>;
  lastKey: string;
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

const init = (canvas: HTMLCanvasElement, frag: string): GLState => {
  const gl = canvas.getContext("webgl2", {
    preserveDrawingBuffer: true,
    antialias: false,
    premultipliedAlpha: false,
    alpha: false,
  });
  if (!gl) throw new Error("WebGL2 is not available (render with --gl=swangle or --gl=angle)");
  const program = gl.createProgram();
  if (!program) throw new Error("createProgram failed");
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Program link error: ${gl.getProgramInfoLog(program)}`);
  }
  // One oversized triangle covers the whole viewport.
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  return { gl, program, locations: new Map(), lastKey: "" };
};

/**
 * Full-frame WebGL2 fragment-shader canvas. Draws synchronously on every
 * frame so Remotion's screenshot always captures the current frame.
 */
export const ShaderCanvas: React.FC<Props> = ({ fragmentShader, width, height, uniforms }) => {
  // The canvas is laid out at the composition size (3840x2160). Its backing
  // store follows the render scale (`--scale` sets devicePixelRatio), so a
  // native render shades every 4K pixel and a --scale=0.5 render shades
  // exactly the 1920x1080 output pixels. The shaders are resolution
  // independent, so the picture is the same at any scale.
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const bufferWidth = Math.round(width * dpr);
  const bufferHeight = Math.round(height * dpr);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GLState | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      if (!stateRef.current) stateRef.current = init(canvas, fragmentShader);
      const state = stateRef.current;
      const { gl, program, locations } = state;
      // Identical uniforms -> identical picture; the preserved drawing
      // buffer already holds it (e.g. held stop-motion frames).
      const key = JSON.stringify([bufferWidth, bufferHeight, uniforms]);
      if (key === state.lastKey) return;
      state.lastKey = key;
      gl.viewport(0, 0, bufferWidth, bufferHeight);
      gl.useProgram(program);
      const set = (name: string, value: number | readonly number[]) => {
        if (!locations.has(name)) locations.set(name, gl.getUniformLocation(program, name));
        const l = locations.get(name) ?? null;
        if (typeof value === "number") gl.uniform1f(l, value);
        else if (value.length === 2) gl.uniform2fv(l, value as number[]);
        else if (value.length === 3) gl.uniform3fv(l, value as number[]);
        else if (value.length === 4) gl.uniform4fv(l, value as number[]);
        else gl.uniform1fv(l, value as number[]);
      };
      set("uResolution", [bufferWidth, bufferHeight]);
      for (const [k, v] of Object.entries(uniforms)) set(k, v);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.finish();
    } catch (err) {
      cancelRender(err);
    }
  });

  return (
    <canvas
      ref={canvasRef}
      width={bufferWidth}
      height={bufferHeight}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
};
