import { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, cancelRender, useCurrentFrame, useVideoConfig } from "remotion";
import { ELECTRIC_BLUE, SOLAR_GOLD, TunnelPalette } from "./palettes";
import { FRAG, VERT } from "./shader";

export type TunnelProps = { variant: "v1" | "v2" };

type GLState = {
  gl: WebGL2RenderingContext;
  prog: WebGLProgram;
  loc: Record<string, WebGLUniformLocation | null>;
};

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error("Shader compile failed: " + gl.getShaderInfoLog(s));
  }
  return s;
};

const init = (canvas: HTMLCanvasElement): GLState => {
  const gl = canvas.getContext("webgl2", {
    preserveDrawingBuffer: true, // required so Remotion can screenshot the frame
    antialias: false,
    premultipliedAlpha: false,
    alpha: false,
  });
  if (!gl) throw new Error("WebGL 2 is not available in this browser");
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.bindAttribLocation(prog, 0, "aPos");
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error("Program link failed: " + gl.getProgramInfoLog(prog));
  }
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const loc: GLState["loc"] = {};
  for (const n of ["uRes", "uTime", "uCore", "uMid", "uDeep", "uHazeA", "uHazeB", "uSS"]) {
    loc[n] = gl.getUniformLocation(prog, n);
  }
  return { gl, prog, loc };
};

export const LightTunnel: React.FC<TunnelProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const state = useRef<GLState | null>(null);

  // Backing store follows the render scale (devicePixelRatio = Remotion --scale):
  // 3840x2160 for the native 4K render, 1920x1080 with --scale=0.5.
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const bw = Math.round(width * dpr);
  const bh = Math.round(height * dpr);
  const pal: TunnelPalette = variant === "v1" ? ELECTRIC_BLUE : SOLAR_GOLD;

  useLayoutEffect(() => {
    try {
      if (!ref.current) return;
      if (!state.current) state.current = init(ref.current);
      const { gl, prog, loc } = state.current;
      gl.viewport(0, 0, bw, bh);
      gl.useProgram(prog);
      gl.uniform2f(loc.uRes, bw, bh);
      gl.uniform1f(loc.uTime, frame / fps);
      gl.uniform3fv(loc.uCore, pal.core);
      gl.uniform3fv(loc.uMid, pal.mid);
      gl.uniform3fv(loc.uDeep, pal.deep);
      gl.uniform3fv(loc.uHazeA, pal.hazeA);
      gl.uniform3fv(loc.uHazeB, pal.hazeB);
      // 2-tap supersampling at <= 1080p backing size, native sampling at 4K
      gl.uniform1f(loc.uSS, bh <= 1200 ? 2 : 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.finish();
    } catch (e) {
      cancelRender(e);
    }
  }, [frame, fps, bw, bh, pal]);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <canvas ref={ref} width={bw} height={bh} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};
