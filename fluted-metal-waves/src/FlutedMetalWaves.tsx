import { useEffect, useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { LOOP_FRAMES, PALETTES, Palette } from "./constants";
import { FRAG, VERT } from "./shader";

type GLState = {
  gl: WebGL2RenderingContext;
  uniforms: Record<string, WebGLUniformLocation | null>;
};

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error("Shader compile error: " + gl.getShaderInfoLog(s));
  }
  return s;
};

export const FlutedMetalWaves: React.FC<{ palette: Palette }> = ({
  palette,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useRef<GLState | null>(null);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!state.current) {
      const gl = canvas.getContext("webgl2", {
        antialias: false,
        preserveDrawingBuffer: true,
        alpha: false,
      });
      if (!gl) throw new Error("WebGL 2 is not available");
      const prog = gl.createProgram()!;
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error("Program link error: " + gl.getProgramInfoLog(prog));
      }
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 3, -1, -1, 3]),
        gl.STATIC_DRAW,
      );
      const loc = gl.getAttribLocation(prog, "aPos");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const uniforms: GLState["uniforms"] = {};
      for (const n of ["uRes", "uPhase", "uShadow", "uMid", "uLight", "uSpec"]) {
        uniforms[n] = gl.getUniformLocation(prog, n);
      }
      state.current = { gl, uniforms };
    }
    const { gl, uniforms } = state.current;
    const pal = PALETTES[palette];
    gl.viewport(0, 0, width, height);
    gl.uniform2f(uniforms.uRes, width, height);
    gl.uniform1f(uniforms.uPhase, (frame / LOOP_FRAMES) * Math.PI * 2);
    gl.uniform3fv(uniforms.uShadow, pal.shadow);
    gl.uniform3fv(uniforms.uMid, pal.mid);
    gl.uniform3fv(uniforms.uLight, pal.light);
    gl.uniform3fv(uniforms.uSpec, pal.spec);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.finish();
  };

  // Draw synchronously before Remotion captures the frame.
  useLayoutEffect(draw);

  useEffect(() => {
    return () => {
      state.current?.gl.getExtension("WEBGL_lose_context")?.loseContext();
      state.current = null;
    };
  }, []);

  return (
    <AbsoluteFill style={{ backgroundColor: "#888" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};
