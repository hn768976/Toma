import { useLayoutEffect, useRef } from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { palettes, type PaletteName, type RGB } from "./palettes";
import { FRAGMENT_SHADER, VERTEX_SHADER } from "./shader";

export type NebulaCloudsProps = {
  palette: PaletteName;
};

type GlState = {
  gl: WebGL2RenderingContext;
  uniforms: Record<string, WebGLUniformLocation | null>;
};

const UNIFORMS = [
  "uAspect",
  "uTime",
  "uProgress",
  "uFrame",
  "uDeep",
  "uMid",
  "uLight",
  "uHaze",
  "uVein",
  "uWash",
  "uGlow",
] as const;

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

const initGl = (canvas: HTMLCanvasElement): GlState => {
  const gl = canvas.getContext("webgl2", {
    antialias: false,
    preserveDrawingBuffer: true,
    premultipliedAlpha: false,
  });
  if (!gl) throw new Error("WebGL 2 is not available");

  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Program link error: ${gl.getProgramInfoLog(program)}`);
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

  const uniforms: GlState["uniforms"] = {};
  for (const name of UNIFORMS) {
    uniforms[name] = gl.getUniformLocation(program, name);
  }
  return { gl, uniforms };
};

// The reference starts calm, churns faster through the middle and eases off
// in the last second. These keyframes are the cumulative amount of change
// measured per second in the reference (normalised to 0..1), so the noise
// clock follows the same pacing.
const PACING = [
  0, 0.021, 0.072, 0.132, 0.22, 0.306, 0.437, 0.619, 0.831, 0.933, 1,
];
const NOISE_CLOCK_RANGE = 58;

const noiseClock = (frame: number, fps: number) =>
  interpolate(
    frame / fps,
    PACING.map((_, i) => i),
    PACING,
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  ) * NOISE_CLOCK_RANGE;

export const NebulaClouds: React.FC<NebulaCloudsProps> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<GlState | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!glRef.current) glRef.current = initGl(canvas);
    const { gl, uniforms } = glRef.current;
    const colors = palettes[palette];

    const setColor = (name: string, c: RGB) =>
      gl.uniform3f(uniforms[name], c[0], c[1], c[2]);

    gl.viewport(0, 0, width, height);
    gl.uniform1f(uniforms.uAspect, width / height);
    gl.uniform1f(uniforms.uTime, noiseClock(frame, fps));
    gl.uniform1f(uniforms.uProgress, frame / (durationInFrames - 1));
    gl.uniform1f(uniforms.uFrame, frame);
    setColor("uDeep", colors.deep);
    setColor("uMid", colors.mid);
    setColor("uLight", colors.light);
    setColor("uHaze", colors.haze);
    setColor("uVein", colors.vein);
    setColor("uWash", colors.wash);
    setColor("uGlow", colors.glow);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
  }, [frame, width, height, fps, durationInFrames, palette]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%" }}
      />
    </AbsoluteFill>
  );
};
