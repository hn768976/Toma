import { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { MoleculePalette } from "./palettes";
import { computeScene } from "./scene";
import { FRAGMENT_SHADER, VERTEX_SHADER } from "./shader";

type GLState = {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
};

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
  const s = gl.createShader(type);
  if (!s) throw new Error("Could not create shader");
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error("Shader compile error: " + gl.getShaderInfoLog(s));
  }
  return s;
};

const UNIFORMS = [
  "uRes", "uBallCount", "uBondCount", "uBall", "uBallCol", "uBond", "uBondColA", "uBondColB", "uBlend",
  "uBg", "uBgEdge", "uDot", "uDotOpacity", "uShadow", "uShadowStrength",
  "uRed", "uPale", "uYellow", "uGoo", "uRim", "uSpec",
];

const init = (canvas: HTMLCanvasElement): GLState => {
  const gl = canvas.getContext("webgl2", {
    antialias: false,
    preserveDrawingBuffer: true,
    premultipliedAlpha: false,
  });
  if (!gl) throw new Error("WebGL2 is not available");
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error("Program link error: " + gl.getProgramInfoLog(program));
  }
  gl.useProgram(program);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uniforms: GLState["uniforms"] = {};
  for (const u of UNIFORMS) uniforms[u] = gl.getUniformLocation(program, u);
  return { gl, program, uniforms };
};

export const MoleculeKaleidoscope: React.FC<{ palette: MoleculePalette }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // The shader is resolution independent (analytic anti-aliasing), so the
  // backing store follows the output resolution: a full-size render draws
  // every one of the composition's 3840x2160 pixels, while `--scale=0.5`
  // draws natively at 1920x1080 instead of rendering 4K and throwing 3/4 away.
  const dpr = typeof window === "undefined" ? 1 : Math.min(1, window.devicePixelRatio || 1);
  const bw = Math.round(width * dpr);
  const bh = Math.round(height * dpr);
  const state = useRef<GLState | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!state.current) state.current = init(canvas);
    const { gl, uniforms: u } = state.current;
    const scene = computeScene(frame);

    gl.viewport(0, 0, bw, bh);
    gl.uniform2f(u.uRes, bw, bh);
    gl.uniform1i(u.uBallCount, scene.ballCount);
    gl.uniform1i(u.uBondCount, scene.bondCount);
    gl.uniform4fv(u.uBall, scene.balls);
    // resolve atom colours on the CPU (cheaper than branching per pixel)
    const kindCol = [palette.red, palette.pale, palette.yellow];
    const ballCol = new Float32Array(16 * 3);
    for (let i = 0; i < scene.ballCount; i++) ballCol.set(kindCol[scene.kinds[i]], i * 3);
    const bondA = new Float32Array(16 * 3);
    const bondB = new Float32Array(16 * 3);
    const toGoo = (c: number[]) => c.map((v, k) => v * 0.2 + palette.goo[k] * 0.8);
    for (let i = 0; i < scene.bondCount; i++) {
      bondA.set(toGoo(kindCol[scene.kinds[scene.bonds[i * 4]]]), i * 3);
      bondB.set(toGoo(kindCol[scene.kinds[scene.bonds[i * 4 + 1]]]), i * 3);
    }
    gl.uniform3fv(u.uBallCol, ballCol);
    gl.uniform3fv(u.uBondColA, bondA);
    gl.uniform3fv(u.uBondColB, bondB);
    gl.uniform4fv(u.uBond, scene.bonds);
    gl.uniform1f(u.uBlend, scene.blend);
    gl.uniform3fv(u.uBg, palette.background);
    gl.uniform3fv(u.uBgEdge, palette.backgroundEdge);
    gl.uniform3fv(u.uDot, palette.dot);
    gl.uniform1f(u.uDotOpacity, palette.dotOpacity);
    gl.uniform3fv(u.uShadow, palette.shadow);
    gl.uniform1f(u.uShadowStrength, palette.shadowStrength);
    gl.uniform3fv(u.uRed, palette.red);
    gl.uniform3fv(u.uPale, palette.pale);
    gl.uniform3fv(u.uYellow, palette.yellow);
    gl.uniform3fv(u.uGoo, palette.goo);
    gl.uniform3fv(u.uRim, palette.rim);
    gl.uniform1f(u.uSpec, palette.specular);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
  }, [frame, bw, bh, palette]);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <canvas ref={canvasRef} width={bw} height={bh} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};
