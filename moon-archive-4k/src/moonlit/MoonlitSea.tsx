import { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { FRAGMENT_SHADER, VERTEX_SHADER } from "./shader";

export type MoonPalette = {
  pink: string;
  salmon: string;
  blue: string;
  lavender: string;
  horizon: string;
  waterTop: string;
  waterLow: string;
  moon: string;
  glow: string;
};

// Sampled from the reference footage (pink / periwinkle dusk).
export const REFERENCE_PALETTE: MoonPalette = {
  pink: "#ec8ccd",
  salmon: "#d67b98",
  blue: "#6c6cf5",
  lavender: "#b276d6",
  horizon: "#bd79ac",
  waterTop: "#b4627c",
  waterLow: "#c47aa8",
  moon: "#fff3f7",
  glow: "#ffd9ef",
};

// Alternative: teal night sky with amber clouds and a golden moon.
export const TEAL_AMBER_PALETTE: MoonPalette = {
  pink: "#f4b26c",
  salmon: "#e08a5a",
  blue: "#0f6f86",
  lavender: "#2f86a0",
  horizon: "#7fa8a6",
  waterTop: "#3d6672",
  waterLow: "#1f5868",
  moon: "#fff1cf",
  glow: "#ffd28a",
};

const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

type GlState = {
  gl: WebGL2RenderingContext;
  uniforms: Record<string, WebGLUniformLocation | null>;
};

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(`Shader compile failed: ${gl.getShaderInfoLog(sh)}`);
  }
  return sh;
};

const initGl = (canvas: HTMLCanvasElement): GlState => {
  const gl = canvas.getContext("webgl2", {
    preserveDrawingBuffer: true,
    antialias: false,
  });
  if (!gl) {
    throw new Error("WebGL2 is not available");
  }
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`Program link failed: ${gl.getProgramInfoLog(prog)}`);
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const loc = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const names = [
    "uRes",
    "uTime",
    "uPink",
    "uSalmon",
    "uBlue",
    "uLavender",
    "uHorizon",
    "uWaterTop",
    "uWaterLow",
    "uMoon",
    "uGlow",
  ];
  const uniforms: GlState["uniforms"] = {};
  for (const n of names) {
    uniforms[n] = gl.getUniformLocation(prog, n);
  }
  return { gl, uniforms };
};

export const MoonlitSea: React.FC<{ palette: MoonPalette }> = ({
  palette,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GlState | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!stateRef.current) {
      stateRef.current = initGl(canvas);
    }
    const { gl, uniforms: u } = stateRef.current;
    gl.viewport(0, 0, width, height);
    gl.uniform2f(u.uRes, width, height);
    gl.uniform1f(u.uTime, frame / fps);
    gl.uniform3fv(u.uPink, hexToRgb(palette.pink));
    gl.uniform3fv(u.uSalmon, hexToRgb(palette.salmon));
    gl.uniform3fv(u.uBlue, hexToRgb(palette.blue));
    gl.uniform3fv(u.uLavender, hexToRgb(palette.lavender));
    gl.uniform3fv(u.uHorizon, hexToRgb(palette.horizon));
    gl.uniform3fv(u.uWaterTop, hexToRgb(palette.waterTop));
    gl.uniform3fv(u.uWaterLow, hexToRgb(palette.waterLow));
    gl.uniform3fv(u.uMoon, hexToRgb(palette.moon));
    gl.uniform3fv(u.uGlow, hexToRgb(palette.glow));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
  }, [frame, fps, width, height, palette]);

  return (
    <AbsoluteFill style={{ backgroundColor: palette.lavender }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%" }}
      />
    </AbsoluteFill>
  );
};
