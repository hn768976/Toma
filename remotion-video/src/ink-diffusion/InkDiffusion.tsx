import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  getRemotionEnvironment,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { INK_PARAMS, sourceEndTime, type InkParams } from "./constants";
import { FRAGMENT_SHADER, MAX_INJECTIONS, VERTEX_SHADER } from "./shader";

export const inkDiffusionSchema = z.object({
  variant: z.enum(["black-on-white", "colour-on-black", "milk"]),
  /**
   * Integration steps across the injection window. Fixed, but only the part of
   * the window that has already happened is walked, so early frames are cheap.
   */
  sourceSteps: z.number().min(4).max(160),
  /**
   * Integration steps across the settling tail at the final frame. Ramps up
   * from nothing, so cost per frame rises through the clip — see the README
   * for measured timings.
   */
  advectSteps: z.number().min(2).max(128),
  /**
   * Longest edge the shader is allowed to run at inside Remotion Studio.
   * Rendering always uses the full output resolution; this only keeps the
   * interactive preview responsive.
   */
  studioPreviewWidth: z.number().min(320).max(3840),
  /**
   * Which patch of the noise field the tank sits in. Purely a composition
   * control: every value gives a valid flow, but they place the eddies
   * differently, and some frame the bloom better than others.
   */
  seed: z.number(),
});

export type InkDiffusionProps = z.infer<typeof inkDiffusionSchema>;

export const inkDiffusionDefaults: InkDiffusionProps = {
  variant: "black-on-white",
  sourceSteps: 34,
  advectSteps: 40,
  studioPreviewWidth: 960,
  seed: 0,
};

