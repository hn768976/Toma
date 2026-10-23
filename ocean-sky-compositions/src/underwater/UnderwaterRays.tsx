import { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { FRAGMENT_SHADER, VERTEX_SHADER } from "./shader";
import { UnderwaterPalette } from "./palettes";

type GlState = {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
};

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? "shader compile failed");
  }
  return shader;
};

const UNIFORMS = [
  "uRes",
  "uTime",
  "uSun",
  "uHorizon",
  "uSurface",
  "uHighlight",
  "uUpper",
  "uMid",
  "uDeep",
  "uAbyss",
  "uFloor",
  "uRay",
  "uRayStrength",
] as const;

const init = (canvas: HTMLCanvasElement): GlState => {
  const gl = canvas.getContext("webgl2", {
    preserveDrawingBuffer: true,
    antialias: false,
  });
  if (!gl) {
    throw new Error("WebGL 2 is not available");
  }
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? "program link failed");
  }
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const loc = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uniforms: GlState["uniforms"] = {};
  for (const name of UNIFORMS) {
    uniforms[name] = gl.getUniformLocation(program, name);
  }
  return { gl, program, uniforms };
};

export type UnderwaterRaysProps = {
  palette: UnderwaterPalette;
};

export const UnderwaterRays: React.FC<UnderwaterRaysProps> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GlState | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!stateRef.current) {
      stateRef.current = init(canvas);
    }
    const { gl, program, uniforms: u } = stateRef.current;
    gl.viewport(0, 0, width, height);
    gl.useProgram(program);
    gl.uniform2f(u.uRes, width, height);
    gl.uniform1f(u.uTime, frame / fps);
    gl.uniform2f(u.uSun, palette.sun[0], palette.sun[1]);
    gl.uniform1f(u.uHorizon, palette.horizon);
    gl.uniform3fv(u.uSurface, palette.surface);
    gl.uniform3fv(u.uHighlight, palette.highlight);
    gl.uniform3fv(u.uUpper, palette.upper);
    gl.uniform3fv(u.uMid, palette.mid);
    gl.uniform3fv(u.uDeep, palette.deep);
    gl.uniform3fv(u.uAbyss, palette.abyss);
    gl.uniform3fv(u.uFloor, palette.floor);
    gl.uniform3fv(u.uRay, palette.ray);
    gl.uniform1f(u.uRayStrength, palette.rayStrength);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
  }, [frame, fps, width, height, palette]);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%" }}
      />
    </AbsoluteFill>
  );
};
