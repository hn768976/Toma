import { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, cancelRender, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { FRAGMENT_SHADER, VERTEX_SHADER } from "./shader";

export const streaksSchema = z.object({
  /** "reference" = framing of the reference clip, "lowAngle" = Version 2 camera */
  camera: z.enum(["reference", "lowAngle"]),
});

export type StreaksProps = z.infer<typeof streaksSchema>;

/** The reference animation is a seamless 2-second loop. */
export const LOOP_SECONDS = 2;

type GlState = {
  gl: WebGL2RenderingContext;
  uniforms: Record<string, WebGLUniformLocation | null>;
};

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(`Shader compile error: ${gl.getShaderInfoLog(sh)}`);
  }
  return sh;
};

const initGl = (canvas: HTMLCanvasElement): GlState => {
  const gl = canvas.getContext("webgl2", {
    preserveDrawingBuffer: true,
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
  });
  if (!gl) throw new Error("WebGL 2 is not available in this browser");
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`Program link error: ${gl.getProgramInfoLog(prog)}`);
  }
  gl.useProgram(prog);
  // full-screen triangle
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uniforms: GlState["uniforms"] = {};
  for (const name of ["uResolution", "uTime", "uLoop", "uCamera", "uProgress"]) {
    uniforms[name] = gl.getUniformLocation(prog, name);
  }
  return { gl, uniforms };
};

export const NeonArcStreaks: React.FC<StreaksProps> = ({ camera }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<GlState | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      if (!glRef.current) glRef.current = initGl(canvas);
      const { gl, uniforms } = glRef.current;
      gl.viewport(0, 0, width, height);
      gl.uniform2f(uniforms.uResolution, width, height);
      gl.uniform1f(uniforms.uTime, frame / fps);
      gl.uniform1f(uniforms.uLoop, LOOP_SECONDS);
      gl.uniform1i(uniforms.uCamera, camera === "lowAngle" ? 1 : 0);
      gl.uniform1f(uniforms.uProgress, frame / Math.max(1, durationInFrames - 1));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.finish(); // drawing is synchronous; finish before Remotion screenshots
    } catch (err) {
      cancelRender(err);
    }
  }, [frame, fps, width, height, camera, durationInFrames]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#03021a" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%" }}
      />
    </AbsoluteFill>
  );
};
