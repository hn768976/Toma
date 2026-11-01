import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { FIRE_PALETTES } from "./palettes";
import { FRAG, VERT } from "./shader";
import { sampleTimeline } from "./timeline";

export const fireRingSchema = z.object({
  palette: z.enum(["inferno", "plasma"]),
});

type Props = z.infer<typeof fireRingSchema>;

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

const UNIFORMS = [
  "uRes", "uTime", "uR", "uRh", "uHeat", "uSmoke", "uThin", "uSpin",
  "uWarp", "uCenter", "uBg", "uBgGlow", "uE0", "uE1", "uE2", "uE3",
  "uSmokeCol", "uSmokeAmb",
];

const init = (canvas: HTMLCanvasElement): GLState => {
  const gl = canvas.getContext("webgl2", {
    preserveDrawingBuffer: true,
    antialias: false,
    alpha: false,
  });
  if (!gl) throw new Error("WebGL 2 is not available");
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error("Program link failed: " + gl.getProgramInfoLog(prog));
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const loc: GLState["loc"] = {};
  for (const u of UNIFORMS) loc[u] = gl.getUniformLocation(prog, u);
  return { gl, prog, loc };
};

export const FireRing: React.FC<Props> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useRef<GLState | null>(null);

  // Render at the device pixel ratio so `--scale` renders natively
  // (e.g. --scale=0.5 of the 4K composition renders 1920x1080 pixels).
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const bw = Math.round(width * dpr);
  const bh = Math.round(height * dpr);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!state.current) state.current = init(canvas);
    const { gl, loc } = state.current;
    const pal = FIRE_PALETTES[palette];
    const tl = sampleTimeline(frame);
    gl.viewport(0, 0, bw, bh);
    gl.uniform2f(loc.uRes, bw, bh);
    gl.uniform1f(loc.uTime, frame / fps);
    gl.uniform1f(loc.uR, tl.R);
    gl.uniform1f(loc.uRh, tl.Rh);
    gl.uniform1f(loc.uHeat, tl.heat);
    gl.uniform1f(loc.uSmoke, tl.smoke);
    gl.uniform1f(loc.uThin, tl.thin);
    gl.uniform1f(loc.uSpin, tl.spin);
    gl.uniform1f(loc.uWarp, tl.warp);
    gl.uniform2f(loc.uCenter, tl.cx, 0.0);
    gl.uniform3fv(loc.uBg, pal.bg);
    gl.uniform3fv(loc.uBgGlow, pal.bgGlow);
    gl.uniform3fv(loc.uE0, pal.e0);
    gl.uniform3fv(loc.uE1, pal.e1);
    gl.uniform3fv(loc.uE2, pal.e2);
    gl.uniform3fv(loc.uE3, pal.e3);
    gl.uniform3fv(loc.uSmokeCol, pal.smokeCol);
    gl.uniform3fv(loc.uSmokeAmb, pal.smokeAmb);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
  }, [frame, fps, palette, bw, bh]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas
        ref={canvasRef}
        width={bw}
        height={bh}
        style={{ width, height, display: "block" }}
      />
    </AbsoluteFill>
  );
};
