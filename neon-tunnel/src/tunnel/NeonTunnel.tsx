import React, { useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FRAG, VERT } from "./shader";
import { tunnelParamsAt } from "./timeline";
import { Palette } from "./palettes";

type GLState = {
  gl: WebGL2RenderingContext;
  uniforms: Record<string, WebGLUniformLocation | null>;
};

const UNIFORMS = [
  "uRes",
  "uFrame",
  "uCamZ",
  "uRoll",
  "uFocal",
  "uWarp",
  "uRing",
  "uFill",
  "uBase",
  "uWood",
  "uGlow",
  "uCore",
  "uReflTint",
  "uExposure",
];

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
  const sh = gl.createShader(type);
  if (!sh) throw new Error("createShader failed");
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(`Shader compile error: ${gl.getShaderInfoLog(sh)}`);
  }
  return sh;
};

const initGL = (canvas: HTMLCanvasElement): GLState => {
  const gl = canvas.getContext("webgl2", {
    preserveDrawingBuffer: true,
    antialias: false,
    premultipliedAlpha: false,
    alpha: false,
  });
  if (!gl) throw new Error("WebGL 2 is not available in this browser");
  const prog = gl.createProgram();
  if (!prog) throw new Error("createProgram failed");
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`Program link error: ${gl.getProgramInfoLog(prog)}`);
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
  const uniforms: GLState["uniforms"] = {};
  for (const u of UNIFORMS) uniforms[u] = gl.getUniformLocation(prog, u);
  return { gl, uniforms };
};

export const NeonTunnel: React.FC<{ palette: Palette }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<GLState | null>(null);
  const [handle] = useState(() => delayRender("Initialising WebGL 2"));

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!glRef.current) glRef.current = initGL(canvas);
    const { gl, uniforms: u } = glRef.current;
    const p = tunnelParamsAt(frame, fps);

    gl.viewport(0, 0, width, height);
    gl.uniform2f(u.uRes, width, height);
    gl.uniform1f(u.uFrame, frame);
    gl.uniform1f(u.uCamZ, p.camZ);
    gl.uniform1f(u.uRoll, p.roll);
    gl.uniform1f(u.uFocal, p.focal);
    gl.uniform1f(u.uWarp, p.warp);
    gl.uniform3f(u.uRing, p.ring0, p.ring1, p.ring2);
    gl.uniform1f(u.uFill, p.fill);
    gl.uniform3fv(u.uBase, palette.base);
    gl.uniform3fv(u.uWood, palette.wood);
    gl.uniform3fv(u.uGlow, palette.glow);
    gl.uniform3fv(u.uCore, palette.core);
    gl.uniform3fv(u.uReflTint, palette.reflTint);
    gl.uniform1f(u.uExposure, palette.exposure);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
    continueRender(handle);
  }, [frame, fps, width, height, palette, handle]);

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
