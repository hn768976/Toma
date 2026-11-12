import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, cancelRender, useCurrentFrame, useVideoConfig } from "remotion";
import { Key, monotone } from "../lib/spline";
import { FRAG, VERT } from "./shader";

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
  bloom: string; // CSS colour tint for the glow pass
};

/** V1 - the reference look: pale steel-blue bars, grey-blue, rare red / cyan. */
export const PALETTE_REFERENCE: DnaPalette = {
  bg: [0.006, 0.008, 0.014],
  laneBg: [0.006, 0.008, 0.013],
  a: [0.52, 0.71, 1.0],
  b: [0.34, 0.44, 0.64],
  c: [1.0, 0.27, 0.12],
  d: [0.3, 0.85, 1.0],
  mix: [0.32, 0.07, 0.012, 0.6],
  bloom: "rgba(140,180,255,1)",
};

/**
 * V2 - alternative colour palette: four-dye fluorescent sequencing colours
 * (emerald / cyan dominant with amber and magenta calls) on deep teal-black,
 * echoing the A/C/G/T dye channels of a real capillary sequencer read-out.
 */
export const PALETTE_FLUORESCENT: DnaPalette = {
  bg: [0.004, 0.012, 0.012],
  laneBg: [0.004, 0.012, 0.012],
  a: [0.18, 1.0, 0.62],
  b: [0.12, 0.6, 1.0],
  c: [1.0, 0.68, 0.1],
  d: [1.0, 0.16, 0.62],
  mix: [0.3, 0.14, 0.11, 0.25],
  bloom: "rgba(120,255,200,1)",
};

export type DnaSequenceProps = { palette: "reference" | "fluorescent" };

const PALETTES = { reference: PALETTE_REFERENCE, fluorescent: PALETTE_FLUORESCENT };

// Camera keys (time in s). Matches the reference: a slow lateral truck to the
// right with a gentle forward drift, looking down onto the gel at ~38 deg through a long lens.
const CAM_X: Key[] = [
  [0, 0],
  [25.033, 5.4],
];
const CAM_Z: Key[] = [
  [0, 0],
  [25.033, -1.6],
];
const PITCH: Key[] = [
  [0, -38],
  [12, -39.2],
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

const initGl = (canvas: HTMLCanvasElement): GlState => {
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
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const names = [
    "uRes", "uTime", "uCamPos", "uCamRot", "uTanHalfFov", "uFocusDist", "uAperture",
    "uPxScale", "uBg", "uLaneBg", "uColA", "uColB", "uColC", "uColD", "uMix",
  ];
  const loc: GlState["loc"] = {};
  for (const n of names) loc[n] = gl.getUniformLocation(prog, n);
  return { gl, prog, loc };
};

export const DnaSequence: React.FC<DnaSequenceProps> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = frame / fps;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef<HTMLCanvasElement>(null);
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
      if (!glRef.current) glRef.current = initGl(canvas);
      const { gl, loc } = glRef.current;
      gl.viewport(0, 0, bw, bh);
      gl.uniform2f(loc.uRes, bw, bh);
      gl.uniform1f(loc.uTime, t);
      gl.uniform3f(loc.uCamPos, monotone(CAM_X, t), 10.5, monotone(CAM_Z, t));
      gl.uniformMatrix3fv(
        loc.uCamRot,
        false,
        camRotation(1.5 * DEG, monotone(PITCH, t) * DEG, 2.5 * DEG),
      );
      gl.uniform1f(loc.uTanHalfFov, Math.tan(13 * DEG));
      gl.uniform1f(loc.uFocusDist, 16.0);
      gl.uniform1f(loc.uAperture, 110.0);
      gl.uniform1f(loc.uPxScale, bh / 1080);
      gl.uniform3f(loc.uBg, ...pal.bg);
      gl.uniform3f(loc.uLaneBg, ...pal.laneBg);
      gl.uniform3f(loc.uColA, ...pal.a);
      gl.uniform3f(loc.uColB, ...pal.b);
      gl.uniform3f(loc.uColC, ...pal.c);
      gl.uniform3f(loc.uColD, ...pal.d);
      gl.uniform4f(loc.uMix, ...pal.mix);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.finish();

      // Bloom: copy a low-res version into a 2D canvas that CSS blurs + screens on top.
      const glow = glowRef.current!;
      const ctx = glow.getContext("2d")!;
      ctx.clearRect(0, 0, glow.width, glow.height);
      ctx.drawImage(canvas, 0, 0, glow.width, glow.height);
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
      <canvas
        ref={glowRef}
        width={480}
        height={270}
        style={{
          width,
          height,
          position: "absolute",
          filter: `blur(${height * 0.006}px) brightness(1.4)`,
          mixBlendMode: "screen",
          opacity: 0.42,
        }}
      />
    </AbsoluteFill>
  );
};
