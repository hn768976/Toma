import React, { useEffect, useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { palettes, Variant } from "./clock/palettes";
import { FRAG, VERT } from "./clock/shader";

// Camera fitted to the reference framing: clock centre in the upper right,
// dial tilted ~42 degrees away, focal plane running along the minute hand.
const TILT = 0.731;
const ROLL = 0.553;
const DIST = 2.135;
const TARGET: [number, number] = [-0.833, 0.276];
const FOV_Y = (30 * Math.PI) / 180;

const camera = () => {
  const f = [0, Math.sin(TILT), -Math.cos(TILT)];
  const up0 = [0, Math.cos(TILT), Math.sin(TILT)];
  const r0 = [1, 0, 0];
  const u = up0.map((v, i) => Math.cos(ROLL) * v + Math.sin(ROLL) * r0[i]);
  const r = r0.map((v, i) => Math.cos(ROLL) * v - Math.sin(ROLL) * up0[i]);
  const c = [TARGET[0] - DIST * f[0], TARGET[1] - DIST * f[1], -DIST * f[2]];
  // focus on the hub / minute hand
  const focus = -(c[0] * f[0] + c[1] * f[1] + (c[2] - 0.04) * f[2]);
  return { f, u, r, c, focus };
};

/**
 * Quartz second hand: holds still, then steps 6 degrees over two frames once
 * a second (the reference ticks ~0.12 s after each whole second). Starts at
 * 237 deg (pointing to the bottom of the frame) and ends 30 ticks later.
 */
const secondAngle = (t: number) => {
  const u = t - 0.12;
  const k = Math.floor(u);
  const f = Math.min(1, (u - k) / (2 / 30));
  const ease = f * f * (3 - 2 * f);
  return 237 - 6 * (k + ease);
};

type GLState = {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  loc: (name: string) => WebGLUniformLocation | null;
};

const init = (canvas: HTMLCanvasElement): GLState => {
  const gl = canvas.getContext("webgl2", {
    antialias: false,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  if (!gl) {
    throw new Error("WebGL2 is not available (try --gl=angle or --gl=swangle)");
  }
  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type)!;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      throw new Error("Shader error: " + gl.getShaderInfoLog(sh));
    }
    return sh;
  };
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error("Link error: " + gl.getProgramInfoLog(program));
  }
  gl.useProgram(program);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const cache = new Map<string, WebGLUniformLocation | null>();
  const loc = (name: string) => {
    if (!cache.has(name)) {
      cache.set(name, gl.getUniformLocation(program, name));
    }
    return cache.get(name) ?? null;
  };
  return { gl, program, loc };
};

export const ClockMacro: React.FC<{ variant: Variant }> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GLState | null>(null);

  useEffect(() => {
    return () => {
      stateRef.current?.gl.getExtension("WEBGL_lose_context")?.loseContext();
      stateRef.current = null;
    };
  }, []);

  // Drawn synchronously for each frame; the image is a pure function of time.
  useLayoutEffect(() => {
    if (!canvasRef.current) {
      return;
    }
    if (!stateRef.current) {
      stateRef.current = init(canvasRef.current);
    }
    const { gl, loc } = stateRef.current;
    const pal = palettes[variant];
    const cam = camera();
    gl.viewport(0, 0, width, height);
    gl.uniform2f(loc("uRes"), width, height);
    gl.uniform1f(loc("uTime"), frame / fps);
    gl.uniform1f(loc("uSecAngle"), secondAngle(frame / fps));
    gl.uniform1f(loc("uSeed"), frame + 1);
    gl.uniform3fv(loc("uCam"), cam.c);
    gl.uniform3fv(loc("uCamR"), cam.r);
    gl.uniform3fv(loc("uCamU"), cam.u);
    gl.uniform3fv(loc("uCamF"), cam.f);
    gl.uniform1f(loc("uTanHalf"), Math.tan(FOV_Y / 2));
    gl.uniform1f(loc("uFocus"), cam.focus);
    gl.uniform1f(loc("uBlur"), 0.13);
    gl.uniform3fv(loc("uBgA"), pal.bgA);
    gl.uniform3fv(loc("uBgB"), pal.bgB);
    gl.uniform3fv(loc("uDialA"), pal.dialA);
    gl.uniform3fv(loc("uDialB"), pal.dialB);
    gl.uniform3fv(loc("uRing"), pal.ring);
    gl.uniform3fv(loc("uInk"), pal.ink);
    gl.uniform3fv(loc("uSecond"), pal.second);
    gl.uniform3fv(loc("uMetalHi"), pal.metalHi);
    gl.uniform3fv(loc("uMetalMid"), pal.metalMid);
    gl.uniform3fv(loc("uMetalLo"), pal.metalLo);
    gl.uniform3fv(loc("uWall"), pal.wall);
    gl.uniform3fv(loc("uShadow"), pal.shadow);
    gl.uniform1f(loc("uShadowAmt"), pal.shadowAmt);
    gl.uniform1f(loc("uSheen"), pal.sheen);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
  }, [frame, fps, width, height, variant]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width, height, display: "block" }}
      />
    </AbsoluteFill>
  );
};
