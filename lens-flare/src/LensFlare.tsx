import React, { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import {
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { GHOSTS } from "./ghosts";
import { flareState } from "./motion";
import { hexToLinear, type Palette } from "./palettes";
import { FRAG, VERT } from "./shader";

export type LensFlareProps = {
  palette: Palette;
  /** Grain amount in output units. 0.01 == 1%. */
  grain: number;
  /** Channel separation on ghosts and ring, as a fraction of frame height. */
  chroma: number;
};

const compile = (gl: WebGLRenderingContext, type: number, src: string) => {
  const sh = gl.createShader(type);
  if (!sh) throw new Error("could not create shader");
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error("shader compile failed: " + gl.getShaderInfoLog(sh));
  }
  return sh;
};

type Ctx = {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  loc: Record<string, WebGLUniformLocation | null>;
};

const setup = (canvas: HTMLCanvasElement): Ctx => {
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    // Required: Remotion screenshots the page after the frame is drawn, and
    // without this the drawing buffer is allowed to be cleared first.
    preserveDrawingBuffer: true,
    premultipliedAlpha: false,
  });
  if (!gl) throw new Error("WebGL is not available in this renderer");

  const program = gl.createProgram();
  if (!program) throw new Error("could not create program");
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error("program link failed: " + gl.getProgramInfoLog(program));
  }
  gl.useProgram(program);

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

  const names = [
    "uRes",
    "uAspect",
    "uSrc",
    "uEnv",
    "uGate",
    "uRoll",
    "uSeed",
    "uC0",
    "uC1",
    "uC2",
    "uC3",
    "uGhostA",
    "uGhostB",
    "uRing",
    "uGhost[0]",
    "uGhostTint[0]",
    "uChroma",
    "uGrain",
    "uRingAmt",
  ];
  const loc: Record<string, WebGLUniformLocation | null> = {};
  for (const n of names) loc[n] = gl.getUniformLocation(program, n);
  return { gl, program, loc };
};

export const LensFlare: React.FC<LensFlareProps> = ({
  palette,
  grain,
  chroma,
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<Ctx | null>(null);

  const aspect = width / height;

  // Ghost geometry is fixed at module scope; pack it once per palette.
  const packed = useMemo(() => {
    const g = new Float32Array(GHOSTS.length * 4);
    const tint = new Float32Array(GHOSTS.length);
    GHOSTS.forEach((x, i) => {
      g[i * 4 + 0] = x.k;
      g[i * 4 + 1] = x.rad;
      g[i * 4 + 2] = x.shape;
      g[i * 4 + 3] = x.amp;
      tint[i] = x.tint;
    });
    return { g, tint };
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!ctxRef.current) ctxRef.current = setup(canvas);
    const { gl, loc } = ctxRef.current;

    const s = flareState(frame, durationInFrames, aspect);
    const set3 = (name: string, hex: string) => {
      const [r, g, b] = hexToLinear(hex);
      gl.uniform3f(loc[name] as WebGLUniformLocation, r, g, b);
    };

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(loc.uRes as WebGLUniformLocation, canvas.width, canvas.height);
    gl.uniform1f(loc.uAspect as WebGLUniformLocation, aspect);
    gl.uniform2f(loc.uSrc as WebGLUniformLocation, s.src[0], s.src[1]);
    gl.uniform1f(loc.uEnv as WebGLUniformLocation, s.env);
    gl.uniform1f(loc.uGate as WebGLUniformLocation, s.gate);
    gl.uniform1f(loc.uRoll as WebGLUniformLocation, s.roll);
    // Advancing the noise seed per frame keeps the grain moving instead of
    // sitting still as a fixed pattern.
    gl.uniform1f(loc.uSeed as WebGLUniformLocation, (frame % 97) * 13.37 + 1);
    set3("uC0", palette.c0);
    set3("uC1", palette.c1);
    set3("uC2", palette.c2);
    set3("uC3", palette.c3);
    set3("uGhostA", palette.ghostA);
    set3("uGhostB", palette.ghostB);
    set3("uRing", palette.ring);
    gl.uniform4fv(loc["uGhost[0]"] as WebGLUniformLocation, packed.g);
    gl.uniform1fv(loc["uGhostTint[0]"] as WebGLUniformLocation, packed.tint);
    gl.uniform1f(loc.uChroma as WebGLUniformLocation, chroma);
    gl.uniform1f(loc.uGrain as WebGLUniformLocation, grain);
    gl.uniform1f(loc.uRingAmt as WebGLUniformLocation, s.ringAmt);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
  }, [frame, durationInFrames, aspect, palette, grain, chroma, packed]);

  useLayoutEffect(() => {
    const handle = delayRender(`lens flare frame ${frame}`);
    try {
      draw();
    } finally {
      continueRender(handle);
    }
  }, [draw, frame]);

  // The backing store is sized to the pixels actually being captured:
  // devicePixelRatio carries Remotion's --scale, so a --scale=0.5 preview
  // renders 1920x1080 natively rather than supersampling a 4K buffer. Every
  // size in the shader is a fraction of frame height, so the two match.
  const dpr =
    typeof window === "undefined" ? 1 : (window.devicePixelRatio ?? 1);
  const bw = Math.max(2, Math.min(width, Math.round(width * dpr)));
  const bh = Math.max(2, Math.min(height, Math.round(height * dpr)));

  return (
    <canvas
      ref={canvasRef}
      width={bw}
      height={bh}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        backgroundColor: "#000000",
      }}
    />
  );
};
