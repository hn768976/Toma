import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import {
  DOT_SPACING,
  DURATION_IN_FRAMES,
  GRID_X_MAX,
  GRID_X_MIN,
  GRID_Z_FAR,
  GRID_Z_NEAR,
  LINE_SPACING,
} from "./constants";
import { PALETTES, type PaletteName } from "./palettes";
import { lookAt, perspective, type Vec3 } from "./math";
import { BG_FRAG, BG_VERT, DOT_FRAG, DOT_VERT } from "./shaders";

export const particleWaveSchema = z.object({
  palette: z.enum(["silver", "aurora"]),
});

export type ParticleWaveProps = z.infer<typeof particleWaveSchema>;

export const particleWaveDefaults: ParticleWaveProps = { palette: "silver" };

// Camera and lens, resolution-independent (pixel quantities are
// expressed as fractions of the viewport height).
const FOV_Y = (38 * Math.PI) / 180;
const CAMERA_ROLL = (-17 * Math.PI) / 180;
const FOCUS_DISTANCE = 15;
const APERTURE = 0.035; // max CoC diameter as a fraction of frame height
const DOT_WORLD = 0.09;
const MIN_DOT_FRAC = 1.1 / 1080;

// Grid of dot positions plus a per-dot random seed, built once.
const buildGrid = () => {
  const cols = Math.floor((GRID_X_MAX - GRID_X_MIN) / LINE_SPACING) + 1;
  const rows = Math.floor((GRID_Z_NEAR - GRID_Z_FAR) / DOT_SPACING) + 1;
  const pos = new Float32Array(cols * rows * 2);
  const seed = new Float32Array(cols * rows);
  let s = 1234567;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  let i = 0;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      pos[i * 2] = GRID_X_MIN + c * LINE_SPACING;
      pos[i * 2 + 1] = GRID_Z_NEAR - r * DOT_SPACING;
      seed[i] = rand();
      i++;
    }
  }
  return { pos, seed, count: cols * rows };
};

const compile = (gl: WebGL2RenderingContext, vs: string, fs: string) => {
  const make = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(sh) ?? "shader compile failed");
    }
    return sh;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, make(gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, make(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(prog) ?? "program link failed");
  }
  return prog;
};

type GlState = {
  gl: WebGL2RenderingContext;
  bgProg: WebGLProgram;
  dotProg: WebGLProgram;
  bgVao: WebGLVertexArrayObject;
  dotVao: WebGLVertexArrayObject;
  count: number;
  maxPointSize: number;
};

const initGl = (canvas: HTMLCanvasElement): GlState => {
  const gl = canvas.getContext("webgl2", {
    antialias: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: true,
  });
  if (!gl) throw new Error("WebGL2 is not available");

  const bgProg = compile(gl, BG_VERT, BG_FRAG);
  const dotProg = compile(gl, DOT_VERT, DOT_FRAG);

  const bgVao = gl.createVertexArray()!;
  gl.bindVertexArray(bgVao);
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const bgLoc = gl.getAttribLocation(bgProg, "aPos");
  gl.enableVertexAttribArray(bgLoc);
  gl.vertexAttribPointer(bgLoc, 2, gl.FLOAT, false, 0, 0);

  const grid = buildGrid();
  const dotVao = gl.createVertexArray()!;
  gl.bindVertexArray(dotVao);
  const posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, grid.pos, gl.STATIC_DRAW);
  const gridLoc = gl.getAttribLocation(dotProg, "aGrid");
  gl.enableVertexAttribArray(gridLoc);
  gl.vertexAttribPointer(gridLoc, 2, gl.FLOAT, false, 0, 0);
  const seedBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf);
  gl.bufferData(gl.ARRAY_BUFFER, grid.seed, gl.STATIC_DRAW);
  const seedLoc = gl.getAttribLocation(dotProg, "aSeed");
  gl.enableVertexAttribArray(seedLoc);
  gl.vertexAttribPointer(seedLoc, 1, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  const range = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array;
  return { gl, bgProg, dotProg, bgVao, dotVao, count: grid.count, maxPointSize: range[1] };
};

