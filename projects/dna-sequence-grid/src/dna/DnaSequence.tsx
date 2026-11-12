import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, cancelRender, useCurrentFrame, useVideoConfig } from "remotion";
import { Key, monotone } from "../lib/spline";
import { FRAG, POST_FRAG, VERT } from "./shader";

type RGB = [number, number, number];

export type DnaPalette = {
  bg: RGB;
  laneBg: RGB;
  a: RGB;
  b: RGB;
  c: RGB;
  d: RGB;
  /** probabilities of colours b, c, d and amount of white over-exposure */
  mix: [number, number, number, number];
  /** chance that a big block keeps an accent colour (C / D) */
  blockAccent: number;
  bloomTint: RGB;
};

/** V1 - the reference look: pale steel-blue / white bars, grey-blue, rare red-orange calls. */
export const PALETTE_REFERENCE: DnaPalette = {
  bg: [0.004, 0.005, 0.009],
  laneBg: [0.0, 0.0, 0.0],
  a: [0.68, 0.82, 1.0],
  b: [0.5, 0.6, 0.78],
  c: [1.0, 0.3, 0.13],
  d: [1.0, 0.3, 0.13],
  mix: [0.26, 0.09, 0.0, 0.75],
  blockAccent: 0.08,
  bloomTint: [0.75, 0.88, 1.0],
};

/**
 * V2 - alternative colour palette: four-dye fluorescent sequencing colours
 * (emerald / azure dominant with amber and magenta calls) on deep teal-black,
 * echoing the A/C/G/T dye channels of a real capillary sequencer read-out.
 */
export const PALETTE_FLUORESCENT: DnaPalette = {
  bg: [0.003, 0.009, 0.009],
  laneBg: [0.0, 0.0, 0.0],
  a: [0.18, 1.0, 0.62],
  b: [0.12, 0.6, 1.0],
  c: [1.0, 0.68, 0.1],
  d: [1.0, 0.16, 0.62],
  mix: [0.3, 0.14, 0.11, 0.25],
  blockAccent: 0.8,
  bloomTint: [0.7, 1.0, 0.85],
};

export type DnaSequenceProps = { palette: "reference" | "fluorescent" };

const PALETTES = { reference: PALETTE_REFERENCE, fluorescent: PALETTE_FLUORESCENT };

// Camera keys (time in s). Matches the reference: a slow lateral truck to the
// right (~1.45% of frame width per second) with a gentle forward drift,
// looking down onto the gel at ~38 deg through a moderately wide lens.
const CAM_X: Key[] = [
  [0, 0],
  [25.033, 4.6],
];
const CAM_Z: Key[] = [
  [0, 0],
  [25.033, -1.6],
];
const PITCH: Key[] = [
  [0, -38],
  [12, -39],
  [25.033, -38.4],
];
const DEG = Math.PI / 180;

/** Rotation matrix (column-major) from yaw, pitch, roll. */
const camRotation = (yaw: number, pitch: number, roll: number) => {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cr = Math.cos(roll), sr = Math.sin(roll);
  // R = Ry(yaw) * Rx(pitch) * Rz(roll)
  const rz = [cr, sr, 0, -sr, cr, 0, 0, 0, 1];
  const rx = [1, 0, 0, 0, cp, sp, 0, -sp, cp];
  const ry = [cy, 0, -sy, 0, 1, 0, sy, 0, cy];
  const mul = (a: number[], b: number[]) => {
    const o = new Array(9).fill(0);
    for (let c = 0; c < 3; c++)
      for (let r = 0; r < 3; r++)
        for (let k = 0; k < 3; k++) o[c * 3 + r] += a[k * 3 + r] * b[c * 3 + k];
    return o;
  };
  return new Float32Array(mul(ry, mul(rx, rz)));
};

type GlState = {
  gl: WebGL2RenderingContext;
  prog: WebGLProgram;
  post: WebGLProgram;
  loc: Record<string, WebGLUniformLocation | null>;
  ploc: Record<string, WebGLUniformLocation | null>;
  fbo: WebGLFramebuffer;
  tex: WebGLTexture;
  w: number;
  h: number;
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
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, frag));
  gl.bindAttribLocation(prog, 0, "aPos");
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error("Program link failed: " + gl.getProgramInfoLog(prog));
  }
  return prog;
};

