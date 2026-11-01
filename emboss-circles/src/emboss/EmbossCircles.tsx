import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FRAG, VERT } from "./shader";
import { uniformsAt } from "./timeline";
import type { Palette } from "./palettes";

type GLState = {
  gl: WebGL2RenderingContext;
  prog: WebGLProgram;
  loc: Record<string, WebGLUniformLocation | null>;
};

const UNIFORMS = [
  "uRes", "uFrame", "uLensO", "uLensA", "uWalkO", "uWalkR", "uWalkA", "uChanA",
  "uGamma", "uSpread", "uRingR", "uRingA", "uTinyR", "uBeadA", "uLensBlend", "uFill", "uLight", "uGlobal", "uRingSh", "uEdgeA",
  "uBg", "uPaper", "uShadow", "uWarm", "uLine", "uChan",
  "uShadowGain", "uWarmGain", "uLineGain",
];

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
  const sh = gl.createShader(type);
  if (!sh) throw new Error("createShader failed");
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error("Shader compile error: " + gl.getShaderInfoLog(sh));
  }
  return sh;
};

const initGL = (canvas: HTMLCanvasElement): GLState => {
  const gl = canvas.getContext("webgl2", {
    antialias: false,
    preserveDrawingBuffer: true,
    premultipliedAlpha: false,
    alpha: false,
  });
  if (!gl) throw new Error("WebGL2 is not available");
  const prog = gl.createProgram();
  if (!prog) throw new Error("createProgram failed");
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error("Program link error: " + gl.getProgramInfoLog(prog));
  }
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const loc: GLState["loc"] = {};
  for (const u of UNIFORMS) loc[u] = gl.getUniformLocation(prog, u);
  return { gl, prog, loc };
};

export type EmbossCirclesProps = {
  palette: Palette;
};

export const EmbossCircles: React.FC<EmbossCirclesProps> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<GLState | null>(null);
  const [handle] = useState(() => delayRender("Initialising WebGL2"));

  // Draw at the device resolution: a 3840x2160 composition rendered with
  // `--scale=0.5` produces a native 1920x1080 buffer instead of downsampling.
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const bw = Math.round(width * dpr);
  const bh = Math.round(height * dpr);

  const draw = useCallback(() => {
    const st = glRef.current;
    if (!st) return;
    const { gl, prog, loc } = st;
    gl.viewport(0, 0, bw, bh);
    gl.useProgram(prog);
    const u = uniformsAt(frame);
    gl.uniform2f(loc.uRes, bw, bh);
    gl.uniform1f(loc.uFrame, frame);
    gl.uniform1f(loc.uLensO, u.uLensO);
    gl.uniform1f(loc.uLensA, u.uLensA);
    gl.uniform1f(loc.uWalkO, u.uWalkO);
    gl.uniform1f(loc.uWalkR, u.uWalkR);
    gl.uniform1f(loc.uWalkA, u.uWalkA);
    gl.uniform1f(loc.uChanA, u.uChanA);
    gl.uniform1f(loc.uGamma, u.uGamma);
    gl.uniform1f(loc.uSpread, u.uSpread);
    gl.uniform1f(loc.uRingR, u.uRingR);
    gl.uniform1f(loc.uRingA, u.uRingA);
    gl.uniform1f(loc.uTinyR, u.uTinyR);
    gl.uniform1f(loc.uBeadA, u.uBeadA);
    gl.uniform1f(loc.uLensBlend, u.uLensBlend);
    gl.uniform1f(loc.uFill, u.uFill);
    gl.uniform2f(loc.uLight, u.uLight[0], u.uLight[1]);
    gl.uniform1f(loc.uGlobal, u.uGlobal);
    gl.uniform1f(loc.uRingSh, u.uRingSh);
    gl.uniform1f(loc.uEdgeA, u.uEdgeA);
    gl.uniform3fv(loc.uBg, palette.bg);
    gl.uniform3fv(loc.uPaper, palette.paper);
    gl.uniform3fv(loc.uShadow, palette.shadow);
    gl.uniform3fv(loc.uWarm, palette.warm);
    gl.uniform3fv(loc.uLine, palette.line);
    gl.uniform3fv(loc.uChan, palette.chan);
    gl.uniform1f(loc.uShadowGain, palette.shadowGain);
    gl.uniform1f(loc.uWarmGain, palette.warmGain);
    gl.uniform1f(loc.uLineGain, palette.lineGain);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
  }, [frame, bw, bh, palette]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      glRef.current = initGL(canvas);
      draw();
      continueRender(handle);
    } catch (e) {
      cancelRender(e);
    }
    // init once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    draw();
  }, [draw]);

  return (
    <AbsoluteFill style={{ backgroundColor: `rgb(${palette.bg.map((c) => Math.round(c * 255)).join(",")})` }}>
      <canvas
        ref={canvasRef}
        width={bw}
        height={bh}
        style={{ width, height, display: "block" }}
      />
    </AbsoluteFill>
  );
};