const compileShader = (gl: WebGL2RenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Could not create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile failed: ${log}`);
  }
  return shader;
};

const createProgram = (gl: WebGL2RenderingContext) => {
  const program = gl.createProgram();
  if (!program) throw new Error("Could not create program");
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`Program link failed: ${gl.getProgramInfoLog(program)}`);
  }
  return program;
};

const toCss = ([r, g, b]: [number, number, number]) =>
  `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;

/** Flattened injection uniforms, padded out to the array size the shader declares. */
const packInjections = (params: InkParams) => {
  const pos = new Float32Array(MAX_INJECTIONS * 4);
  const cfg = new Float32Array(MAX_INJECTIONS * 4);
  const used = params.injections.slice(0, MAX_INJECTIONS);
  used.forEach((inj, i) => {
    pos.set([inj.x, inj.y, inj.start, inj.duration], i * 4);
    cfg.set([inj.strength, inj.sigma, inj.channel, inj.jet], i * 4);
  });
  return { pos, cfg, count: used.length };
};

/**
 * "Ink Diffusion" — a locked macro shot of dye blooming through water.
 *
 * Everything visible is the fragment shader in ./shader.ts; this component
 * only owns the WebGL context and feeds it uniforms derived from the frame
 * number. There is deliberately no state carried between frames: Remotion
 * renders frames out of order across threads, so frame N has to be a pure
 * function of N.
 */
export const InkDiffusion: React.FC<InkDiffusionProps> = ({
  variant,
  sourceSteps,
  advectSteps,
  studioPreviewWidth,
  seed,
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames, fps } = useVideoConfig();
  const params = INK_PARAMS[variant];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const uniformsRef = useRef<Record<string, WebGLUniformLocation | null>>({});
  const [setupHandle] = React.useState(() => delayRender("Compiling ink shader"));

  const injections = useMemo(() => packInjections(params), [params]);
  const sourceEnd = useMemo(() => sourceEndTime(params.injections), [params]);

  // Buffer size. Rendering with `--scale=0.5` lowers the device pixel ratio
  // rather than the layout, so following it gives exactly the output
  // resolution and no wasted shader work. Studio gets a capped buffer so the
  // 4K composition stays interactive.
  const { bufferWidth, bufferHeight } = useMemo(() => {
    const { isStudio } = getRemotionEnvironment();
    const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
    const scale = isStudio
      ? Math.min(1, studioPreviewWidth / width)
      : Math.min(1, dpr);
    return {
      bufferWidth: Math.max(2, Math.round(width * scale)),
      bufferHeight: Math.max(2, Math.round(height * scale)),
    };
  }, [width, height, studioPreviewWidth]);

  const draw = useCallback(() => {
    const gl = glRef.current;
    const program = programRef.current;
    if (!gl || !program) return;
    const u = uniformsRef.current;

    gl.viewport(0, 0, bufferWidth, bufferHeight);
    gl.useProgram(program);

    // Late frames have a longer history to unwind, so the tail step count
    // ramps with the frame and cost per frame rises through the clip. Both
    // counts are fractional and the shader weights its final step by the
    // remainder, so nothing pops as they grow.
    const seconds = frame / fps;
    const tail = Math.max(0, seconds - sourceEnd);
    const tailSpan = Math.max(1e-6, durationInFrames / fps - sourceEnd);

    gl.uniform2f(u.uResolution, bufferWidth, bufferHeight);
    gl.uniform1f(u.uSeconds, seconds);
    gl.uniform1f(u.uFrame, frame);
    gl.uniform1f(u.uStepsSource, sourceSteps);
    gl.uniform1f(u.uStepsAdvect, Math.max(2, (advectSteps * tail) / tailSpan));
    gl.uniform1f(u.uSourceEnd, sourceEnd);
    gl.uniform2f(u.uSeed, seed * 11.317, seed * -7.643);

    gl.uniform3fv(u.uBackground, params.background);
    gl.uniform3fv(u.uInkThin, params.inkThin);
    gl.uniform3fv(u.uInkDense, params.inkDense);
    gl.uniform3fv(u.uInkThin2, params.inkThin2);
    gl.uniform3fv(u.uInkDense2, params.inkDense2);
    gl.uniform1f(u.uAdditive, params.additive ? 1 : 0);
    gl.uniform1f(u.uOpacityGain, params.opacityGain);

    gl.uniform3fv(u.uOctaveAmp, params.octaveAmp);
    gl.uniform1f(u.uFlowSpeed, params.flowSpeed);
    gl.uniform1f(u.uFlowDecay, params.flowDecay);
    gl.uniform1f(u.uFlowFloor, params.flowFloor);
    gl.uniform1f(u.uDiffusion, params.diffusion);
    gl.uniform1f(u.uDiffusionFade, params.diffusionFade);
    gl.uniform1f(u.uSourceTexFreq, params.sourceTexFreq);
    gl.uniform1f(u.uSourceTexAmp, params.sourceTexAmp);
    gl.uniform1f(u.uGrain, params.grain);
    gl.uniform1f(u.uVignette, params.vignette);

    gl.uniform1i(u.uInjectionCount, injections.count);
    gl.uniform4fv(u.uInjectionPos, injections.pos);
    gl.uniform4fv(u.uInjectionCfg, injections.cfg);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // Block until the pixels actually exist. Without this the screenshot can
    // race a still-running draw, which at these step counts takes seconds.
    gl.finish();
  }, [
    bufferWidth,
    bufferHeight,
    frame,
    fps,
    durationInFrames,
    sourceSteps,
    advectSteps,
    sourceEnd,
    seed,
    params,
    injections,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    if (!gl) throw new Error("WebGL2 is unavailable — render with --gl=angle");

    const program = createProgram(gl);
    glRef.current = gl;
    programRef.current = program;

    const names = [
      "uResolution", "uSeconds", "uFrame",
      "uStepsSource", "uStepsAdvect", "uSourceEnd", "uSeed",
      "uBackground", "uInkThin", "uInkDense", "uInkThin2", "uInkDense2",
      "uAdditive", "uOpacityGain", "uOctaveAmp", "uFlowSpeed", "uFlowDecay",
      "uFlowFloor", "uDiffusion", "uDiffusionFade", "uSourceTexFreq",
      "uSourceTexAmp", "uGrain", "uVignette",
      "uInjectionCount", "uInjectionPos", "uInjectionCfg",
    ];
    uniformsRef.current = Object.fromEntries(
      names.map((n) => [n, gl.getUniformLocation(program, n)]),
    );

    draw();
    continueRender(setupHandle);
    // Set up once per mount; per-frame drawing is handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupHandle]);

  // Draw synchronously on every frame, before the browser paints, so the
  // canvas is always current by the time Remotion captures it.
  useLayoutEffect(() => {
    draw();
  }, [draw]);

  return (
    // The canvas is opaque and exactly frame-sized, so the fill behind it is
    // only ever seen in Studio in the instant before the shader first paints.
    // Matching it to the version's own water keeps that from flashing black.
    <AbsoluteFill style={{ backgroundColor: toCss(params.background) }}>
      <canvas
        ref={canvasRef}
        width={bufferWidth}
        height={bufferHeight}
        style={{ width, height, display: "block" }}
      />
    </AbsoluteFill>
  );
};
