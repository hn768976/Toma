import { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

export type UniformValue = number | readonly number[];

type Props = {
  fragmentShader: string;
  uniforms: Record<string, UniformValue>;
  /**
   * Internal drawing-buffer scale relative to the composition size.
   * 1 = native (e.g. full 3840x2160 for the 4K compositions).
   */
  renderScale?: number;
};

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
    throw new Error(`Shader compile error: ${gl.getShaderInfoLog(shader)}`);
  }
  return shader;
};

const createState = (canvas: HTMLCanvasElement, frag: string): GlState => {
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
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Program link error: ${gl.getProgramInfoLog(program)}`);
  }
  // Full-screen triangle.
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
  return { gl, program, locations: new Map() };
};

const setUniform = (state: GlState, name: string, value: UniformValue) => {
  const { gl, program, locations } = state;
  if (!locations.has(name)) {
    locations.set(name, gl.getUniformLocation(program, name));
  }
  const location = locations.get(name);
  if (!location) return;
  if (typeof value === "number") {
    gl.uniform1f(location, value);
    return;
  }
  const arr = new Float32Array(value);
  if (arr.length === 2) gl.uniform2fv(location, arr);
  else if (arr.length === 3) gl.uniform3fv(location, arr);
  else if (arr.length === 4) gl.uniform4fv(location, arr);
  else gl.uniform1fv(location, arr);
};

/**
 * Renders a full-frame WebGL2 fragment shader, synchronously, once per
 * Remotion frame. The shader receives `uResolution` (px) and `uTime` (s)
 * plus any custom uniforms. Rendering is deterministic: it depends only on
 * the current frame, never on wall-clock time.
 */
export const ShaderCanvas: React.FC<Props> = ({
  fragmentShader,
  uniforms,
  renderScale = 1,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GlState | null>(null);
  const pxW = Math.round(width * renderScale);
  const pxH = Math.round(height * renderScale);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!stateRef.current) {
      stateRef.current = createState(canvas, fragmentShader);
    }
    const state = stateRef.current;
    const { gl } = state;
    gl.viewport(0, 0, pxW, pxH);
    gl.useProgram(state.program);
    setUniform(state, "uResolution", [pxW, pxH]);
    setUniform(state, "uTime", frame / fps);
    for (const [name, value] of Object.entries(uniforms)) {
      setUniform(state, name, value);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <canvas
        ref={canvasRef}
        width={pxW}
        height={pxH}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
