import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { PALETTES } from "./palettes";
import { POST_FRAG, SCENE_FRAG, VERT } from "./shaders";
import { makeDialCanvas, makeNoiseCanvas } from "./textures";

export const clockSpiralSchema = z.object({
  palette: z.enum(["sepia", "frost"]),
});
export type ClockSpiralProps = z.infer<typeof clockSpiralSchema>;

type GLState = {
  gl: WebGL2RenderingContext;
  scene: WebGLProgram;
  post: WebGLProgram;
  fbo: WebGLFramebuffer;
  sceneTex: WebGLTexture;
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

const link = (gl: WebGL2RenderingContext, frag: string) => {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, frag));
  gl.bindAttribLocation(p, 0, "aPos");
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error("Program link failed: " + gl.getProgramInfoLog(p));
  }
  return p;
};

const uploadTexture = (
  gl: WebGL2RenderingContext,
  unit: number,
  source: OffscreenCanvas,
  wrapT: number,
) => {
  const tex = gl.createTexture()!;
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    gl.LINEAR_MIPMAP_LINEAR,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);
  return tex;
};

const initGL = (canvas: HTMLCanvasElement): GLState => {
  const gl = canvas.getContext("webgl2", {
    preserveDrawingBuffer: true,
    antialias: false,
    alpha: false,
  });
  if (!gl) throw new Error("WebGL 2 is not available");

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const scene = link(gl, SCENE_FRAG);
  const post = link(gl, POST_FRAG);

  uploadTexture(gl, 1, makeDialCanvas(), gl.CLAMP_TO_EDGE);
  uploadTexture(gl, 2, makeNoiseCanvas(), gl.REPEAT);

  // Off-screen colour buffer for pass 1 (with mips for the glow lookup).
  const sceneTex = gl.createTexture()!;
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, sceneTex);
  const levels =
    Math.floor(Math.log2(Math.max(canvas.width, canvas.height))) + 1;
  gl.texStorage2D(gl.TEXTURE_2D, levels, gl.RGBA8, canvas.width, canvas.height);
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    gl.LINEAR_MIPMAP_LINEAR,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    sceneTex,
    0,
  );
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return { gl, scene, post, fbo, sceneTex };
};

const smooth = (x: number) => x * x * (3 - 2 * x);

export const ClockSpiral: React.FC<ClockSpiralProps> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<GLState | null>(null);

  // Everything (textures included) is generated synchronously, so the frame
  // is fully drawn before Remotion takes its screenshot.
  useLayoutEffect(() => {
    if (!canvasRef.current) return;
    if (!glRef.current) glRef.current = initGL(canvasRef.current);
    const state = glRef.current;
    const { gl, scene, post, fbo, sceneTex } = state;
    const pal = PALETTES[palette];
    const t = frame / fps;
    const T = durationInFrames / fps;
    const k = t / T;

    // Camera: slow, steady fall into the spiral with a gentle sway of the
    // tunnel axis and a faint drift of the vanishing point.
    const zoom = 0.2 * t;
    const rot = 0.09 * (t - (t * t) / (2 * T));
    const scroll = -0.012 * t;
    const swayA = 0.55 + 0.35 * Math.sin(t * 0.42 + 0.4);
    const swayM = 0.34 + 0.06 * Math.sin(t * 0.31);
    const tilt: [number, number] = [
      Math.cos(swayA) * swayM,
      Math.sin(swayA) * swayM,
    ];
    const center: [number, number] = [
      0.004 * Math.sin(t * 0.53),
      0.012 + 0.006 * Math.sin(t * 0.37 + 1.0),
    ];
    // Hands sweep clockwise; the minute hand races, the hour hand follows.
    const minute = -0.08 + Math.PI * 0.95 * t;
    const hour = 1.05 + 0.7 * t + 0.15 * smooth(Math.min(1, k * 2));

    const setCommon = (p: WebGLProgram) => {
      gl.uniform2f(gl.getUniformLocation(p, "uRes"), width, height);
      gl.uniform2f(gl.getUniformLocation(p, "uCenter"), center[0], center[1]);
      gl.uniform2f(gl.getUniformLocation(p, "uTilt"), tilt[0], tilt[1]);
      gl.uniform1f(gl.getUniformLocation(p, "uTime"), t);
    };
    const set3 = (p: WebGLProgram, name: string, v: number[]) =>
      gl.uniform3f(gl.getUniformLocation(p, name), v[0], v[1], v[2]);

    // Pass 1: spiral into the off-screen buffer.
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, width, height);
    gl.useProgram(scene);
    setCommon(scene);
    gl.uniform1i(gl.getUniformLocation(scene, "uDial"), 1);
    gl.uniform1i(gl.getUniformLocation(scene, "uNoise"), 2);
    gl.uniform1f(gl.getUniformLocation(scene, "uZoom"), zoom);
    gl.uniform1f(gl.getUniformLocation(scene, "uRot"), rot);
    gl.uniform1f(gl.getUniformLocation(scene, "uScroll"), scroll);
    set3(scene, "cPaper", pal.paper);
    set3(scene, "cPaperHot", pal.paperHot);
    set3(scene, "cInk", pal.ink);
    set3(scene, "cRim", pal.rim);
    set3(scene, "cGap", pal.gap);
    set3(scene, "cGapDeep", pal.gapDeep);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.generateMipmap(gl.TEXTURE_2D);

    // Pass 2: lens, hands and grade to the visible canvas.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.useProgram(post);
    setCommon(post);
    gl.uniform1i(gl.getUniformLocation(post, "uScene"), 0);
    gl.uniform1i(gl.getUniformLocation(post, "uNoise"), 2);
    gl.uniform1f(gl.getUniformLocation(post, "uMinute"), minute);
    gl.uniform1f(gl.getUniformLocation(post, "uHour"), hour);
    gl.uniform1f(gl.getUniformLocation(post, "uFrame"), frame);
    set3(post, "cInk", pal.ink);
    set3(post, "cPaperHot", pal.paperHot);
    set3(post, "cBg", pal.bg);
    set3(post, "cGrade", pal.grade);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
  }, [frame, fps, durationInFrames, width, height, palette]);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width, height }}
      />
    </AbsoluteFill>
  );
};
