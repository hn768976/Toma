import { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { COLS, ROWS, lampState } from "./lights";
import { FRAG, VERT } from "./shader";

type Props = { camera: "front" | "orbit" };

type GL = {
  gl: WebGL2RenderingContext;
  loc: Record<string, WebGLUniformLocation | null>;
};

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(s) ?? "shader compile failed");
  }
  return s;
};

type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: V3): V3 => {
  const l = Math.hypot(...a);
  return [a[0] / l, a[1] / l, a[2] / l];
};
const ease = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * x);

// Camera looking at the wall (plane z = 0) from negative z.
const cameraFor = (mode: Props["camera"], u: number) => {
  const fov = 40;
  const tanHalf = Math.tan(((fov / 2) * Math.PI) / 180);
  if (mode === "front") {
    // Distance chosen so that a 1.0-high slice of the wall fills the frame.
    const dist = 0.5 / tanHalf;
    return { pos: [0, 0, -dist] as V3, target: [0, 0, 0] as V3, tanHalf };
  }
  // Orbit: slow sweep from screen-left to screen-right while dollying in
  // and easing from a low angle to a slightly high one.
  const e = ease(u);
  const yaw = ((22 - 44 * e) * Math.PI) / 180;
  const pitch = ((-8 + 14 * e) * Math.PI) / 180;
  const dist = 1.15 - 0.3 * e;
  const target: V3 = [0.1 - 0.2 * e, 0.02 * Math.sin(Math.PI * 2 * u), 0];
  const pos: V3 = [
    target[0] + dist * Math.sin(yaw) * Math.cos(pitch),
    target[1] + dist * Math.sin(pitch),
    -dist * Math.cos(yaw) * Math.cos(pitch),
  ];
  return { pos, target, tanHalf };
};

export const StageLights: React.FC<Props> = ({ camera }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctx = useRef<GL | null>(null);

  // Authored at 4K; the backing store follows the render scale (--scale).
  const dpr = Math.min(
    typeof window === "undefined" ? 1 : window.devicePixelRatio || 1,
    1,
  );
  const bw = Math.round(width * dpr);
  const bh = Math.round(height * dpr);

  useLayoutEffect(() => {
    const canvas = canvasRef.current!;
    canvas.width = bw;
    canvas.height = bh;
    const gl = canvas.getContext("webgl2", {
      preserveDrawingBuffer: true,
      antialias: false,
    })!;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog) ?? "link failed");
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
    const names = [
      "uRes",
      "uA",
      "uB",
      "uCamPos",
      "uCamFwd",
      "uCamRight",
      "uCamUp",
      "uTanHalf",
      "uHaze",
      "uLit",
      "uLit2",
      "uLitCount",
    ];
    const loc: GL["loc"] = {};
    for (const n of names) loc[n] = gl.getUniformLocation(prog, n);
    ctx.current = { gl, loc };
    return () => {
      ctx.current = null;
    };
  }, [bw, bh]);

  useLayoutEffect(() => {
    const c = ctx.current;
    if (!c) return;
    const { gl, loc } = c;
    const n = COLS * ROWS;
    const A = lampState(frame, durationInFrames);

    // Spill: how much light neighbouring lamps throw on each housing.
    const B = new Float32Array(n * 4);
    let total = 0;
    for (let i = 0; i < n; i++) {
      const ci = i % COLS;
      const ri = Math.floor(i / COLS);
      let s = 0;
      for (let j = 0; j < n; j++) {
        if (j === i || A[j * 4] < 0.01) continue;
        const dx = ((j % COLS) - ci) * 0.2222;
        const dy = (Math.floor(j / COLS) - ri) * 0.25;
        s += A[j * 4] * Math.exp(-Math.hypot(dx, dy) / 0.15);
      }
      total += A[i * 4];
      B[i * 4] = Math.min(0.9, 0.01 + 0.45 * s);
      B[i * 4 + 1] = ((i * 0.618034) % 1) + 0.13;
    }

    // Pack the lit lamps so the shader only loops over those for bloom/beams.
    const lit = new Float32Array(n * 4);
    const lit2 = new Float32Array(n * 4);
    let litCount = 0;
    for (let i = 0; i < n; i++) {
      if (A[i * 4] <= 0.002) continue;
      const o = litCount * 4;
      lit[o] = ((i % COLS) - COLS / 2 + 0.5) * 0.2222222;
      lit[o + 1] = (Math.floor(i / COLS) - ROWS / 2 + 0.5) * 0.25;
      lit[o + 2] = A[i * 4];
      lit[o + 3] = A[i * 4 + 1];
      lit2[o] = A[i * 4 + 2];
      lit2[o + 1] = A[i * 4 + 3];
      lit2[o + 2] = B[i * 4 + 1];
      litCount++;
    }

    const cam = cameraFor(camera, frame / (durationInFrames - 1));
    const fwd = norm(sub(cam.target, cam.pos));
    // Wall y is up; camera looks along +z, so right = up x fwd.
    const right = norm(cross([0, 1, 0], fwd));
    const up = cross(fwd, right);

    gl.viewport(0, 0, bw, bh);
    gl.uniform2f(loc.uRes, bw, bh);
    gl.uniform4fv(loc.uA, A);
    gl.uniform4fv(loc.uB, B);
    gl.uniform3fv(loc.uCamPos, cam.pos);
    gl.uniform3fv(loc.uCamFwd, fwd);
    gl.uniform3fv(loc.uCamRight, right);
    gl.uniform3fv(loc.uCamUp, up);
    gl.uniform1f(loc.uTanHalf, cam.tanHalf);
    gl.uniform4fv(loc.uLit, lit);
    gl.uniform4fv(loc.uLit2, lit2);
    gl.uniform1i(loc.uLitCount, litCount);
    // Faint atmospheric haze that breathes with the overall light level.
    gl.uniform1f(loc.uHaze, 0.004 + 0.0004 * total);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }, [frame, durationInFrames, camera, bw, bh]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