const initGl = (canvas: HTMLCanvasElement, w: number, h: number): GlState => {
  const gl = canvas.getContext("webgl2", {
    preserveDrawingBuffer: true,
    antialias: false,
    alpha: false,
  });
  if (!gl) throw new Error("WebGL 2 is not available");
  const prog = link(gl, FRAG);
  const post = link(gl, POST_FRAG);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  // Off-screen scene target with a mip chain (used for the bloom).
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  const levels = Math.floor(Math.log2(Math.max(w, h))) + 1;
  gl.texStorage2D(gl.TEXTURE_2D, levels, gl.RGBA8, w, h);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  const names = [
    "uRes", "uTime", "uCamPos", "uCamRot", "uTanHalfFov", "uFocusDist", "uAperture",
    "uPxScale", "uBg", "uLaneBg", "uColA", "uColB", "uColC", "uColD", "uMix", "uBlockAccent",
  ];
  const loc: GlState["loc"] = {};
  for (const n of names) loc[n] = gl.getUniformLocation(prog, n);
  const ploc: GlState["ploc"] = {};
  for (const n of ["uScene", "uCA", "uBloom", "uBloomTint"]) ploc[n] = gl.getUniformLocation(post, n);
  return { gl, prog, post, loc, ploc, fbo, tex, w, h };
};

export const DnaSequence: React.FC<DnaSequenceProps> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = frame / fps;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<GlState | null>(null);
  const pal = PALETTES[palette];

  // Native rasterisation at the output resolution (scale 0.5 => 1920x1080).
  const pr =
    typeof window === "undefined" ? 1 : Math.min(1, Math.max(0.25, window.devicePixelRatio || 1));
  const bw = Math.round(width * pr);
  const bh = Math.round(height * pr);

  useLayoutEffect(() => {
    try {
      const canvas = canvasRef.current!;
      if (!glRef.current || glRef.current.w !== bw || glRef.current.h !== bh) {
        glRef.current = initGl(canvas, bw, bh);
      }
      const { gl, prog, post, loc, ploc, fbo, tex } = glRef.current;

      // Pass 1: the gel plane into the off-screen target.
      gl.useProgram(prog);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, bw, bh);
      gl.uniform2f(loc.uRes, bw, bh);
      gl.uniform1f(loc.uTime, t);
      gl.uniform3f(loc.uCamPos, monotone(CAM_X, t), 8.6, monotone(CAM_Z, t));
      gl.uniformMatrix3fv(
        loc.uCamRot,
        false,
        camRotation(0, monotone(PITCH, t) * DEG, 1.5 * DEG),
      );
      gl.uniform1f(loc.uTanHalfFov, Math.tan(16 * DEG));
      gl.uniform1f(loc.uFocusDist, 14.6);
      gl.uniform1f(loc.uAperture, 75.0);
      gl.uniform1f(loc.uPxScale, bh / 1080);
      gl.uniform3f(loc.uBg, ...pal.bg);
      gl.uniform3f(loc.uLaneBg, ...pal.laneBg);
      gl.uniform3f(loc.uColA, ...pal.a);
      gl.uniform3f(loc.uColB, ...pal.b);
      gl.uniform3f(loc.uColC, ...pal.c);
      gl.uniform3f(loc.uColD, ...pal.d);
      gl.uniform4f(loc.uMix, ...pal.mix);
      gl.uniform1f(loc.uBlockAccent, pal.blockAccent);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.generateMipmap(gl.TEXTURE_2D);

      // Pass 2: chromatic aberration + bloom + grade to the canvas.
      gl.useProgram(post);
      gl.viewport(0, 0, bw, bh);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(ploc.uScene, 0);
      gl.uniform1f(ploc.uCA, 0.017);
      gl.uniform1f(ploc.uBloom, 0.55);
      gl.uniform3f(ploc.uBloomTint, ...pal.bloomTint);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.finish();
    } catch (e) {
      cancelRender(e as Error);
    }
  });

  useLayoutEffect(() => {
    return () => {
      glRef.current?.gl.getExtension("WEBGL_lose_context")?.loseContext();
      glRef.current = null;
    };
  }, []);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas ref={canvasRef} width={bw} height={bh} style={{ width, height, position: "absolute" }} />
    </AbsoluteFill>
  );
};