// A particle-grid surface rolling in slow swells, shot with a shallow
// depth of field: crisp dots in the foreground dissolving into soft,
// glowing ribbons where the far surface folds over itself. Rendered with
// raw WebGL 2 (one draw call for ~120k point sprites).
export const ParticleWave: React.FC<ParticleWaveProps> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<GlState | null>(null);
  const colors = PALETTES[palette as PaletteName];

  const proj = useMemo(() => perspective(FOV_Y, width / height, 0.5, 600), [width, height]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!glRef.current) glRef.current = initGl(canvas);
    const { gl, bgProg, dotProg, bgVao, dotVao, count, maxPointSize } = glRef.current;

    const loop = frame / DURATION_IN_FRAMES;
    const phase = loop * Math.PI * 2;
    // Slow camera breathing, also periodic over the loop.
    const eye: Vec3 = [
      0 + 1.2 * Math.sin(phase),
      14 + 0.5 * Math.sin(phase * 2 + 0.6),
      4 + 0.8 * Math.cos(phase),
    ];
    const target: Vec3 = [-2 + 1.0 * Math.sin(phase + 1), -3, -20];
    const view = lookAt(eye, target, CAMERA_ROLL + 0.015 * Math.sin(phase));

    gl.viewport(0, 0, width, height);
    gl.disable(gl.DEPTH_TEST);

    gl.disable(gl.BLEND);
    gl.useProgram(bgProg);
    const bu = (n: string) => gl.getUniformLocation(bgProg, n);
    gl.uniform3fv(bu("uTL"), colors.bgTopLeft);
    gl.uniform3fv(bu("uTR"), colors.bgTopRight);
    gl.uniform3fv(bu("uBL"), colors.bgBottomLeft);
    gl.uniform3fv(bu("uBR"), colors.bgBottomRight);
    gl.uniform3fv(bu("uHaze"), colors.hazeColor);
    gl.uniform1f(bu("uHazeStrength"), colors.hazeStrength);
    gl.uniform1f(bu("uAspect"), width / height);
    gl.uniform1f(bu("uSeed"), (frame % 64) * 17.0);
    gl.bindVertexArray(bgVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
    gl.useProgram(dotProg);
    const du = (n: string) => gl.getUniformLocation(dotProg, n);
    gl.uniformMatrix4fv(du("uView"), false, view);
    gl.uniformMatrix4fv(du("uProj"), false, proj);
    gl.uniform1f(du("uPhase"), phase);
    gl.uniform1f(du("uViewportH"), height);
    gl.uniform1f(du("uFocus"), FOCUS_DISTANCE);
    gl.uniform1f(du("uAperture"), APERTURE);
    gl.uniform1f(du("uDotWorld"), DOT_WORLD);
    gl.uniform1f(du("uMinPx"), MIN_DOT_FRAC * height);
    gl.uniform1f(du("uMaxPx"), Math.min(maxPointSize, height * 0.08));
    gl.uniform2f(du("uXRange"), GRID_X_MIN, GRID_X_MAX);
    gl.uniform2f(du("uZRange"), GRID_Z_NEAR, GRID_Z_FAR);
    gl.uniform3fv(du("uNear"), colors.dotNear);
    gl.uniform3fv(du("uFar"), colors.dotFar);
    gl.uniform3fv(du("uAccent"), colors.dotAccent);
    gl.uniform1f(du("uAccentMix"), colors.accentMix);
    gl.uniform1f(du("uIntensity"), colors.intensity);
    gl.bindVertexArray(dotVao);
    gl.drawArrays(gl.POINTS, 0, count);
    gl.bindVertexArray(null);
    gl.finish();
  }, [frame, width, height, proj, colors]);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <canvas ref={canvasRef} width={width} height={height} style={{ width, height }} />
    </AbsoluteFill>
  );
};
