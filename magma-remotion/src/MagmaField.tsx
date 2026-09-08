import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FRAGMENT_SHADER, VERTEX_SHADER } from "./shaders/magma";
import { FIELD } from "./constants";
import { hexToRgb, type Palette } from "./palettes";

/**
 * Raw WebGL rather than react-three-fiber, deliberately.
 *
 * The field is one full-screen fragment shader, so a scene graph buys nothing,
 * but the scheduling it brings costs a great deal: with a renderer that draws on
 * its own schedule, the frame Remotion captures is whatever happened to be in
 * the buffer at capture time. Under `--concurrency 4` that lost 27 of 31 frames
 * to stale draws, in blocks matching the worker count, and the artifact is
 * nearly invisible unless you difference the output against a single-threaded
 * render of the same range.
 *
 * Here the draw happens inside useLayoutEffect — synchronously, during commit,
 * before the browser can paint — and finishes with gl.finish(), so the buffer is
 * complete and current before Remotion can screenshot it. `preserveDrawingBuffer`
 * keeps it readable at capture time.
 */

type Uniforms = Record<string, number>;

const buildUniforms = (palette: Palette): Uniforms => ({
  uCells: FIELD.cells,
  uWarpAmp1: FIELD.warpAmp1,
  uWarpFreq1: FIELD.warpFreq1,
  uWarpRate1: FIELD.warpRate1,
  uWarpAmp2: FIELD.warpAmp2,
  uWarpFreq2: FIELD.warpFreq2,
  uWarpRate2: FIELD.warpRate2,
  uAdvAmp: FIELD.advAmp,
  uAdvFreq: FIELD.advFreq,
  uJitter: FIELD.jitter,
  uCellCycles: FIELD.cellCycles,
  uCells2: FIELD.cells2,
  uCellCycles2: FIELD.cellCycles2,
  uFiligree: FIELD.filigree,
  uPlateMin: FIELD.plateMin,
  uPlateVar: FIELD.plateVar,
  uSpeck: FIELD.speck,
  uVeinW: FIELD.veinW,
  uContourN: FIELD.contourN,
  uBloom: FIELD.bloom,
  uPulse: FIELD.pulse,
  uPulseCycles: FIELD.pulseCycles,
  uGrain: FIELD.grain,
  uCrust: FIELD.crust,
  uHeatGamma: palette.heatGamma,
});

const compile = (gl: WebGLRenderingContext, type: number, src: string) => {
  const sh = gl.createShader(type);
  if (!sh) throw new Error("could not create shader");
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(`shader compile failed: ${gl.getShaderInfoLog(sh)}`);
  }
  return sh;
};

type GLState = {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  loc: Record<string, WebGLUniformLocation | null>;
};

const setup = (canvas: HTMLCanvasElement): GLState => {
  const gl = (canvas.getContext("webgl2", {
    antialias: false,
    preserveDrawingBuffer: true,
    alpha: false,
  }) ??
    canvas.getContext("webgl", {
      antialias: false,
      preserveDrawingBuffer: true,
      alpha: false,
    })) as WebGLRenderingContext | null;
  if (!gl) throw new Error("WebGL is unavailable — render with --gl=angle or --gl=swiftshader");

  const program = gl.createProgram();
  if (!program) throw new Error("could not create program");
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`program link failed: ${gl.getProgramInfoLog(program)}`);
  }
  gl.useProgram(program);

  // One triangle large enough to cover the clip cube — cheaper than a quad and
  // with no seam down the diagonal.
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const aPos = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const loc: GLState["loc"] = {};
  const names = [
    "uResolution",
    "uT",
    "uDuration",
    "uPal",
    ...Object.keys(buildUniforms({ heatGamma: 1 } as Palette)),
  ];
  for (const n of names) loc[n] = gl.getUniformLocation(program, n === "uPal" ? "uPal[0]" : n);
  return { gl, program, loc };
};

const Field: React.FC<{ palette: Palette }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GLState | null>(null);
  const [handle] = useState(() => delayRender("compiling the magma shader"));
  const readyRef = useRef(false);

  // Everything time-varying comes from this one normalised value. Remotion
  // renders frames out of order across workers, so a wall clock or a frame
  // delta would desynchronise them; frame / durationInFrames cannot.
  const t = frame / durationInFrames;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!stateRef.current) stateRef.current = setup(canvas);
    const { gl, loc } = stateRef.current;

    // Size the backing store to the pixels actually being written. Remotion
    // implements --scale as a device scale factor, so a canvas fixed at the
    // composition size would run the shader at 4K even for a 1080p preview and
    // then throw three quarters of it away in the downscale.
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(width * dpr);
    const h = Math.round(height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);

    gl.uniform2f(loc.uResolution ?? null, w, h);
    gl.uniform1f(loc.uT ?? null, t);
    gl.uniform1f(loc.uDuration ?? null, durationInFrames);
    gl.uniform3fv(
      loc.uPal ?? null,
      new Float32Array(palette.stops.flatMap((c) => hexToRgb(c))),
    );
    const u = buildUniforms(palette);
    for (const [name, value] of Object.entries(u)) gl.uniform1f(loc[name] ?? null, value);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // Block until the draw is actually complete, so the buffer Remotion
    // screenshots can never be a frame behind.
    gl.finish();

    if (!readyRef.current) {
      readyRef.current = true;
      continueRender(handle);
    }
  }, [t, width, height, durationInFrames, palette, handle]);

  // useLayoutEffect, not useEffect: it runs synchronously during commit, before
  // the browser paints and before Remotion can capture.
  useLayoutEffect(draw);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
};

export const MagmaField: React.FC<{ palette: Palette }> = ({ palette }) => (
  <AbsoluteFill style={{ backgroundColor: "#000000" }}>
    <Field palette={palette} />
  </AbsoluteFill>
);
