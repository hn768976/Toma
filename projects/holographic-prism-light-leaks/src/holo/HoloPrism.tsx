import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { FRAG, VERT } from "./shader";

export type HoloVariant = "match" | "camera";

type GLState = {
  gl: WebGL2RenderingContext;
  prog: WebGLProgram;
  loc: Record<string, WebGLUniformLocation | null>;
};

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
  const s = gl.createShader(type);
  if (!s) throw new Error("createShader failed");
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error("Shader compile error: " + gl.getShaderInfoLog(s));
  }
  return s;
};

const init = (canvas: HTMLCanvasElement): GLState => {
  const gl = canvas.getContext("webgl2", {
    preserveDrawingBuffer: true,
    antialias: false,
    premultipliedAlpha: false,
    alpha: false,
  });
  if (!gl) {
    throw new Error(
      "WebGL 2 is not available. Render with --gl=swangle (CPU) or --gl=angle (GPU).",
    );
  }
  const prog = gl.createProgram();
  if (!prog) throw new Error("createProgram failed");
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error("Program link error: " + gl.getProgramInfoLog(prog));
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
  for (const n of ["uRes", "uTime", "uMode", "uCamA", "uCamB"]) {
    loc[n] = gl.getUniformLocation(prog, n);
  }
  return { gl, prog, loc };
};

const smooth = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

export type HoloPrismProps = {
  variant: HoloVariant;
  /**
   * Resolution of the shader canvas relative to the composition.
   * 1 = native 4K (default). The delivery render to 1080p uses 0.5 together
   * with `--scale=0.5`, so every shaded pixel maps 1:1 onto an output pixel.
   */
  shaderScale?: number;
};

export const HoloPrism: React.FC<HoloPrismProps> = ({
  variant,
  shaderScale = 1,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cw = Math.round(width * shaderScale);
  const ch = Math.round(height * shaderScale);
  const state = useRef<GLState | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!state.current) state.current = init(canvas);
    const { gl, loc } = state.current;
    const t = frame / fps;
    const u = frame / (durationInFrames - 1);

    gl.viewport(0, 0, cw, ch);
    gl.uniform2f(loc.uRes, cw, ch);
    gl.uniform1f(loc.uTime, t);

    if (variant === "match") {
      // Hand-held macro drift over the foil, like the reference footage.
      const panX = 0.26 * t + 0.16 * Math.sin(t * 0.61);
      const panY = 0.06 * t + 0.14 * Math.sin(t * 0.52 + 1.3);
      const rot = 0.22 * Math.sin(t * 0.27) + 0.06 * Math.sin(t * 0.93);
      const zoom = 1.0 + 0.06 * Math.sin(t * 0.29);
      gl.uniform1i(loc.uMode, 0);
      gl.uniform4f(loc.uCamA, panX, panY, rot, zoom);
      gl.uniform4f(loc.uCamB, 0, 0, 1, 0);
    } else {
      // Version 2: low-angle perspective tracking shot gliding across the
      // holographic sheet, with a slow crane-down, banking yaw and roll.
      const pitch = 0.63 - 0.07 * smooth(u); // ~36deg -> ~32deg (camera cranes down)
      const height = 0.62 - 0.12 * smooth(u);
      const camX = 0.55 * Math.sin(t * 0.13);
      const camY = 0.36 * t;
      const yaw = 0.32 * Math.sin(t * 0.11 + 0.4);
      const roll = 0.07 * Math.sin(t * 0.19);
      gl.uniform1i(loc.uMode, 1);
      gl.uniform4f(loc.uCamA, camX, camY, height, yaw);
      gl.uniform4f(loc.uCamB, pitch, roll, 1.05, 0.24);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
  }, [frame, fps, cw, ch, durationInFrames, variant]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#4a3f47" }}>
      <canvas
        ref={canvasRef}
        width={cw}
        height={ch}
        style={{ width: "100%", height: "100%" }}
      />
    </AbsoluteFill>
  );
};
