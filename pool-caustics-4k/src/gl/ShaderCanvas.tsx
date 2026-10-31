import { useLayoutEffect, useRef, useState } from "react";
import {
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/**
 * Full-frame WebGL 2 fragment-shader renderer driven purely by the Remotion
 * frame number, so every frame is deterministic and can be rendered in any
 * order / in parallel.
 *
 * The canvas backing store is always the composition size (3840x2160 for the
 * 4K compositions); Remotion's `--scale` flag downsamples it at export time.
 */

const VERTEX_SHADER = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export type Uniforms = Record<string, number | readonly number[]>;

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
    throw new Error(`Shader compile error:\n${log}`);
  }
  return shader;
};

const createState = (
  canvas: HTMLCanvasElement,
  fragmentSource: string,
): GlState => {
  const gl = canvas.getContext("webgl2", {
    preserveDrawingBuffer: true,
    antialias: false,
    alpha: false,
    premultipliedAlpha: false,
  });
  if (!gl) throw new Error("WebGL 2 is not available in this browser");

  const program = gl.createProgram();
  if (!program) throw new Error("Could not create program");
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Program link error:\n${gl.getProgramInfoLog(program)}`);
  }
  gl.useProgram(program);

  // One oversized triangle covers the whole viewport.
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const aPos = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  return { gl, program, locations: new Map() };
};

const setUniform = (state: GlState, name: string, value: Uniforms[string]) => {
  const { gl, program, locations } = state;
  if (!locations.has(name)) {
    locations.set(name, gl.getUniformLocation(program, name));
  }
  const loc = locations.get(name);
  if (loc === null || loc === undefined) return;
  if (typeof value === "number") {
    gl.uniform1f(loc, value);
    return;
  }
  const v = value as number[];
  if (v.length === 2) gl.uniform2f(loc, v[0], v[1]);
  else if (v.length === 3) gl.uniform3f(loc, v[0], v[1], v[2]);
  else if (v.length === 4) gl.uniform4f(loc, v[0], v[1], v[2], v[3]);
  else throw new Error(`Unsupported uniform length for ${name}`);
};

export const ShaderCanvas: React.FC<{
  fragmentShader: string;
  uniforms: Uniforms;
}> = ({ fragmentShader, uniforms }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GlState | null>(null);
  const [handle] = useState(() => delayRender("Initialising WebGL 2"));

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      if (!stateRef.current) {
        stateRef.current = createState(canvas, fragmentShader);
        continueRender(handle);
      }
      const state = stateRef.current;
      const { gl } = state;
      gl.viewport(0, 0, width, height);
      setUniform(state, "uResolution", [width, height]);
      setUniform(state, "uTime", frame / fps);
      setUniform(state, "uFrame", frame);
      setUniform(state, "uProgress", frame / Math.max(1, durationInFrames - 1));
      for (const [name, value] of Object.entries(uniforms)) {
        setUniform(state, name, value);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.finish();
    } catch (err) {
      cancelRender(err);
    }
  }, [frame, fps, width, height, durationInFrames, fragmentShader, uniforms, handle]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ width, height, display: "block" }}
    />
  );
};
