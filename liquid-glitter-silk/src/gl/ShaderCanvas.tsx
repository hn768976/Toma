import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";
import { FRAGMENT_SHADER, VERTEX_SHADER } from "./shader";

export type Uniforms = Record<string, number | readonly number[]>;

type GLState = {
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

const init = (canvas: HTMLCanvasElement): GLState => {
  const gl = canvas.getContext("webgl2", {
    preserveDrawingBuffer: true, // Remotion screenshots the canvas after draw
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
  });
  if (!gl) throw new Error("WebGL2 is not available");
  const program = gl.createProgram();
  if (!program) throw new Error("createProgram failed");
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Program link error: ${gl.getProgramInfoLog(program)}`);
  }
  gl.useProgram(program);

  // Full-screen triangle
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  return { gl, program, locations: new Map() };
};

const setUniform = (state: GLState, name: string, value: number | readonly number[]) => {
  const { gl, program, locations } = state;
  if (!locations.has(name)) locations.set(name, gl.getUniformLocation(program, name));
  const loc = locations.get(name) ?? null;
  if (loc === null) return;
  if (typeof value === "number") gl.uniform1f(loc, value);
  else if (value.length === 2) gl.uniform2f(loc, value[0], value[1]);
  else if (value.length === 3) gl.uniform3f(loc, value[0], value[1], value[2]);
  else if (value.length === 4) gl.uniform4f(loc, value[0], value[1], value[2], value[3]);
};

/**
 * Full-frame WebGL2 canvas. Draws synchronously whenever `uniforms` change, so
 * every Remotion frame is deterministic and fully rendered before capture.
 */
export const ShaderCanvas: React.FC<{
  width: number;
  height: number;
  uniforms: Uniforms;
}> = ({ width, height, uniforms }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GLState | null>(null);
  const [handle] = useState(() => delayRender("Initialising WebGL2"));

  const draw = useCallback(() => {
    const state = stateRef.current;
    if (!state) return;
    const { gl } = state;
    gl.viewport(0, 0, width, height);
    setUniform(state, "uRes", [width, height]);
    for (const [k, v] of Object.entries(uniforms)) setUniform(state, k, v);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
  }, [uniforms, width, height]);

  useEffect(() => {
    try {
      if (canvasRef.current && !stateRef.current) {
        stateRef.current = init(canvasRef.current);
      }
      draw();
      continueRender(handle);
    } catch (err) {
      cancelRender(err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    draw();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
};
