import { useEffect, useLayoutEffect, useRef } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { z } from "zod";
import { FRAGMENT_SHADER, VERTEX_SHADER } from "./shader";
import { MONOCHROME, SAFFRON_INDIGO } from "./palettes";

export const stripedTunnelSchema = z.object({
  palette: z.enum(["monochrome", "saffron-indigo"]),
  /** Duration of one seamless loop in frames (stripes move one pair per loop). */
  loopFrames: z.number().int().positive(),
  /** Optional overrides of the scene constants (for look development). */
  scene: z.record(z.string(), z.number()).optional(),
});

export type StripedTunnelProps = z.infer<typeof stripedTunnelSchema>;

// Geometry / camera tuned against the reference.
const BASE_SCENE = {
  segTwist: -1.6, // strong twist between rings -> folded, curved silhouettes
  segGrowth: 2.1, // each ring sits 2.1x deeper ...
  segShrink: 1.0, // ... at the same size, so it looks ~0.48x smaller
  z0: 1.0,
  circumradius: 1.6,
  pairsPerFace: 11,
  fov: 0.6,
  lookYaw: 0.1, // vanishing point slightly left of centre (as in reference)
  lookPitch: 0.05, // ... and slightly below centre
  roll: 0.0,
  baseRot: 0.35,
  depthNear: 0.3, // ring index where the blue-grey depth tint starts
  depthFar: 3.2,
};

type GlState = {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
};

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
  const sh = gl.createShader(type);
  if (!sh) throw new Error("createShader failed");
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error("Shader compile error: " + gl.getShaderInfoLog(sh));
  }
  return sh;
};

const initGl = (canvas: HTMLCanvasElement): GlState => {
  const gl = canvas.getContext("webgl2", {
    preserveDrawingBuffer: true,
    antialias: false,
    alpha: false,
  });
  if (!gl) throw new Error("WebGL 2 is not available");
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
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const loc = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const names = [
    "uResolution", "uPhase", "uTime", "uSegTwist", "uSegGrowth", "uSegShrink", "uZ0", "uCircumradius", "uPairsPerFace",
    "uFov", "uLook", "uRoll", "uBaseRot", "uInk", "uPaper", "uDeep",
    "uDeepInk", "uDepthNear", "uDepthFar", "uGrain",
  ];
  const uniforms: GlState["uniforms"] = {};
  for (const n of names) uniforms[n] = gl.getUniformLocation(program, n);
  return { gl, program, uniforms };
};

export const StripedTunnel: React.FC<StripedTunnelProps> = ({
  palette,
  loopFrames,
  scene: sceneOverrides,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GlState | null>(null);

  useEffect(() => {
    return () => {
      stateRef.current?.gl.getExtension("WEBGL_lose_context")?.loseContext();
      stateRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const handle = delayRender(`tunnel frame ${frame}`);
    try {
      if (!stateRef.current && canvasRef.current) {
        stateRef.current = initGl(canvasRef.current);
      }
      const s = stateRef.current;
      if (!s) throw new Error("No GL state");
      const { gl, uniforms: u } = s;
      const SCENE = { ...BASE_SCENE, ...sceneOverrides };
      const look = palette === "monochrome" ? MONOCHROME : SAFFRON_INDIGO;
      gl.viewport(0, 0, width, height);
      gl.uniform2f(u.uResolution, width, height);
      gl.uniform1f(u.uPhase, frame / loopFrames);
      gl.uniform1f(u.uTime, frame / fps);
      gl.uniform1f(u.uSegTwist, SCENE.segTwist);
      gl.uniform1f(u.uSegGrowth, SCENE.segGrowth);
      gl.uniform1f(u.uSegShrink, SCENE.segShrink);
      gl.uniform1f(u.uZ0, SCENE.z0);
      gl.uniform1f(u.uCircumradius, SCENE.circumradius);
      gl.uniform1f(u.uPairsPerFace, SCENE.pairsPerFace);
      gl.uniform1f(u.uFov, SCENE.fov);
      gl.uniform2f(u.uLook, SCENE.lookYaw, SCENE.lookPitch);
      gl.uniform1f(u.uRoll, SCENE.roll);
      gl.uniform1f(u.uBaseRot, SCENE.baseRot);
      gl.uniform3fv(u.uInk, look.ink);
      gl.uniform3fv(u.uPaper, look.paper);
      gl.uniform3fv(u.uDeep, look.deep);
      gl.uniform3fv(u.uDeepInk, look.deepInk);
      gl.uniform1f(u.uDepthNear, SCENE.depthNear);
      gl.uniform1f(u.uDepthFar, SCENE.depthFar);
      gl.uniform1f(u.uGrain, look.grain);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.finish();
      continueRender(handle);
    } catch (err) {
      cancelRender(err as Error);
    }
  }, [frame, width, height, fps, palette, loopFrames, sceneOverrides]);

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
