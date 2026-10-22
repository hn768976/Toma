import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { z } from "zod";
import { BASE_HEIGHT, BASE_WIDTH, LOOP_FRAMES } from "./constants";
import { BlobPalette, IRIDESCENT_PALETTE, REFERENCE_PALETTE } from "./palettes";
import { FRAGMENT_SHADER, VERTEX_SHADER } from "./shader";

export const glassBlobSchema = z.object({
  palette: z.enum(["reference", "iridescent"]),
  // 1 = 1080p (1920x1080), 2 = 4K (3840x2160). Must match the
  // width/height the Composition is registered with in Root.tsx.
  resolutionScale: z.number().positive(),
});

export type GlassBlobProps = z.infer<typeof glassBlobSchema>;

export const glassBlobDefaults: GlassBlobProps = {
  palette: "reference",
  resolutionScale: 1,
};

const PALETTES: Record<GlassBlobProps["palette"], BlobPalette> = {
  reference: REFERENCE_PALETTE,
  iridescent: IRIDESCENT_PALETTE,
};

type GlState = {
  gl: WebGL2RenderingContext;
  uniforms: Record<string, WebGLUniformLocation | null>;
};

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? "shader compile failed");
  }
  return shader;
};

const initGl = (canvas: HTMLCanvasElement): GlState => {
  const gl = canvas.getContext("webgl2", {
    antialias: false,
    preserveDrawingBuffer: true,
  });
  if (!gl) throw new Error("WebGL2 unavailable");

  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? "program link failed");
  }
  gl.useProgram(program);

  // Single full-screen triangle.
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const names = ["uRes", "uPhase", "uBg", "uRimBase", "uRimShift", "uIridescence", "uInterior"];
  const uniforms = Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(program, n)]));
  return { gl, uniforms };
};

// A wobbling glass/soap-bubble blob: a raymarched, noise-displaced sphere
// shaded with a Fresnel rim in a WebGL2 fragment shader. The 20s loop
// plays over the first backdrop, then hard-cuts to the same loop over
// the second (chroma-key) backdrop, as in the reference.
export const GlassBlob: React.FC<GlassBlobProps> = ({ palette, resolutionScale }) => {
  const frame = useCurrentFrame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GlState | null>(null);
  const width = Math.round(BASE_WIDTH * resolutionScale);
  const height = Math.round(BASE_HEIGHT * resolutionScale);
  const colors = PALETTES[palette];

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!stateRef.current) stateRef.current = initGl(canvas);
    const { gl, uniforms: u } = stateRef.current;

    const loopFrame = frame % LOOP_FRAMES;
    const background = frame < LOOP_FRAMES ? colors.backgroundA : colors.backgroundB;

    gl.viewport(0, 0, width, height);
    gl.uniform2f(u.uRes, width, height);
    gl.uniform1f(u.uPhase, (loopFrame / LOOP_FRAMES) * Math.PI * 2);
    gl.uniform3fv(u.uBg, background);
    gl.uniform3fv(u.uRimBase, colors.rimBase);
    gl.uniform3fv(u.uRimShift, colors.rimShift);
    gl.uniform1f(u.uIridescence, colors.iridescence);
    gl.uniform3fv(u.uInterior, colors.interior);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
  }, [frame, width, height, colors]);

  return (
    <AbsoluteFill>
      <canvas ref={canvasRef} width={width} height={height} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};
